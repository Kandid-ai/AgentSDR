import { describe, expect, test } from "bun:test";
import type { DialerLead } from "@/lib/calls/aiCampaigns/dialer";
import {
  EMPTY_WRAP_UP,
  NEXT_CALL_COUNTDOWN_SECONDS,
  PAUSED_BY_REP_NOTICE,
  STOPPED,
  callStageLabel,
  dialerReducer,
  isRunning,
  messageProblem,
  wrapUpProblem,
  wrapUpRequest,
  type CallEnd,
  type DialerPhase,
} from "./dialerMachine";

const lead: DialerLead = {
  contactId: "contact-1",
  personId: "person-1",
  name: "Asha Rao",
  company: "Acme",
  title: "Founder",
  phone: "+919800000000",
  stepLabel: "Call 1 of 4",
  stepNote: null,
  notes: null,
  status: "queued",
  lastNote: null,
  previousCalls: 0,
};

const calling: DialerPhase = { name: "calling", lead, callId: "call-1", numberName: "Sales 1" };
const end = (over: Partial<CallEnd> = {}): CallEnd => ({ stage: "ended", answeredAt: null, endedBy: null, message: null, ...over });

describe("start and dial results", () => {
  test("Start from stopped asks for a lead; Start while running changes nothing", () => {
    expect(dialerReducer(STOPPED, { type: "start" })).toEqual({ name: "dialing", prefer: null });
    expect(dialerReducer(calling, { type: "start" })).toBe(calling);
  });

  test("a queued call becomes the calling phase", () => {
    const next = dialerReducer({ name: "dialing", prefer: null }, { type: "dial-result", response: { kind: "calling", callId: "call-1", numberName: "Sales 1", lead } });
    expect(next).toEqual(calling);
  });

  test("waiting keeps going and retries, at least half a second out", () => {
    const waiting = dialerReducer({ name: "dialing", prefer: null }, { type: "dial-result", response: { kind: "waiting", message: "Number busy", retryInMs: 0 } });
    expect(waiting).toEqual({ name: "waiting", message: "Number busy", retryInMs: 500, prefer: null });
    expect(dialerReducer(waiting, { type: "retry" })).toEqual({ name: "dialing", prefer: null });
  });

  test("a picked-up call left without its wrap-up is wrapped up before the next call", () => {
    const next = dialerReducer({ name: "dialing", prefer: null }, { type: "dial-result", response: { kind: "wrap-up", callId: "call-1", lead } });
    expect(next).toEqual({ name: "wrap-up", callId: "call-1", lead });
  });

  test("a wait keeps the lead to prefer, so a redial is not overtaken while the last call settles", () => {
    const waiting = dialerReducer({ name: "dialing", prefer: "lead-1" }, { type: "dial-result", response: { kind: "waiting", message: "busy", retryInMs: 2000 } });
    expect(dialerReducer(waiting, { type: "retry" })).toEqual({ name: "dialing", prefer: "lead-1" });
  });

  test("idle stops, with the message and the next due time", () => {
    const next = dialerReducer({ name: "dialing", prefer: null }, { type: "dial-result", response: { kind: "idle", message: "Outside calling hours", nextDueAt: "2026-11-27T04:30:00.000Z" } });
    expect(next).toEqual({ name: "stopped", notice: "Outside calling hours", nextDueAt: "2026-11-27T04:30:00.000Z" });
  });

  test("a failed request stops with its message", () => {
    expect(dialerReducer({ name: "dialing", prefer: null }, { type: "dial-failed", message: "Network down" })).toEqual({ name: "stopped", notice: "Network down", nextDueAt: null });
  });

  test("a late dial result after pausing is ignored", () => {
    const paused = dialerReducer({ name: "dialing", prefer: null }, { type: "pause" });
    expect(paused.name).toBe("stopped");
    expect(dialerReducer(paused, { type: "dial-result", response: { kind: "calling", callId: "x", numberName: "n", lead } })).toBe(paused);
  });
});

describe("pause", () => {
  test("stops dialing, waiting and the countdown", () => {
    for (const phase of [{ name: "dialing", prefer: null }, { name: "waiting", message: "m", retryInMs: 1000, prefer: null }, { name: "countdown", lead, seconds: 2 }] as DialerPhase[]) {
      expect(dialerReducer(phase, { type: "pause" }).name).toBe("stopped");
    }
  });

  test("does not interrupt a call or a wrap-up", () => {
    expect(dialerReducer(calling, { type: "pause" })).toBe(calling);
    const wrap: DialerPhase = { name: "wrap-up", lead, callId: "call-1" };
    expect(dialerReducer(wrap, { type: "pause" })).toBe(wrap);
  });
});

