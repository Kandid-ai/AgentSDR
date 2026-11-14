import { describe, expect, test } from "bun:test";
import { slugifySubcategoryKey } from "./categories";
import { DEFAULT_SUBCATEGORIES } from "./defaults";
import { FOLLOW_UP_TEMPLATE } from "./followUpTemplate";

const keys = new Set(DEFAULT_SUBCATEGORIES.map((entry) => slugifySubcategoryKey(entry.name)));
const sequenceKeys = new Set(FOLLOW_UP_TEMPLATE.map((sequence) => sequence.key));

describe("follow-up template", () => {
  test("step 1 is an immediate reply, follow-ups wait", () => {
    for (const sequence of FOLLOW_UP_TEMPLATE) {
      const [first, ...rest] = sequence.steps;
      expect(first?.delayMinutes).toBe(0);
      expect(first?.timing).toBe("after_previous");
      for (const step of rest) expect(step.delayMinutes).toBeGreaterThan(0);
      for (const step of sequence.steps) expect(step.aiInstructions.trim().length).toBeGreaterThan(0);
    }
  });

  test("before_meeting only on follow-ups", () => {
    for (const sequence of FOLLOW_UP_TEMPLATE) expect(sequence.steps[0]?.timing).not.toBe("before_meeting");
    expect(FOLLOW_UP_TEMPLATE.some((s) => s.steps.some((step) => step.timing === "before_meeting"))).toBe(true);
  });

  test("assigned keys exist, once each, and the ladder keys are right", () => {
    const assigned = FOLLOW_UP_TEMPLATE.flatMap((sequence) => sequence.assignTo);
    for (const key of assigned) expect(keys.has(key)).toBe(true);
    expect(new Set(assigned).size).toBe(assigned.length);
    for (const key of ["meeting_requested", "meeting_booked", "meeting_no_show", "meeting_done", "pilot", "customer"]) {
      expect(keys.has(key)).toBe(true);
    }
  });

  test("then references resolve; the loop chains to itself", () => {
    for (const sequence of FOLLOW_UP_TEMPLATE) if (sequence.then) expect(sequenceKeys.has(sequence.then)).toBe(true);
    const loop = FOLLOW_UP_TEMPLATE.find((sequence) => sequence.key === "long_term_loop");
    expect(loop?.then).toBe("long_term_loop");
    expect(loop?.assignTo).toEqual([]);
  });

  test("the interested sequence spans 14 days", () => {
    const sequence = FOLLOW_UP_TEMPLATE.find((entry) => entry.key === "interested_book");
    const total = sequence!.steps.reduce((sum, step) => sum + step.delayMinutes, 0);
    expect(total).toBe(14 * 24 * 60);
  });

  test("stage ranks never go down along the ladder", () => {
    const rank = (key: string) => DEFAULT_SUBCATEGORIES.find((entry) => slugifySubcategoryKey(entry.name) === key)?.stageRank;
    expect([rank("meeting_requested"), rank("meeting_booked"), rank("meeting_done"), rank("pilot"), rank("customer")]).toEqual([2, 3, 4, 5, 6]);
    expect(rank("meeting_no_show")).toBe(3);
  });
});
