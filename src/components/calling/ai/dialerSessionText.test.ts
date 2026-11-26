import { describe, expect, test } from "bun:test";
import type { DialerLead } from "@/lib/calls/aiCampaigns/dialer";
import { STOPPED } from "./dialerMachine";
import { dialerStatus } from "./dialerSessionText";

const lead = { name: "A", phone: "1" } as unknown as DialerLead;

describe("dialerStatus", () => {
  test("stopped says nothing unless it has a notice", () => {
    expect(dialerStatus(STOPPED)).toBeNull();
    expect(dialerStatus({ name: "stopped", notice: "Paused — you hung up.", nextDueAt: null })).toEqual({ text: "Paused — you hung up.", canPause: false, dismissible: true });
  });
  test("running phases", () => {
    expect(dialerStatus({ name: "dialing", prefer: null })).toEqual({ text: "Dialing the next lead…", canPause: true, dismissible: false });
    expect(dialerStatus({ name: "waiting", message: "Number busy", retryInMs: 1, prefer: null })).toEqual({ text: "Number busy", canPause: true, dismissible: false });
    expect(dialerStatus({ name: "countdown", lead, seconds: 2 })?.text).toBe("Not answered. Next call in 2…");
  });
  test("a call or wrap-up cannot be paused", () => {
    expect(dialerStatus({ name: "calling", lead, callId: "c", numberName: "n" })?.canPause).toBe(false);
    expect(dialerStatus({ name: "wrap-up", lead, callId: "c" })).toEqual({ text: "Call ended — record how it went", canPause: false, dismissible: false });
  });
});
