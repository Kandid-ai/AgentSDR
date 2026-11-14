import "server-only";

/**
 * Meetings for every lead in the CRM, from Cal.com (`crm_meetings`).
 *
 * The Cal.com webhook (src/lib/calls/aiCampaigns/booking.ts, already inside
 * the organization's scope) hands each booking event here after the AI
 * calling campaigns have had theirs. A booking finds its CRM record by:
 *   1. the record's booking code (`metadata[c]`, a `{{booking_link}}` sent
 *      from the CRM — src/lib/crm/bookingLink.ts);
 *   2. the Cal.com booking uid of a meeting already held (a reschedule or
 *      cancellation, or a retried delivery);
 *   3. an AI calling campaign lead's code (or legacy contact id): that
 *      person's CRM record, so one person has one meeting row;
 *   4. the attendee's email: that person's record in the default pipeline.
 *
 * Booked → the meeting is recorded (or the open one moved: a reschedule), and
 * a record not yet at Meeting Booked moves there with its sequence's first
 * message drafted, which also stops the chase it was on. Cancelled → the
 * meeting is closed and a record at Meeting Booked goes back to Meeting
 * Requested. Each step is idempotent: Cal.com retries deliveries.
 *
 * "Did they show up?" is asked in Action required once a meeting's end time
 * passes (actionGroups.server.ts); answering it is answerMeetingOutcome.
 */
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { people } from "@/lib/leads/schema";
import { callCampaignContacts, callCampaigns } from "@/lib/calls/schema";
import type { CalcomBookingEvent } from "@/lib/calls/aiCampaigns/engineRules";
import { currentOrganizationId, inOrg } from "@/lib/tenancy/scope";
import {
  bookedDecision,
  bookingMovesStage,
  bookingNote,
  cancelledMeetingId,
  isOpenMeeting,
  MEETING_STAGE_KEYS,
  outcomeStageKey,
  type MeetingOutcomeAnswer,
  type MeetingRow,
} from "./meetingRules";
import { moveRecordStageInTransaction } from "./operations";
import { lockCrmRecord, type CrmRecord } from "./records";
import { CrmConflictError, CrmNotFoundError, type CrmExecutor, type CrmTransaction, withCrmTransaction } from "./repository";
import { crmMeetings, crmPipelines, crmRecords, crmSubcategories, type CrmCategoryKey } from "./schema";
import { rescheduleMeetingStepsInTransaction } from "./sequences";

/** Cal.com always sends an end time; this covers a delivery that does not. */
const DEFAULT_MEETING_MS = 30 * 60 * 1000;

export type CrmMeetingEventResult = {
  recordId: string | null;
  action: "unmatched" | "ignored" | "booked" | "rescheduled" | "cancelled";
  stageMoved: boolean;
};

// --- matching --------------------------------------------------------------------

/** The record in the organization's default pipeline for any of these people, the most recently active first. */
async function defaultPipelineRecordFor(personIds: string[]): Promise<string | null> {
  if (!personIds.length) return null;
  const [row] = await db
    .select({ id: crmRecords.id })
    .from(crmRecords)
    .innerJoin(crmPipelines, eq(crmPipelines.id, crmRecords.pipelineId))
    .where(and(inOrg(crmRecords), inOrg(crmPipelines), eq(crmPipelines.isDefault, true), inArray(crmRecords.personId, personIds)))
    .orderBy(sql`${crmRecords.lastInboundAt} desc nulls last`, desc(crmRecords.createdAt))
    .limit(1);
  return row?.id ?? null;
}

