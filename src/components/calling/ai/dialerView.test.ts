import { describe, expect, test } from "bun:test";
import type { DialerLead } from "@/lib/calls/aiCampaigns/dialer";
import { STOPPED, type DialerPhase } from "./dialerMachine";
import { answeredOn, callEndFor, dialerCampaignHref, dialerLeadPhone, pipLayout, startRefusal, type ObservedCall } from "./dialerView";

const lead = { contactId: "contact-1", name: "Asha Rao", company: "Acme", phone: "+919800000000" } as unknown as DialerLead;
const campaign = { id: "camp-1", name: "Beauty D2C" };
const calling: DialerPhase = { name: "calling", lead, callId: "call-1", numberName: "Number 1" };
const call = (update: Partial<ObservedCall> = {}): ObservedCall => ({ callId: "call-1", stage: "ringing", answeredAt: null, endedBy: null, message: null, ...update });

describe("startRefusal", () => {
  test("nothing running, or the same campaign: allowed", () => {
    expect(startRefusal(null, STOPPED, "camp-1")).toBeNull();
    expect(startRefusal(campaign, { name: "dialing", prefer: null }, "camp-1")).toBeNull();
  });
  test("another campaign's stopped dialer does not block", () => {
    expect(startRefusal(campaign, { name: "stopped", notice: "Paused — you hung up.", nextDueAt: null }, "camp-2")).toBeNull();
  });
  test("another campaign's working dialer is refused, by name", () => {
    expect(startRefusal(campaign, calling, "camp-2")).toContain("Beauty D2C");
    expect(startRefusal(campaign, { name: "countdown", lead, seconds: 2 }, "camp-2")).not.toBeNull();
  });
});

describe("callEndFor", () => {
  test("only the started call, once it is over", () => {
    expect(callEndFor(calling, "call-1", call())).toBeNull();
    expect(callEndFor(calling, null, call({ stage: "ended" }))).toBeNull();
    expect(callEndFor(STOPPED, "call-1", call({ stage: "ended" }))).toBeNull();
    expect(callEndFor(calling, "call-1", null)).toBeNull();
  });
  test("an earlier call still on the bar is not this one", () => {
    expect(callEndFor(calling, "call-1", call({ callId: "call-0", stage: "ended" }))).toBeNull();
  });
  test("a call that failed before it had an id is this one", () => {
    expect(callEndFor(calling, "call-1", call({ callId: null, stage: "error", message: "No microphone" }))).toEqual({
      end: { stage: "error", answeredAt: null, endedBy: null, message: "No microphone" },
      check: false,
    });
  });
  test("picked up, hung up by the rep, or failed: settled without asking", () => {
    expect(callEndFor(calling, "call-1", call({ stage: "ended", answeredAt: 5 }))?.check).toBe(false);
    expect(callEndFor(calling, "call-1", call({ stage: "ended", endedBy: "rep" }))?.check).toBe(false);
  });
  test("looks unanswered: ask the call first", () => {
    expect(callEndFor(calling, "call-1", call({ stage: "ended", message: "Not answered" }))?.check).toBe(true);
  });
});

describe("answeredOn", () => {
  test("recorded, in progress, or a phase with a length", () => {
    expect(answeredOn({ status: "recorded", livePhase: null } as never)).toBe(true);
    expect(answeredOn({ status: "in_progress", livePhase: null } as never)).toBe(true);
    expect(answeredOn({ status: "processing", livePhase: { kind: "done", durationMs: 12_000 } } as never)).toBe(true);
    expect(answeredOn({ status: "processing", livePhase: { kind: "done", durationMs: 0 } } as never)).toBe(false);
    expect(answeredOn({ status: "failed", livePhase: { kind: "not-answered" } } as never)).toBe(false);
  });
});

describe("pipLayout", () => {
  test("no dialer, no call: nothing", () => {
    expect(pipLayout(STOPPED, null, null)).toEqual({ live: false, showCall: false, dialer: null, showWrapUp: false });
  });
  test("a call outside the dialer shows on its own", () => {
    const layout = pipLayout(STOPPED, null, { stage: "ringing" });
    expect(layout.showCall).toBe(true);
    expect(layout.dialer).toBeNull();
  });
  test("on call: green, and the dialer row does not repeat the call", () => {
    const layout = pipLayout(calling, campaign, { stage: "on-call" });
    expect(layout.live).toBe(true);
    expect(layout.showCall).toBe(true);
    expect(layout.dialer).toEqual({ campaignName: "Beauty D2C", text: null, button: null, dismissible: false });
  });
  test("wrap-up: the form, not the finished call", () => {
    const layout = pipLayout({ name: "wrap-up", lead, callId: "call-1" }, campaign, { stage: "ended" });
    expect(layout.showWrapUp).toBe(true);
    expect(layout.showCall).toBe(false);
    expect(layout.live).toBe(false);
  });
  test("between calls: the dialer's words and Pause", () => {
    const layout = pipLayout({ name: "countdown", lead, seconds: 3 }, campaign, { stage: "ended" });
    expect(layout.showCall).toBe(false);
    expect(layout.dialer).toEqual({ campaignName: "Beauty D2C", text: "Not answered. Next call in 3…", button: "pause", dismissible: false });
  });
  test("stopped: Start, with the notice when there is one", () => {
    expect(pipLayout(STOPPED, campaign, null).dialer?.button).toBe("start");
    expect(pipLayout(STOPPED, campaign, null).dialer?.text).toContain("Press Start");
    const paused = pipLayout({ name: "stopped", notice: "Paused — you hung up.", nextDueAt: null }, campaign, null).dialer;
    expect(paused).toEqual({ campaignName: "Beauty D2C", text: "Paused — you hung up.", button: "start", dismissible: true });
  });
});

describe("dialerLeadPhone and the href", () => {
  test("the lead's number only for the dialer's own call", () => {
    expect(dialerLeadPhone(calling, { callId: "call-1" })).toBe("+919800000000");
    expect(dialerLeadPhone(calling, { callId: null })).toBe("+919800000000");
    expect(dialerLeadPhone(calling, { callId: "other" })).toBeNull();
    expect(dialerLeadPhone(STOPPED, { callId: "call-1" })).toBeNull();
  });
  test("the Dialer tab", () => {
    expect(dialerCampaignHref("camp-1")).toBe("/calling/campaigns/ai/camp-1?tab=dialer");
  });
});
