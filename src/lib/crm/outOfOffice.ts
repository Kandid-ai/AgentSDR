import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { outreachLeads, outreachMailboxQueue, type OutreachLeadStatus } from "@/lib/outreach/schema";
import { leadsInOrg } from "@/lib/outreach/orgScope";
import { whatsappCampaignLeads, whatsappCampaigns } from "@/lib/whatsapp/schema";
import type { WhatsappCampaignLeadStatus } from "@/lib/whatsapp/campaigns/contract";
import { wallTime, wallTimeToInstant } from "@/lib/scheduler/slots";
import { inOrg } from "@/lib/tenancy/scope";
import { appendCrmEvent } from "./events";
import { CrmConflictError, type CrmTransaction } from "./repository";
import { crmEvents, crmRecords, crmSequenceRuns, crmSequenceStepRuns, crmSequenceSteps } from "./schema";
import { startSequenceRunInTransaction } from "./sequences";

/**
 * An out-of-office reply is not a conversation. Every inbound reply stops the
 * person's cold outreach the moment it arrives (ingestInboundReplyInTransaction),
 * before anyone knows what it says; when the classifier then reads it as Out
 * of Office, what that reply stopped is put back as if it had never come —
 * with the next message moved to the day the person is back when the notice
 * says when that is — and nothing reaches Action required.
 *
 * So the reply is able to put things back, ingest writes down what it stopped
 * (`PausedOutreach`) as a crm_events row keyed by the message. Only email and
 * WhatsApp campaigns and the record's own CRM follow-ups are resumed; LinkedIn
 * and AI calling stay stopped (an auto-reply does not arrive there).
 */
export const OUTREACH_PAUSED_EVENT = "outreach.paused_by_reply";

export type PausedOutreach = {
  emailLeads: Array<{ id: string; sequenceStatus: OutreachLeadStatus; nextSendAt: string | null }>;
  /** Today's mailbox queue entries the reply removed. */
  emailQueue: Array<{ leadId: string; mailboxId: string; position: number }>;
  whatsappLeads: Array<{ id: string; status: WhatsappCampaignLeadStatus; nextSendAt: string | null }>;
  /** The record's CRM follow-ups that were waiting to go out. */
  crmRun: { sequenceId: string; nextStepPosition: number; dueAt: string } | null;
  /**
   * The record's run was still on its reply step: a person's earlier reply
   * is unanswered, so the record must reach a person whatever this one says.
   */
  pendingReply: boolean;
};

const UNSENT_STEP_STATUSES = ["scheduled", "drafting", "awaiting_review", "failed"] as const;
const MAX_OUT_OF_OFFICE_MS = 366 * 24 * 60 * 60 * 1000;

/** What the reply is about to stop, read inside ingest's transaction before it stops it. */
export async function capturePausedOutreachInTransaction(
  tx: CrmTransaction,
  input: { recordId: string; emailLeadIds: string[]; whatsappLeadIds: string[] },
): Promise<PausedOutreach> {
  const emailLeads = input.emailLeadIds.length
    ? await tx.select({ id: outreachLeads.id, sequenceStatus: outreachLeads.sequenceStatus, nextSendAt: outreachLeads.nextSendAt })
      .from(outreachLeads).where(inArray(outreachLeads.id, input.emailLeadIds))
    : [];
  const emailQueue = input.emailLeadIds.length
    ? await tx.select({ leadId: outreachMailboxQueue.leadId, mailboxId: outreachMailboxQueue.mailboxId, position: outreachMailboxQueue.position })
      .from(outreachMailboxQueue).where(inArray(outreachMailboxQueue.leadId, input.emailLeadIds))
    : [];
  const whatsappLeads = input.whatsappLeadIds.length
    ? await tx.select({ id: whatsappCampaignLeads.id, status: whatsappCampaignLeads.status, nextSendAt: whatsappCampaignLeads.nextSendAt })
      .from(whatsappCampaignLeads).where(inArray(whatsappCampaignLeads.id, input.whatsappLeadIds))
    : [];
  const nextStep = await tx.select({
    sequenceId: crmSequenceRuns.sequenceId,
    position: crmSequenceSteps.position,
    dueAt: crmSequenceStepRuns.dueAt,
  })
    .from(crmSequenceRuns)
    .innerJoin(crmSequenceStepRuns, eq(crmSequenceStepRuns.sequenceRunId, crmSequenceRuns.id))
    .innerJoin(crmSequenceSteps, eq(crmSequenceSteps.id, crmSequenceStepRuns.sequenceStepId))
    .where(and(
      eq(crmSequenceRuns.crmRecordId, input.recordId),
      eq(crmSequenceRuns.status, "active"),
      inArray(crmSequenceStepRuns.status, [...UNSENT_STEP_STATUSES]),
    ))
    .orderBy(asc(crmSequenceSteps.position))
    .limit(1);
  const step = nextStep[0];
  return {
    emailLeads: emailLeads.map((lead) => ({ ...lead, nextSendAt: lead.nextSendAt?.toISOString() ?? null })),
    emailQueue,
    whatsappLeads: whatsappLeads.map((lead) => ({ ...lead, nextSendAt: lead.nextSendAt?.toISOString() ?? null })),
    crmRun: step && step.position > 1
      ? { sequenceId: step.sequenceId, nextStepPosition: step.position, dueAt: step.dueAt.toISOString() }
      : null,
    pendingReply: step?.position === 1,
  };
}

