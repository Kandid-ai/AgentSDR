import { describe, expect, test } from "bun:test";
import { isCallFollowUpRecord, lastCallOf, type LastCallRow } from "./lastCall";

const base: LastCallRow = {
  id: "c1",
  status: "recorded",
  disposition: null,
  agentOutcome: null,
  transcriptSummary: null,
  startedAt: null,
  endedAt: null,
  createdAt: new Date("2026-11-20T10:00:00Z"),
};

describe("isCallFollowUpRecord", () => {
  test("a WhatsApp record with no reply is a call follow-up", () => {
    expect(isCallFollowUpRecord({ activeChannel: "whatsapp", latestInboundMessageId: null })).toBe(true);
  });
  test("a reply, or another channel, makes it an ordinary record", () => {
    expect(isCallFollowUpRecord({ activeChannel: "whatsapp", latestInboundMessageId: "m1" })).toBe(false);
    expect(isCallFollowUpRecord({ activeChannel: "email", latestInboundMessageId: null })).toBe(false);
  });
});

describe("lastCallOf", () => {
  test("no calls, nothing to show", () => {
    expect(lastCallOf([])).toBeNull();
  });
  test("the agent's outcome and summary win over the transcript's", () => {
    const call = lastCallOf([{
      ...base,
      agentOutcome: { outcome: "meeting_booked", summary: " Agreed to Thursday. " },
      transcriptSummary: "Long transcript summary",
      endedAt: new Date("2026-11-20T10:05:00Z"),
    }]);
    expect(call).toEqual({ id: "c1", at: "2026-11-20T10:05:00.000Z", outcome: "Meeting agreed", summary: "Agreed to Thursday." });
  });
  test("a rep's disposition labels a call the agent did not place", () => {
    expect(lastCallOf([{ ...base, disposition: "callback", transcriptSummary: "Asked to talk next week" }]))
      .toMatchObject({ outcome: "Call back later", summary: "Asked to talk next week" });
  });
  test("a later unanswered retry does not hide the conversation", () => {
    const call = lastCallOf([
      { ...base, id: "retry", status: "no_recording", createdAt: new Date("2026-11-22T10:00:00Z") },
      { ...base, id: "talk", agentOutcome: { outcome: "human_callback", summary: "Wants pricing" } },
    ]);
    expect(call).toMatchObject({ id: "talk", outcome: "Wants the team to call", summary: "Wants pricing" });
  });
  test("only unanswered attempts: the latest, as not connected", () => {
    expect(lastCallOf([{ ...base, id: "a", status: "no_recording" }, { ...base, id: "b", status: "failed" }]))
      .toEqual({ id: "a", at: "2026-11-20T10:00:00.000Z", outcome: "Not connected", summary: null });
  });
});