/** The CRM record a Cal.com booking names; null when none (see the header for the order). */
export async function matchCrmRecordForBooking(event: CalcomBookingEvent): Promise<string | null> {
  if (event.bookingCode) {
    const [byCode] = await db
      .select({ id: crmRecords.id })
      .from(crmRecords)
      .where(and(inOrg(crmRecords), eq(crmRecords.bookingCode, event.bookingCode)))
      .limit(1);
    if (byCode) return byCode.id;
  }

  const uids = [event.uid, event.rescheduleUid].filter((uid): uid is string => !!uid);
  if (uids.length) {
    const [byUid] = await db
      .select({ recordId: crmMeetings.crmRecordId })
      .from(crmMeetings)
      .where(and(inOrg(crmMeetings), eq(crmMeetings.provider, "calcom"), inArray(crmMeetings.providerBookingUid, uids)))
      .orderBy(desc(crmMeetings.createdAt))
      .limit(1);
    if (byUid) return byUid.recordId;
  }

  const named = event.bookingCode
    ? eq(callCampaignContacts.aiBookingCode, event.bookingCode)
    : event.contactId
      ? eq(callCampaignContacts.id, event.contactId)
      : null;
  if (named) {
    const contacts = await db
      .select({ personId: callCampaignContacts.personId })
      .from(callCampaignContacts)
      .innerJoin(callCampaigns, eq(callCampaigns.id, callCampaignContacts.campaignId))
      .where(and(inOrg(callCampaigns), named));
    const recordId = await defaultPipelineRecordFor([...new Set(contacts.map((contact) => contact.personId))]);
    if (recordId) return recordId;
  }

  if (event.emails.length) {
    const matched = await db
      .select({ id: people.id })
      .from(people)
      .where(and(inOrg(people), isNotNull(people.email), inArray(sql`lower(${people.email})`, event.emails)));
    return defaultPipelineRecordFor(matched.map((person) => person.id));
  }
  return null;
}

// --- stages ----------------------------------------------------------------------

type StageRow = { id: string; categoryKey: string; stageRank: number | null };

/** The active sub-stage with this key in the pipeline (crm_subcategories is reached through the record's scoped pipeline). */
async function stageByKey(executor: CrmExecutor, pipelineId: string, key: string): Promise<StageRow | null> {
  const [row] = await executor
    .select({ id: crmSubcategories.id, categoryKey: crmSubcategories.categoryKey, stageRank: crmSubcategories.stageRank })
    .from(crmSubcategories)
    .where(and(eq(crmSubcategories.pipelineId, pipelineId), eq(crmSubcategories.key, key), eq(crmSubcategories.active, true)))
    .limit(1);
  return row ?? null;
}

async function stageRankOf(executor: CrmExecutor, subcategoryId: string | null): Promise<number | null> {
  if (!subcategoryId) return null;
  const [row] = await executor
    .select({ stageRank: crmSubcategories.stageRank })
    .from(crmSubcategories)
    .where(eq(crmSubcategories.id, subcategoryId))
    .limit(1);
  return row?.stageRank ?? null;
}

/**
 * Moves the record to `stage` with its sequence's first message drafted. In
 * a savepoint: a move the CRM refuses (no reply on the record to continue
 * from, its reply not classified yet, the context changed) leaves the
 * meeting recorded and is logged rather than failing the caller.
 */
