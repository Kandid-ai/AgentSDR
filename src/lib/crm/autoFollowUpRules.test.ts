import { describe, expect, test } from "bun:test";
import {
  AUTO_FOLLOW_UP_HANDOFF_MS,
  AUTO_REPLY_HOLD_MS,
  autoFollowUpVerdict,
  followUpGapPassed,
  isAppliedClassificationStatus,
  oldestPerAccount,
  sequenceAutoSendFor,
  type AutoFollowUpCandidate,
} from "./autoFollowUpRules";

const now = new Date("2026-10-26T10:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

function candidate(overrides: Partial<AutoFollowUpCandidate> = {}): AutoFollowUpCandidate {
  return {
    draftId: "draft-1",
    revision: 1,
    channel: "email",
    accountRef: "rep@example.com",
    autoSendAt: minutesAgo(10),
    stepType: "follow_up",
    sequenceAutoSend: true,
    workflowState: "waiting",
    runActive: true,
    stepAwaitingReview: true,
    contextCurrent: true,
    answersLatestInbound: true,
    classificationApplied: true,
    ...overrides,
  };
}

describe("autoFollowUpVerdict", () => {
  test("a due follow-up on a waiting record with a live run is sent", () => {
    expect(autoFollowUpVerdict(candidate(), now)).toEqual({ verdict: "send" });
  });

  test("switching the sequence off hands its drafts to a person", () => {
    expect(autoFollowUpVerdict(candidate({ sequenceAutoSend: false }), now))
      .toEqual({ verdict: "hand_to_rep", reason: "sequence_auto_send_off" });
  });

  test("a record already on a person's desk takes the draft with it", () => {
    expect(autoFollowUpVerdict(candidate({ workflowState: "action_required" }), now))
      .toEqual({ verdict: "hand_to_rep", reason: "record_needs_a_person" });
  });

  test("paused, closed and failed records are left alone, however old the draft", () => {
    for (const workflowState of ["paused", "closed", "error"] as const) {
      expect(autoFollowUpVerdict(candidate({ workflowState, autoSendAt: minutesAgo(60 * 72) }), now))
        .toEqual({ verdict: "wait" });
    }
  });

  test("a follow-up that could not go out within 48 hours goes to a person", () => {
    const old = new Date(now.getTime() - AUTO_FOLLOW_UP_HANDOFF_MS - 60_000);
    expect(autoFollowUpVerdict(candidate({ autoSendAt: old }), now))
      .toEqual({ verdict: "hand_to_rep", reason: "not_sent_in_48_hours" });
  });

  test("a draft being retired (stale context, ended run, step moved on) is not sent", () => {
    expect(autoFollowUpVerdict(candidate({ contextCurrent: false }), now)).toEqual({ verdict: "wait" });
    expect(autoFollowUpVerdict(candidate({ runActive: false }), now)).toEqual({ verdict: "wait" });
    expect(autoFollowUpVerdict(candidate({ stepAwaitingReview: false }), now)).toEqual({ verdict: "wait" });
  });
});

describe("autoFollowUpVerdict for an immediate reply", () => {
  const reply = (overrides: Partial<AutoFollowUpCandidate> = {}) => candidate({ stepType: "reply", ...overrides });

  test("the hold is 15 minutes", () => {
    expect(AUTO_REPLY_HOLD_MS).toBe(15 * 60_000);
  });

  test("a reply to the latest inbound, on an applied stage, is sent", () => {
    expect(autoFollowUpVerdict(reply(), now)).toEqual({ verdict: "send" });
  });

  test("a reply on a stage still held for review goes to a person", () => {
    expect(autoFollowUpVerdict(reply({ classificationApplied: false }), now))
      .toEqual({ verdict: "hand_to_rep", reason: "record_needs_a_person" });
    expect(autoFollowUpVerdict(reply({ workflowState: "action_required" }), now))
      .toEqual({ verdict: "hand_to_rep", reason: "record_needs_a_person" });
  });

  test("a newer inbound stops the reply: it no longer answers the latest message", () => {
    expect(autoFollowUpVerdict(reply({ answersLatestInbound: false }), now)).toEqual({ verdict: "wait" });
    // The usual shape: the new inbound bumped the context and is being classified.
    expect(autoFollowUpVerdict(reply({ contextCurrent: false, classificationApplied: false, workflowState: "classifying" }), now))
      .toEqual({ verdict: "wait" });
  });

  test("the reply switch off hands it over", () => {
    expect(autoFollowUpVerdict(reply({ sequenceAutoSend: false }), now))
      .toEqual({ verdict: "hand_to_rep", reason: "sequence_auto_send_off" });
  });

  test("a follow-up does not depend on the reply checks", () => {
    expect(autoFollowUpVerdict(candidate({ answersLatestInbound: false, classificationApplied: false }), now))
      .toEqual({ verdict: "send" });
  });
});

describe("sequenceAutoSendFor", () => {
  test("each step type reads its own switch", () => {
    expect(sequenceAutoSendFor("reply", { autoSendReply: true, autoSendFollowUps: false })).toBe(true);
    expect(sequenceAutoSendFor("follow_up", { autoSendReply: true, autoSendFollowUps: false })).toBe(false);
    expect(sequenceAutoSendFor("follow_up", { autoSendReply: false, autoSendFollowUps: true })).toBe(true);
  });
});

describe("isAppliedClassificationStatus", () => {
  test("only applied readings count", () => {
    for (const status of ["auto_applied", "accepted", "overridden"] as const) expect(isAppliedClassificationStatus(status)).toBe(true);
    for (const status of ["proposed", "rejected", "stale", "failed", null] as const) expect(isAppliedClassificationStatus(status)).toBe(false);
  });
});

describe("oldestPerAccount", () => {
  test("keeps the first (oldest) follow-up of each sending account", () => {
    const picked = oldestPerAccount([
      candidate({ draftId: "a1", accountRef: "a@example.com" }),
      candidate({ draftId: "b1", accountRef: "b@example.com" }),
      candidate({ draftId: "a2", accountRef: "a@example.com" }),
      candidate({ draftId: "w1", channel: "whatsapp", accountRef: "a@example.com" }),
    ]);
    expect(picked.map((c) => c.draftId)).toEqual(["a1", "b1", "w1"]);
  });
});

describe("followUpGapPassed", () => {
  test("an account that never sent one, or sent one long enough ago, may send", () => {
    expect(followUpGapPassed(null, 30, now)).toBe(true);
    expect(followUpGapPassed(minutesAgo(30), 30, now)).toBe(true);
    expect(followUpGapPassed(minutesAgo(29), 30, now)).toBe(false);
  });
});