export function hasPausedOutreach(paused: PausedOutreach): boolean {
  return paused.emailLeads.length > 0 || paused.whatsappLeads.length > 0 || paused.crmRun !== null || paused.pendingReply;
}

/**
 * The first moment the person is back: the start of the day the classifier
 * read from the notice, in the organization's time zone. Null when the
 * notice gives no usable date — none, unparseable, today or earlier, or
 * more than a year out — and outreach then carries on as it would have.
 */
export function outOfOfficeReturnAt(suggested: string | null | undefined, timeZone: string, now: Date): Date | null {
  if (!suggested) return null;
  const instant = Date.parse(suggested);
  if (!Number.isFinite(instant)) return null;
  let startOfDay: number;
  try {
    const wall = wallTime(timeZone, instant);
    startOfDay = wallTimeToInstant(timeZone, wall.year, wall.month, wall.day, 0, 0);
  } catch {
    return null;
  }
  if (startOfDay <= now.getTime() || startOfDay - now.getTime() > MAX_OUT_OF_OFFICE_MS) return null;
  return new Date(startOfDay);
}

/**
 * When the next message goes out after an out-of-office: when it was due,
 * unless the person is back later than that — then on the day they are back.
 */
export function resumedSendAt(originalDueAt: Date | null, returnAt: Date | null): Date | null {
  if (!returnAt) return originalDueAt;
  if (!originalDueAt) return null;
  return originalDueAt > returnAt ? originalDueAt : returnAt;
}

export type OutOfOfficeResumption = {
  returnAt: Date | null;
  emailLeadsResumed: number;
  whatsappLeadsResumed: number;
  crmFollowUpAt: Date | null;
};

/**
 * Puts back what the out-of-office reply `messageId` stopped. Returns null
 * when the record must go to a person after all (an earlier reply of theirs
 * is still unanswered); the caller then carries on with the normal reply flow.
 * The record must be locked by the caller and be on its current context.
 */
