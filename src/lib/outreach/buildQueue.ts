/**
 * Daily queue build — Phase 1 of AgentSDR-app's two-phase send model, ported
 * from make-mailbox-queue-for-team.ts line-for-line (minus the team/domain
 * layer v2 doesn't have, and Redis lists swapped for the outreach_mailbox_queue
 * table). Runs once a day per organization, at the start of that
 * organization's day (the daily rollover, src/lib/scheduler/dailyRollover.ts;
 * /api/outreach/build-queue triggers it by hand or from an external cron),
 * before the frequent send tick starts draining it.
 *
 * Campaign priority first (src/lib/campaigns/priority.ts), then two passes
 * within each priority, Urgent to Low (planMailboxQueues):
 *   Pass A — leads already mid-sequence and due today get queued first,
 *     ordered by nextSendAt ASC then currentStep DESC: the most-overdue lead
 *     wins, and among equally-due leads the one furthest into its sequence
 *     (e.g. on its 4th follow-up) is queued ahead of one just starting out.
 *     Matches AgentSDR-app's `ORDER BY lead.nextFollowup, lead.followups DESC`.
 *   Pass B — brand-new (`pending`) leads round-robin fill whatever capacity
 *     is left over, same as AgentSDR-app's PENDING-lead fill pass. A campaign
 *     that names its mailboxes (`mailbox_ids`) only fills those.
 * A lower priority only gets what a higher one left, so a Low campaign's
 * follow-up can wait a day behind an Urgent campaign's new leads. With every
 * campaign on Medium (the default) this is the old two-pass fill.
 *
 * Also rebuilt during the day when an Urgent or High campaign gets leads or
 * starts (queueRefresh.ts); a rebuild re-plans the rest of the day without
 * granting a second daily allowance.
 */
import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { mailboxes, outreachCampaigns, outreachLeads, outreachMailboxQueue } from "./schema";
import { isSameLocalDay } from "./workingHours";
import { isMigrationControlPaused } from "@/lib/migration/controls";
import { inOrg, runInOrganization } from "@/lib/tenancy/scope";
import { leadsInOrg, orgMailboxIds } from "./orgScope";
import { planMailboxQueues, spareCapacityFor } from "./campaignMailboxes";

type MailboxCapacity = {
  mailboxId: string;
  queue: string[]; // lead ids, in order
  currentAvailableCapacity: number;
};

export type BuildQueueResult = {
  mailboxesConsidered: number;
  followUpsQueued: number;
  newLeadsQueued: number;
};

/**
 * Builds the queues of every organization that has a mailbox, or only of
 * `organizationIds` when given (the daily rollover passes one).
 */
export async function buildMailboxQueues(options: { organizationIds?: string[] } = {}): Promise<BuildQueueResult> {
  if (isMigrationControlPaused("emailOutbound")) {
    console.warn("[outreach/buildQueue] Email outbound is paused; queue rebuild skipped");
    return { mailboxesConsidered: 0, followUpsQueued: 0, newLeadsQueued: 0 };
  }

  // One run, one scope per organization: every organization's queue is
  // built from its own mailboxes, campaigns and leads and nothing else.
  const total: BuildQueueResult = { mailboxesConsidered: 0, followUpsQueued: 0, newLeadsQueued: 0 };
  const withMailboxes = await db.selectDistinct({ organizationId: mailboxes.organizationId }).from(mailboxes);
  const wanted = options.organizationIds ? new Set(options.organizationIds) : null;
  const organizations = wanted ? withMailboxes.filter((o) => wanted.has(o.organizationId)) : withMailboxes;
  for (const { organizationId } of organizations) {
    try {
      const part = await runInOrganization(organizationId, buildOrganizationQueues);
      total.mailboxesConsidered += part.mailboxesConsidered;
      total.followUpsQueued += part.followUpsQueued;
      total.newLeadsQueued += part.newLeadsQueued;
    } catch (err) {
      console.error(`[outreach/buildQueue] organization ${organizationId} failed:`, err);
    }
  }
  return total;
}

