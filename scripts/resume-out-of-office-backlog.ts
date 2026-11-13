/**
 * One-shot data fix for out-of-office replies that reached Action required
 * before src/lib/crm/outOfOffice.ts existed (13 Nov 2026).
 *
 * For each record on the Out of Office stage in Action required whose only
 * reply is that notice and which nobody has answered: the email campaign
 * enrollments the reply stopped (`reply_received`) go back to their sequence,
 * the next email due when it would have been (last send + the next step's
 * wait) or on the person's return day if later; the CRM reply run is
 * cancelled, its draft discarded, and the record left idle. Records with an
 * earlier reply, or answered since, are listed and left alone.
 *
 * Ingest wrote down nothing for these, so the schedule is rebuilt from the
 * sends. Return days come from a JSON file mapping record id → "YYYY-MM-DD"
 * (read off the notices by hand); a record not in it resumes on schedule.
 * --include / --clear-only take comma-separated record ids checked by hand.
 *
 *   ORGANIZATION_ID=<id> bun run --conditions=react-server scripts/resume-out-of-office-backlog.ts --dates <file.json>          # dry run
 *   ORGANIZATION_ID=<id> bun run --conditions=react-server scripts/resume-out-of-office-backlog.ts --dates <file.json> --apply
 */
import { readFileSync } from "node:fs";
import { and, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import { runScriptInOrganization } from "./lib/organization";
import type { OutreachLeadStatus } from "../src/lib/outreach/schema";

const apply = process.argv.includes("--apply");
const datesFlag = process.argv.indexOf("--dates");
const returnDays: Record<string, string> = datesFlag === -1 ? {} : JSON.parse(readFileSync(process.argv[datesFlag + 1]!, "utf8"));
const DAY_MS = 24 * 60 * 60 * 1000;
// Records checked by hand: --include resumes one the guard below would skip
// (e.g. the same notice twice); --clear-only takes one out of Action
// required without restarting its campaign (the rep already handled it).
const idList = (flag: string) => {
  const at = process.argv.indexOf(flag);
  return new Set(at === -1 ? [] : process.argv[at + 1]!.split(","));
};
const include = idList("--include");
const clearOnly = idList("--clear-only");

await runScriptInOrganization(async () => {
  const { db } = await import("../src/lib/db");
  const { inOrg } = await import("../src/lib/tenancy/scope");
  const { channelRules } = await import("../src/lib/channels/rules.server");
  const { appendCrmEvent } = await import("../src/lib/crm/events");
  const { withCrmTransaction } = await import("../src/lib/crm/repository");
  const { lockCrmRecord } = await import("../src/lib/crm/records");
  const { outOfOfficeReturnAt, resumedSendAt } = await import("../src/lib/crm/outOfOffice");
  const {
    crmClassifications, crmConversationMessages, crmConversations, crmDrafts, crmRecords,
    crmSequenceRuns, crmSequenceStepRuns, crmSubcategories,
  } = await import("../src/lib/crm/schema");
  const { outreachCampaigns, outreachEmails, outreachLeads } = await import("../src/lib/outreach/schema");
  const { leadsInOrg } = await import("../src/lib/outreach/orgScope");

  const { timeZone } = await channelRules("general");
  const now = new Date();
  console.log(`${apply ? "APPLYING" : "Dry run"} · time zone ${timeZone} · ${Object.keys(returnDays).length} return days given\n`);

  const records = await db.select({ record: crmRecords, messageId: crmConversationMessages.id, receivedAt: crmConversationMessages.sentAt })
    .from(crmRecords)
    .innerJoin(crmSubcategories, eq(crmSubcategories.id, crmRecords.subcategoryId))
    .innerJoin(crmConversationMessages, eq(crmConversationMessages.id, crmRecords.latestInboundMessageId))
    .where(and(inOrg(crmRecords), eq(crmSubcategories.key, "out_of_office"), eq(crmRecords.workflowState, "action_required")));

  const totals = { resumed: 0, skipped: 0, leads: 0, withReturnDay: 0, completed: 0 };
  for (const { record, messageId, receivedAt } of records) {
    const messages = await db.select({ direction: crmConversationMessages.direction, sentAt: crmConversationMessages.sentAt })
      .from(crmConversationMessages)
      .innerJoin(crmConversations, eq(crmConversations.id, crmConversationMessages.conversationId))
      .where(eq(crmConversations.crmRecordId, record.id));
    const inbound = messages.filter((m) => m.direction === "inbound").length;
    // The first notice is the one that stopped the campaign.
    const firstInboundAt = new Date(Math.min(...messages.filter((m) => m.direction === "inbound").map((m) => m.sentAt.getTime())));
    const answered = messages.some((m) => m.direction === "outbound" && m.sentAt > receivedAt);
    if ((inbound !== 1 || answered) && !include.has(record.id) && !clearOnly.has(record.id)) {
      console.log(`skip  ${record.id}  ${inbound !== 1 ? `${inbound} replies` : "answered since"}`);
      totals.skipped += 1;
      continue;
    }

    const day = returnDays[record.id];
    const returnAt = day ? outOfOfficeReturnAt(`${day}T12:00:00Z`, timeZone, now) : null;
    const leads = await db.select({ lead: outreachLeads, sequence: outreachCampaigns.sequence })
      .from(outreachLeads)
      .innerJoin(outreachCampaigns, eq(outreachCampaigns.id, outreachLeads.campaignId))
      .where(and(leadsInOrg(), eq(outreachLeads.personId, record.personId), eq(outreachLeads.sequenceStatus, "reply_received")));
    const plans: Array<{ id: string; sequenceStatus: OutreachLeadStatus; nextSendAt: Date | null }> = [];
    for (const { lead, sequence } of clearOnly.has(record.id) ? [] : leads) {
      // Stopped by this notice, not by something long before it.
      if (lead.updatedAt && lead.updatedAt.getTime() < firstInboundAt.getTime() - DAY_MS) continue;
      const [last] = await db.select({ at: max(outreachEmails.sentAt) }).from(outreachEmails)
        .where(and(eq(outreachEmails.leadId, lead.id), isNotNull(outreachEmails.sentAt)));
      const step = sequence[lead.currentStep];
      if (!step) {
        plans.push({ id: lead.id, sequenceStatus: "sequence_completed" as const, nextSendAt: null });
        continue;
      }
      const due = last?.at ? new Date(new Date(last.at).getTime() + step.waitDays * DAY_MS) : now;
      plans.push({
        id: lead.id,
        sequenceStatus: lead.currentStep === 0 ? "pending" as const : lead.currentStep === 1 ? "initial_sent" as const : "in_follow_up" as const,
        nextSendAt: lead.currentStep === 0 ? null : resumedSendAt(due, returnAt),
      });
    }
    console.log(`ok    ${record.id}  back ${returnAt?.toISOString().slice(0, 10) ?? "—"}  ${plans.map((p) => `${p.sequenceStatus}→${p.nextSendAt?.toISOString().slice(0, 16) ?? "none"}`).join(", ") || "no campaign to resume"}`);
    totals.resumed += 1;
    totals.leads += plans.filter((p) => p.sequenceStatus !== "sequence_completed").length;
    totals.completed += plans.filter((p) => p.sequenceStatus === "sequence_completed").length;
    if (returnAt) totals.withReturnDay += 1;
    if (!apply) continue;

    await withCrmTransaction(async (tx) => {
      const current = await lockCrmRecord(tx, record.id);
      if (current.workflowState !== "action_required" || current.latestInboundMessageId !== messageId) return;
      for (const plan of plans) {
        await tx.update(outreachLeads).set({ sequenceStatus: plan.sequenceStatus, nextSendAt: plan.nextSendAt, updatedAt: now })
          .where(and(eq(outreachLeads.id, plan.id), eq(outreachLeads.sequenceStatus, "reply_received")));
      }
      const runs = await tx.select({ id: crmSequenceRuns.id }).from(crmSequenceRuns)
        .where(and(eq(crmSequenceRuns.crmRecordId, record.id), eq(crmSequenceRuns.status, "active")));
      const runIds = runs.map((run) => run.id);
      if (runIds.length) {
        await tx.update(crmSequenceStepRuns).set({ status: "cancelled", updatedAt: now })
          .where(and(
            inArray(crmSequenceStepRuns.sequenceRunId, runIds),
            inArray(crmSequenceStepRuns.status, ["scheduled", "drafting", "awaiting_review", "failed"]),
          ));
        await tx.update(crmSequenceRuns).set({ status: "cancelled", updatedAt: now }).where(inArray(crmSequenceRuns.id, runIds));
      }
      await tx.update(crmDrafts).set({ status: "discarded", updatedAt: now })
        .where(and(eq(crmDrafts.crmRecordId, record.id), inArray(crmDrafts.status, ["generating", "awaiting_review", "failed"])));
      await tx.update(crmClassifications).set({ acknowledgedAt: now, updatedAt: now })
        .where(and(eq(crmClassifications.messageId, messageId), sql`${crmClassifications.acknowledgedAt} is null`));
      const contextVersion = current.contextVersion + 1;
      await tx.update(crmRecords).set({ workflowState: "idle", nextActionAt: null, contextVersion, updatedAt: now })
        .where(eq(crmRecords.id, record.id));
      await appendCrmEvent(tx, {
        personId: record.personId,
        crmRecordId: record.id,
        pipelineId: record.pipelineId,
        eventType: "out_of_office.resumed",
        actorType: "system",
        toData: {
          returnAt: returnAt?.toISOString() ?? null,
          emailLeadsResumed: plans.length,
          whatsappLeadsResumed: 0,
          crmFollowUpAt: null,
        },
        meta: { messageId, backfill: "scripts/resume-out-of-office-backlog.ts", leads: plans.map((p) => ({ ...p, nextSendAt: p.nextSendAt?.toISOString() ?? null })) },
        contextVersion,
      });
    });
  }
  console.log(`\n${totals.resumed} records ${apply ? "moved" : "to move"} (${totals.withReturnDay} with a return day still ahead), ${totals.leads} email enrollments back in sequence, ${totals.completed} completed, ${totals.skipped} skipped.`);
});
process.exit(0);
