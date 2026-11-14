import { describe, expect, test } from "bun:test";
import { bookedDecision, bookingMovesStage, cancelledMeetingId, outcomeStageKey, type MeetingRow } from "./meetingRules";

const NOW = new Date("2026-11-14T10:00:00Z");
const HOUR = 3_600_000;
const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR);

const meeting = (overrides: Partial<MeetingRow> = {}): MeetingRow => ({
  id: "m1",
  providerBookingUid: "bk_1",
  status: "booked",
  startAt: at(24),
  endAt: at(24.5),
  outcome: null,
  ...overrides,
});
const event = (overrides: Partial<Parameters<typeof bookedDecision>[0]> = {}) => ({
  uid: "bk_1",
  rescheduleUid: null,
  startAt: at(24),
  endAt: at(24.5),
  ...overrides,
});

describe("bookedDecision", () => {
  test("a first booking is a new meeting", () => {
    expect(bookedDecision(event(), [], NOW)).toEqual({ action: "insert" });
  });

  test("the same delivery again changes nothing", () => {
    expect(bookedDecision(event(), [meeting()], NOW).action).toBe("none");
    expect(bookedDecision(event(), [meeting({ status: "cancelled" })], NOW).action).toBe("none");
  });

  test("the same booking at a new time moves it", () => {
    expect(bookedDecision(event({ startAt: at(48), endAt: at(48.5) }), [meeting()], NOW)).toEqual({ action: "update", meetingId: "m1", startChanged: true });
    expect(bookedDecision(event({ endAt: at(25) }), [meeting()], NOW)).toEqual({ action: "update", meetingId: "m1", startChanged: false });
  });

  test("a reschedule (new uid) moves the meeting it replaces, or the open one still ahead", () => {
    const moved = event({ uid: "bk_2", rescheduleUid: "bk_1", startAt: at(48), endAt: at(48.5) });
    expect(bookedDecision(moved, [meeting()], NOW)).toEqual({ action: "update", meetingId: "m1", startChanged: true });
    expect(bookedDecision({ ...moved, rescheduleUid: null }, [meeting()], NOW)).toEqual({ action: "update", meetingId: "m1", startChanged: true });
  });

  test("a meeting already over keeps its question; an answered or cancelled one is history", () => {
    const next = event({ uid: "bk_2", startAt: at(48), endAt: at(48.5) });
    expect(bookedDecision(next, [meeting({ startAt: at(-2), endAt: at(-1.5) })], NOW)).toEqual({ action: "insert" });
    expect(bookedDecision(next, [meeting({ outcome: "showed" })], NOW)).toEqual({ action: "insert" });
    expect(bookedDecision(next, [meeting({ status: "cancelled" })], NOW)).toEqual({ action: "insert" });
  });
});

describe("cancelledMeetingId", () => {
  test("by uid, while open", () => {
    expect(cancelledMeetingId({ uid: "bk_1", startAt: null }, [meeting()])).toBe("m1");
    expect(cancelledMeetingId({ uid: "bk_1", startAt: null }, [meeting({ status: "cancelled" })])).toBeNull();
    expect(cancelledMeetingId({ uid: "bk_1", startAt: null }, [meeting({ outcome: "no_show" })])).toBeNull();
  });

  test("else the open meeting at the cancelled time; the old slot of a reschedule is not it", () => {
    expect(cancelledMeetingId({ uid: "other", startAt: at(24) }, [meeting()])).toBe("m1");
    expect(cancelledMeetingId({ uid: "other", startAt: at(12) }, [meeting()])).toBeNull();
    expect(cancelledMeetingId({ uid: null, startAt: null }, [meeting()])).toBeNull();
  });
});

describe("bookingMovesStage", () => {
  const target = { id: "booked", stageRank: 30 };
  test("moves a record with no stage, an unranked one, or one before Meeting Booked", () => {
    expect(bookingMovesStage({ categoryKey: null, subcategoryId: null, stageRank: null }, target)).toBe(true);
    expect(bookingMovesStage({ categoryKey: "other", subcategoryId: "ooo", stageRank: null }, target)).toBe(true);
    expect(bookingMovesStage({ categoryKey: "interested", subcategoryId: "requested", stageRank: 20 }, target)).toBe(true);
  });

  test("leaves one already there or further along, and a customer", () => {
    expect(bookingMovesStage({ categoryKey: "interested", subcategoryId: "booked", stageRank: 30 }, target)).toBe(false);
    expect(bookingMovesStage({ categoryKey: "interested", subcategoryId: "done", stageRank: 40 }, target)).toBe(false);
    expect(bookingMovesStage({ categoryKey: "customer", subcategoryId: null, stageRank: null }, target)).toBe(false);
    expect(bookingMovesStage({ categoryKey: "interested", subcategoryId: "x", stageRank: 10 }, { id: "booked", stageRank: null })).toBe(false);
  });
});

test("an answer's stage", () => {
  expect(outcomeStageKey("showed")).toBe("meeting_done");
  expect(outcomeStageKey("no_show")).toBe("meeting_no_show");
});