async function tryMoveStage(
  tx: CrmTransaction,
  record: CrmRecord,
  stage: StageRow,
  input: { note: string; source: "human" | "integration"; actorRef?: string | null; occurredAt?: Date },
): Promise<{ moved: true } | { moved: false; reason: string }> {
  if (record.subcategoryId === stage.id) return { moved: false, reason: "The record is already at this stage" };
  if (!record.latestInboundMessageId) {
    console.info(`[crm-meetings] record ${record.id} has no reply to continue from; stage left as it is`);
    return { moved: false, reason: "The record has no reply to continue from, so its stage was left as it is" };
  }
  try {
    await tx.transaction((savepoint) =>
      moveRecordStageInTransaction(savepoint, {
        recordId: record.id,
        categoryKey: stage.categoryKey as CrmCategoryKey,
        subcategoryId: stage.id,
        expectedContextVersion: record.contextVersion,
        occurredAt: input.occurredAt,
        note: input.note,
        next: "reply",
        source: input.source,
        actorRef: input.actorRef,
      }),
    );
    return { moved: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[crm-meetings] record ${record.id}: stage move to ${stage.id} skipped: ${reason}`);
    return { moved: false, reason };
  }
}

// --- Cal.com events --------------------------------------------------------------

async function meetingsOf(tx: CrmTransaction, recordId: string): Promise<MeetingRow[]> {
  return tx
    .select({
      id: crmMeetings.id,
      providerBookingUid: crmMeetings.providerBookingUid,
      status: crmMeetings.status,
      startAt: crmMeetings.startAt,
      endAt: crmMeetings.endAt,
      outcome: crmMeetings.outcome,
    })
    .from(crmMeetings)
    .where(and(inOrg(crmMeetings), eq(crmMeetings.crmRecordId, recordId)))
    .orderBy(desc(crmMeetings.startAt))
    .for("update");
}

async function applyBooked(tx: CrmTransaction, record: CrmRecord, event: CalcomBookingEvent): Promise<CrmMeetingEventResult> {
  const result = (action: CrmMeetingEventResult["action"], stageMoved = false): CrmMeetingEventResult => ({ recordId: record.id, action, stageMoved });
  if (!event.startTime) return result("ignored");
  const startAt = event.startTime;
  const endAt = event.endTime && event.endTime.getTime() > startAt.getTime() ? event.endTime : new Date(startAt.getTime() + DEFAULT_MEETING_MS);
  const now = new Date();
  const decision = bookedDecision({ uid: event.uid, rescheduleUid: event.rescheduleUid, startAt, endAt }, await meetingsOf(tx, record.id), now);

  if (decision.action === "none") return result("ignored");
  if (decision.action === "update") {
    await tx
      .update(crmMeetings)
      .set({ ...(event.uid ? { providerBookingUid: event.uid } : {}), startAt, endAt, updatedAt: now })
      .where(and(inOrg(crmMeetings), eq(crmMeetings.id, decision.meetingId)));
    if (decision.startChanged) await rescheduleMeetingStepsInTransaction(tx, record.id, startAt);
    return result("rescheduled");
  }

  const [inserted] = await tx
    .insert(crmMeetings)
    .values({
      organizationId: currentOrganizationId(),
      crmRecordId: record.id,
      personId: record.personId,
      provider: "calcom",
      providerBookingUid: event.uid,
      status: "booked",
      startAt,
      endAt,
      bookedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: crmMeetings.id });
  // The uid is already held (a concurrent delivery got there first).
  if (!inserted) return result("ignored");

  const target = await stageByKey(tx, record.pipelineId, MEETING_STAGE_KEYS.booked);
  const current = { categoryKey: record.categoryKey, subcategoryId: record.subcategoryId, stageRank: await stageRankOf(tx, record.subcategoryId) };
  if (target && bookingMovesStage(current, target)) {
    const move = await tryMoveStage(tx, record, target, { note: bookingNote("booked", startAt), source: "integration", actorRef: "Cal.com" });
    if (move.moved) return result("booked", true);
  }
  // Not moved: the record's current sequence still learns when the meeting is.
  await rescheduleMeetingStepsInTransaction(tx, record.id, startAt);
  return result("booked");
}

async function applyCancelled(tx: CrmTransaction, record: CrmRecord, event: CalcomBookingEvent): Promise<CrmMeetingEventResult> {
  const meetings = await meetingsOf(tx, record.id);
  const meetingId = cancelledMeetingId({ uid: event.uid, startAt: event.startTime }, meetings);
  if (!meetingId) return { recordId: record.id, action: "ignored", stageMoved: false };
  const now = new Date();
  await tx
    .update(crmMeetings)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
    .where(and(inOrg(crmMeetings), eq(crmMeetings.id, meetingId)));
  await rescheduleMeetingStepsInTransaction(tx, record.id, null);

  const stillBooked = meetings.some((meeting) => meeting.id !== meetingId && isOpenMeeting(meeting) && meeting.endAt.getTime() > now.getTime());
  const booked = await stageByKey(tx, record.pipelineId, MEETING_STAGE_KEYS.booked);
  if (stillBooked || !booked || record.subcategoryId !== booked.id) return { recordId: record.id, action: "cancelled", stageMoved: false };
  const requested = await stageByKey(tx, record.pipelineId, MEETING_STAGE_KEYS.requested);
  if (!requested) return { recordId: record.id, action: "cancelled", stageMoved: false };
  const cancelledAt = meetings.find((meeting) => meeting.id === meetingId)?.startAt ?? null;
  const move = await tryMoveStage(tx, record, requested, { note: bookingNote("cancelled", cancelledAt), source: "integration", actorRef: "Cal.com" });
  return { recordId: record.id, action: "cancelled", stageMoved: move.moved };
}

/**
 * One Cal.com booking event against the CRM. Runs inside the organization's
 * scope (the webhook's). Idempotent: the record is locked and its meetings
 * read FOR UPDATE, so a retried delivery finds its own work done.
 */
export async function handleCrmMeetingEvent(event: CalcomBookingEvent): Promise<CrmMeetingEventResult> {
  const recordId = await matchCrmRecordForBooking(event);
  if (!recordId) return { recordId: null, action: "unmatched", stageMoved: false };
  return withCrmTransaction(async (tx) => {
    const record = await lockCrmRecord(tx, recordId);
    return event.kind === "booked" ? applyBooked(tx, record, event) : applyCancelled(tx, record, event);
  });
}

// --- "Did they show up?" ---------------------------------------------------------

export type MeetingOutcomeResult = {
  meetingId: string;
  outcome: MeetingOutcomeAnswer;
  stageMoved: boolean;
  /** Why the stage was left as it is, when it was. */
  stageNote: string | null;
};

/**
 * A person answers "Did they show up?": the meeting keeps the answer (and
 * who gave it), and the record moves to Meeting Done or Meeting No-show with
 * that stage's first message drafted — skipped, not failed, when the
 * organization has no such stage or the CRM refuses the move.
 */
export async function answerMeetingOutcome(input: {
  recordId: string;
  meetingId: string;
  outcome: MeetingOutcomeAnswer;
  actorName: string;
}): Promise<MeetingOutcomeResult> {
  return withCrmTransaction(async (tx) => {
    const record = await lockCrmRecord(tx, input.recordId);
    const [meeting] = await tx
      .select()
      .from(crmMeetings)
      .where(and(inOrg(crmMeetings), eq(crmMeetings.id, input.meetingId), eq(crmMeetings.crmRecordId, record.id)))
      .limit(1)
      .for("update");
    if (!meeting) throw new CrmNotFoundError("Meeting", input.meetingId);
    if (meeting.status !== "booked") throw new CrmConflictError("This meeting was cancelled");
    if (meeting.outcome) throw new CrmConflictError("Someone already answered whether they showed up");
    const now = new Date();
    if (meeting.startAt.getTime() > now.getTime()) throw new CrmConflictError("This meeting has not started yet");
    await tx
      .update(crmMeetings)
      .set({ outcome: input.outcome, outcomeAt: now, outcomeBy: input.actorName, updatedAt: now })
      .where(and(inOrg(crmMeetings), eq(crmMeetings.id, meeting.id)));

    const stage = await stageByKey(tx, record.pipelineId, outcomeStageKey(input.outcome));
    if (!stage) return { meetingId: meeting.id, outcome: input.outcome, stageMoved: false, stageNote: "Your pipeline has no stage for this, so the stage was left as it is" };
    const note = input.outcome === "showed" ? "The meeting took place" : "They did not show up to the meeting";
    const move = await tryMoveStage(tx, record, stage, {
      note,
      source: "human",
      actorRef: input.actorName,
      occurredAt: meeting.endAt.getTime() <= now.getTime() ? meeting.endAt : now,
    });
    return { meetingId: meeting.id, outcome: input.outcome, stageMoved: move.moved, stageNote: move.moved ? null : move.reason };
  });
}

/** A record's meetings, newest first, for its page. */
export async function listRecordMeetings(recordId: string) {
  return db
    .select({
      id: crmMeetings.id,
      provider: crmMeetings.provider,
      status: crmMeetings.status,
      startAt: crmMeetings.startAt,
      endAt: crmMeetings.endAt,
      bookedAt: crmMeetings.bookedAt,
      cancelledAt: crmMeetings.cancelledAt,
      outcome: crmMeetings.outcome,
      outcomeAt: crmMeetings.outcomeAt,
      outcomeBy: crmMeetings.outcomeBy,
    })
    .from(crmMeetings)
    .where(and(inOrg(crmMeetings), eq(crmMeetings.crmRecordId, recordId)))
    .orderBy(desc(crmMeetings.startAt));
}