export async function resumeOutreachAfterOutOfOfficeInTransaction(
  tx: CrmTransaction,
  input: {
    record: typeof crmRecords.$inferSelect;
    conversationId: string;
    messageId: string;
    suggestedReturnAt: string | null;
    timeZone: string;
    now?: Date;
  },
): Promise<OutOfOfficeResumption | null> {
  const now = input.now ?? new Date();
  const { record } = input;
  const [event] = await tx.select({ fromData: crmEvents.fromData }).from(crmEvents)
    .where(and(
      inOrg(crmEvents),
      eq(crmEvents.crmRecordId, record.id),
      eq(crmEvents.eventType, OUTREACH_PAUSED_EVENT),
      sql`${crmEvents.meta}->>'messageId' = ${input.messageId}`,
    ))
    .limit(1);
  const paused = (event?.fromData ?? null) as PausedOutreach | null;
  if (paused?.pendingReply) return null;

  const returnAt = outOfOfficeReturnAt(input.suggestedReturnAt, input.timeZone, now);
  let emailLeadsResumed = 0;
  let whatsappLeadsResumed = 0;

  for (const lead of paused?.emailLeads ?? []) {
    const nextSendAt = resumedSendAt(lead.nextSendAt ? new Date(lead.nextSendAt) : null, returnAt);
    const [resumed] = await tx.update(outreachLeads)
      .set({ sequenceStatus: lead.sequenceStatus, nextSendAt, updatedAt: now })
      .where(and(leadsInOrg(), eq(outreachLeads.id, lead.id), eq(outreachLeads.sequenceStatus, "reply_received")))
      .returning({ id: outreachLeads.id });
    if (!resumed) continue;
    emailLeadsResumed += 1;
    // It was in today's send queue and is still due: give its place back
    // rather than wait for tomorrow's queue build.
    const queued = paused?.emailQueue.find((entry) => entry.leadId === lead.id);
    if (queued && (!nextSendAt || nextSendAt <= now)) {
      await tx.insert(outreachMailboxQueue).values(queued).onConflictDoNothing();
    }
  }

  for (const lead of paused?.whatsappLeads ?? []) {
    const nextSendAt = resumedSendAt(lead.nextSendAt ? new Date(lead.nextSendAt) : null, returnAt);
    const [resumed] = await tx.update(whatsappCampaignLeads)
      .set({ status: lead.status, nextSendAt, repliedAt: null, updatedAt: now })
      .where(and(
        inArray(
          whatsappCampaignLeads.campaignId,
          tx.select({ id: whatsappCampaigns.id }).from(whatsappCampaigns).where(inOrg(whatsappCampaigns)),
        ),
        eq(whatsappCampaignLeads.id, lead.id),
        eq(whatsappCampaignLeads.status, "replied"),
      ))
      .returning({ id: whatsappCampaignLeads.id });
    if (resumed) whatsappLeadsResumed += 1;
  }

  let crmFollowUpAt: Date | null = null;
  if (paused?.crmRun) {
    crmFollowUpAt = await resumeCrmFollowUps(tx, {
      record,
      conversationId: input.conversationId,
      messageId: input.messageId,
      crmRun: paused.crmRun,
      returnAt,
      now,
    });
  }

  await tx.update(crmRecords).set({
    workflowState: crmFollowUpAt ? "waiting" : "idle",
    nextActionAt: crmFollowUpAt,
    updatedAt: now,
  }).where(eq(crmRecords.id, record.id));

  await appendCrmEvent(tx, {
    personId: record.personId,
    crmRecordId: record.id,
    pipelineId: record.pipelineId,
    eventType: "out_of_office.resumed",
    actorType: "ai",
    toData: {
      returnAt: returnAt?.toISOString() ?? null,
      emailLeadsResumed,
      whatsappLeadsResumed,
      crmFollowUpAt: crmFollowUpAt?.toISOString() ?? null,
    },
    meta: { messageId: input.messageId, suggestedReturnAt: input.suggestedReturnAt },
    contextVersion: record.contextVersion,
  });
  return { returnAt, emailLeadsResumed, whatsappLeadsResumed, crmFollowUpAt };
}

/**
 * Restarts the record's interrupted follow-ups at the step that had not gone
 * out, keeping their spacing, with the first due when it was due or on the
 * return day if later. Null when the stage's sequence no longer has that step.
 */
async function resumeCrmFollowUps(
  tx: CrmTransaction,
  input: {
    record: typeof crmRecords.$inferSelect;
    conversationId: string;
    messageId: string;
    crmRun: NonNullable<PausedOutreach["crmRun"]>;
    returnAt: Date | null;
    now: Date;
  },
): Promise<Date | null> {
  let started: Awaited<ReturnType<typeof startSequenceRunInTransaction>>;
  try {
    started = await startSequenceRunInTransaction(tx, {
      recordId: input.record.id,
      conversationId: input.conversationId,
      triggerMessageId: input.messageId,
      expectedContextVersion: input.record.contextVersion,
      startStepPosition: input.crmRun.nextStepPosition,
      actorType: "ai",
    });
  } catch (error) {
    if (error instanceof CrmConflictError) return null;
    throw error;
  }
  const first = started?.stepRuns[0];
  if (!started || !first) return null;
  const target = resumedSendAt(new Date(input.crmRun.dueAt), input.returnAt) ?? first.dueAt;
  const shiftMs = target.getTime() - first.dueAt.getTime();
  if (shiftMs !== 0) {
    await tx.update(crmSequenceStepRuns)
      .set({ dueAt: sql`${crmSequenceStepRuns.dueAt} + make_interval(secs => ${shiftMs / 1000})`, updatedAt: input.now })
      .where(eq(crmSequenceStepRuns.sequenceRunId, started.run.id));
  }
  return target;
}