async function buildOrganizationQueues(): Promise<BuildQueueResult> {
  const now = new Date();

  // Wipe yesterday's leftover queue — safe to do unconditionally, a rebuild
  // always supersedes whatever was queued before.
  await db.delete(outreachMailboxQueue).where(inArray(outreachMailboxQueue.mailboxId, orgMailboxIds()));
  const connectedMailboxes = await db
    .select()
    .from(mailboxes)
    .where(and(inOrg(mailboxes), eq(mailboxes.status, "connected")))
    // A fixed order, so the round robin starts from the same mailbox every build.
    .orderBy(asc(mailboxes.createdAt), asc(mailboxes.emailAddress));

  // Reset each mailbox's daily counter only if it hasn't already been reset
  // today (in that mailbox's own working-hours timezone) — build-queue must
  // stay safe to re-run more than once in a day (duplicate cron fire, or a
  // manual re-run to pick up a newly-launched campaign) without granting a
  // second full daily allowance by re-zeroing todayEmailsSent.
  const mailboxesNeedingReset = connectedMailboxes.filter(
    (m) => !isSameLocalDay(m.sendCounterResetAt, now, m.workingHours.timezone),
  );
  if (mailboxesNeedingReset.length > 0) {
    await db
      .update(mailboxes)
      .set({ todayEmailsSent: 0, sendCounterResetAt: now })
      .where(and(inOrg(mailboxes), inArray(mailboxes.id, mailboxesNeedingReset.map((m) => m.id))));
  }
  const resetIds = new Set(mailboxesNeedingReset.map((m) => m.id));

  const activeCampaigns = await db.select().from(outreachCampaigns).where(and(inOrg(outreachCampaigns), eq(outreachCampaigns.status, "active")));
  if (activeCampaigns.length === 0 || connectedMailboxes.length === 0) {
    return { mailboxesConsidered: connectedMailboxes.length, followUpsQueued: 0, newLeadsQueued: 0 };
  }
  const activeCampaignIds = activeCampaigns.map((c) => c.id);

  const queues = new Map<string, MailboxCapacity>();
  for (const mailbox of connectedMailboxes) {
    const todaySent = resetIds.has(mailbox.id) ? 0 : mailbox.todayEmailsSent;
    queues.set(mailbox.id, {
      mailboxId: mailbox.id,
      queue: [],
      currentAvailableCapacity: Math.max(0, mailbox.dailySendLimit - todaySent),
    });
  }
  const mailboxIds = connectedMailboxes.map((m) => m.id);

  // Leads mid-sequence, due now, pinned to a connected mailbox: most-overdue
  // and deepest-into-sequence first within each priority.
  const dueFollowUps = await db
    .select({ id: outreachLeads.id, campaignId: outreachLeads.campaignId, mailboxId: outreachLeads.mailboxId })
    .from(outreachLeads)
    .where(
      and(
        leadsInOrg(),
        inArray(outreachLeads.mailboxId, mailboxIds),
        inArray(outreachLeads.campaignId, activeCampaignIds),
        or(eq(outreachLeads.sequenceStatus, "initial_sent"), eq(outreachLeads.sequenceStatus, "in_follow_up")),
        lte(outreachLeads.nextSendAt, now),
      ),
    )
    .orderBy(asc(outreachLeads.nextSendAt), desc(outreachLeads.currentStep));

  // Brand-new leads, loaded per campaign up to the capacity of the mailboxes
  // it may use (before any follow-up takes a slot: an upper bound, since
  // priority decides below who actually gets the room).
  const slots = Array.from(queues.values());
  const newLeads: Array<{ id: string; campaignId: string; createdAt: Date | null }> = [];
  for (const campaign of activeCampaigns) {
    const room = spareCapacityFor(campaign.mailboxIds ?? null, slots);
    if (room === 0) continue;
    const pending = await db
      .select({ id: outreachLeads.id, campaignId: outreachLeads.campaignId, createdAt: outreachLeads.createdAt })
      .from(outreachLeads)
      .where(
        and(
          leadsInOrg(),
          eq(outreachLeads.campaignId, campaign.id),
          eq(outreachLeads.sequenceStatus, "pending"),
          isNull(outreachLeads.mailboxId),
        ),
      )
      .orderBy(asc(outreachLeads.createdAt))
      .limit(room);
    newLeads.push(...pending);
  }

  const { followUpsQueued, newLeadsQueued } = planMailboxQueues({
    slots,
    followUps: dueFollowUps.flatMap((lead) => (lead.mailboxId ? [{ ...lead, mailboxId: lead.mailboxId }] : [])),
    newLeads,
    campaigns: activeCampaigns.map((campaign) => ({ id: campaign.id, priority: campaign.priority, mailboxIds: campaign.mailboxIds ?? null })),
  });

  const rows: Array<{ mailboxId: string; leadId: string; position: number }> = [];
  for (const cap of queues.values()) {
    cap.queue.forEach((leadId, index) => rows.push({ mailboxId: cap.mailboxId, leadId, position: index }));
  }
  if (rows.length > 0) {
    await db.insert(outreachMailboxQueue).values(rows)
      .onConflictDoNothing({ target: outreachMailboxQueue.leadId });
  }

  return { mailboxesConsidered: connectedMailboxes.length, followUpsQueued, newLeadsQueued };
}
