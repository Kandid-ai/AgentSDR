/**
 * The decisions behind CRM meetings (src/lib/crm/meetings.ts), kept pure so
 * they can be tested: what a Cal.com delivery does to a record's meetings,
 * and whether a booking moves the record's stage. Import-free.
 */

/** The default sub-stages a meeting moves a record between (crm_subcategories.key, per pipeline). */
export const MEETING_STAGE_KEYS = {
  requested: "meeting_requested",
  booked: "meeting_booked",
  noShow: "meeting_no_show",
  done: "meeting_done",
} as const;

export type MeetingOutcomeAnswer = "showed" | "no_show";

/** The stage an answered "Did they show up?" moves the record to. */
export function outcomeStageKey(outcome: MeetingOutcomeAnswer): string {
  return outcome === "showed" ? MEETING_STAGE_KEYS.done : MEETING_STAGE_KEYS.noShow;
}

export type MeetingRow = {
  id: string;
  providerBookingUid: string | null;
  status: "booked" | "cancelled";
  startAt: Date;
  endAt: Date;
  outcome: "showed" | "no_show" | null;
};

export type MeetingEventTimes = {
  uid: string | null;
  /** On a reschedule, the booking it replaces. */
  rescheduleUid: string | null;
  startAt: Date;
  endAt: Date;
};

export type BookedDecision =
  | { action: "none"; reason: string }
  | { action: "insert" }
  | { action: "update"; meetingId: string; startChanged: boolean };

/** The meeting nobody has answered "Did they show up?" for yet, and that was not cancelled. */
export function isOpenMeeting(meeting: Pick<MeetingRow, "status" | "outcome">): boolean {
  return meeting.status === "booked" && meeting.outcome === null;
}

/**
 * A booking (created or rescheduled) against the record's meetings.
 * The same booking again (a Cal.com retry) changes nothing; a booking that
 * replaces the open meeting — the uid it reschedules, or simply an open
 * meeting still ahead — moves that meeting; otherwise it is a new meeting.
 * An open meeting already over keeps its "Did they show up?" question.
 */
export function bookedDecision(event: MeetingEventTimes, meetings: readonly MeetingRow[], now: Date): BookedDecision {
  const same = event.uid ? meetings.find((meeting) => meeting.providerBookingUid === event.uid) : undefined;
  if (same) {
    if (same.status === "cancelled") return { action: "none", reason: "That booking was cancelled" };
    if (same.startAt.getTime() === event.startAt.getTime() && same.endAt.getTime() === event.endAt.getTime()) {
      return { action: "none", reason: "Already recorded" };
    }
    if (same.outcome !== null) return { action: "none", reason: "That meeting is already answered" };
    return { action: "update", meetingId: same.id, startChanged: same.startAt.getTime() !== event.startAt.getTime() };
  }
  const open = meetings.filter(isOpenMeeting);
  const replaced = event.rescheduleUid ? open.find((meeting) => meeting.providerBookingUid === event.rescheduleUid) : undefined;
  const ahead = open.filter((meeting) => meeting.endAt.getTime() > now.getTime()).sort((a, b) => b.startAt.getTime() - a.startAt.getTime())[0];
  const target = replaced ?? ahead;
  if (target) return { action: "update", meetingId: target.id, startChanged: target.startAt.getTime() !== event.startAt.getTime() };
  return { action: "insert" };
}

/**
 * A cancellation: the meeting with its uid, or else the open one at the
 * cancelled time. A cancelled booking at another time (the old slot of a
 * reschedule) leaves the meeting as it is, and so does a second delivery.
 */
export function cancelledMeetingId(event: { uid: string | null; startAt: Date | null }, meetings: readonly MeetingRow[]): string | null {
  const same = event.uid ? meetings.find((meeting) => meeting.providerBookingUid === event.uid) : undefined;
  if (same) return isOpenMeeting(same) ? same.id : null;
  if (!event.startAt) return null;
  const at = event.startAt.getTime();
  return meetings.find((meeting) => isOpenMeeting(meeting) && meeting.startAt.getTime() === at)?.id ?? null;
}

export type RecordStage = {
  categoryKey: string | null;
  subcategoryId: string | null;
  /** The current sub-stage's stage_rank; null when it has none (or no sub-stage). */
  stageRank: number | null;
};

/**
 * A booking moves a record to Meeting Booked unless it is already there or
 * further along: a customer stays a customer, and a ranked stage at or past
 * Meeting Booked's rank stays. A record with no stage, or one off the funnel
 * (no rank), moves.
 */
export function bookingMovesStage(record: RecordStage, target: { id: string; stageRank: number | null }): boolean {
  if (record.subcategoryId === target.id) return false;
  if (record.categoryKey === "customer") return false;
  if (!record.subcategoryId || record.stageRank === null) return true;
  if (target.stageRank === null) return false;
  return record.stageRank < target.stageRank;
}

/** The stage-move note a booking leaves; drafts read it as what happened (stageMove.ts). */
export function bookingNote(kind: "booked" | "cancelled", startAt: Date | null): string {
  if (kind === "cancelled") return startAt ? `Cancelled the meeting booked for ${startAt.toISOString()} (Cal.com)` : "Cancelled the meeting (Cal.com)";
  return startAt ? `Booked a meeting for ${startAt.toISOString()} through the booking link (Cal.com)` : "Booked a meeting (Cal.com)";
}