describe("when a call ends", () => {
  test("picked up: wrap-up, whoever hung up", () => {
    for (const endedBy of [null, "rep"] as const) {
      expect(dialerReducer(calling, { type: "call-ended", end: end({ answeredAt: 1000, endedBy }) })).toEqual({ name: "wrap-up", lead, callId: "call-1" });
    }
  });

  test("picked up then an error still wraps up", () => {
    expect(dialerReducer(calling, { type: "call-ended", end: end({ stage: "error", answeredAt: 1000, message: "Lost the line" }) }).name).toBe("wrap-up");
  });

  test("the rep hung up before an answer: paused, with the notice", () => {
    expect(dialerReducer(calling, { type: "call-ended", end: end({ endedBy: "rep", message: "Call cancelled" }) })).toEqual({ name: "stopped", notice: PAUSED_BY_REP_NOTICE, nextDueAt: null });
  });

  test("not answered: a countdown, then the same lead is preferred", () => {
    let phase = dialerReducer(calling, { type: "call-ended", end: end({ message: "No answer" }) });
    expect(phase).toEqual({ name: "countdown", lead, seconds: NEXT_CALL_COUNTDOWN_SECONDS });
    for (let i = 0; i < NEXT_CALL_COUNTDOWN_SECONDS - 1; i++) phase = dialerReducer(phase, { type: "tick" });
    expect(phase).toEqual({ name: "countdown", lead, seconds: 1 });
    expect(dialerReducer(phase, { type: "tick" })).toEqual({ name: "dialing", prefer: "contact-1" });
  });

  test("an error before an answer pauses with its message and does not loop", () => {
    expect(dialerReducer(calling, { type: "call-ended", end: end({ stage: "error", message: "Station offline" }) })).toEqual({ name: "stopped", notice: "Station offline", nextDueAt: null });
  });

  test("a call that never started stops with the reason", () => {
    expect(dialerReducer(calling, { type: "call-not-started", message: "Microphone blocked" })).toEqual({ name: "stopped", notice: "Microphone blocked", nextDueAt: null });
    expect(dialerReducer(calling, { type: "call-not-started", message: null })).toMatchObject({ name: "stopped" });
  });

  test("an end that arrives when no call is on is ignored", () => {
    expect(dialerReducer(STOPPED, { type: "call-ended", end: end({ answeredAt: 5 }) })).toBe(STOPPED);
  });
});

describe("wrap-up", () => {
  const wrap: DialerPhase = { name: "wrap-up", lead, callId: "call-1" };

  test("Next lead carries on with no preferred lead; Pause stops", () => {
    expect(dialerReducer(wrap, { type: "wrap-up-saved", next: true })).toEqual({ name: "dialing", prefer: null });
    expect(dialerReducer(wrap, { type: "wrap-up-saved", next: false })).toEqual(STOPPED);
  });

  test("saving outside a wrap-up changes nothing", () => {
    expect(dialerReducer(calling, { type: "wrap-up-saved", next: true })).toBe(calling);
  });

  test("an outcome is required", () => {
    expect(wrapUpProblem(EMPTY_WRAP_UP)).toBe("Choose how the call went.");
  });

  test("call back needs a time; interested may have one; others take none", () => {
    expect(wrapUpProblem({ outcome: "call_back", when: "", notes: "" })).toBe("Choose when to call back.");
    expect(wrapUpProblem({ outcome: "call_back", when: "2026-11-27T16:00", notes: "" })).toBeNull();
    expect(wrapUpProblem({ outcome: "interested", when: "", notes: "" })).toBeNull();
    expect(wrapUpProblem({ outcome: "meeting", when: "", notes: "" })).toBeNull();
  });

  test("notes are capped", () => {
    expect(wrapUpProblem({ outcome: "meeting", when: "", notes: "x".repeat(2_001) })).not.toBeNull();
  });

  test("the request sends an ISO time only where the outcome takes one, and trims notes", () => {
    const when = "2026-11-27T16:00";
    expect(wrapUpRequest("call-1", { outcome: "call_back", when, notes: "  Thursday at 4  " })).toEqual({ callId: "call-1", outcome: "call_back", whenAt: new Date(when).toISOString(), notes: "Thursday at 4" });
    expect(wrapUpRequest("call-1", { outcome: "not_interested", when, notes: "" })).toEqual({ callId: "call-1", outcome: "not_interested", whenAt: null, notes: null });
    expect(wrapUpRequest("call-1", { outcome: "interested", when: "", notes: "" }).whenAt).toBeNull();
  });

  test("an invalid form cannot make a request", () => {
    expect(() => wrapUpRequest("call-1", EMPTY_WRAP_UP)).toThrow();
  });
});

describe("helpers", () => {
  test("isRunning is false only when stopped", () => {
    expect(isRunning(STOPPED)).toBe(false);
    expect(isRunning(calling)).toBe(true);
  });

  test("message problems", () => {
    expect(messageProblem("  ")).not.toBeNull();
    expect(messageProblem("x".repeat(1_001))).not.toBeNull();
    expect(messageProblem("Hi Asha")).toBeNull();
  });

  test("stage labels", () => {
    expect(callStageLabel("ringing")).toBe("Ringing…");
    expect(callStageLabel("on-call")).toBe("On call");
  });
});
