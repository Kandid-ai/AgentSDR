import { describe, expect, test } from "bun:test";
import { materializeStepDueTimes, planNextStep, stepDueAt } from "./stepTiming";

const now = new Date("2026-11-14T10:00:00.000Z");
const minutes = (value: number) => value * 60_000;
const at = (offsetMinutes: number) => new Date(now.getTime() + minutes(offsetMinutes));

describe("stepDueAt", () => {
  test("an after-previous step waits its delay from the previous message", () => {
    expect(stepDueAt({ timing: "after_previous", delayMinutes: 60 }, { previousAt: now, meetingStartAt: null, now }))
      .toEqual(at(60));
  });

  test("an after-previous step ignores the meeting", () => {
    expect(stepDueAt({ timing: "after_previous", delayMinutes: 30 }, { previousAt: at(-10), meetingStartAt: at(5), now }))
      .toEqual(at(20));
  });

  test("a before-meeting step is due its delay before the meeting starts", () => {
    expect(stepDueAt({ timing: "before_meeting", delayMinutes: 60 * 24 }, { previousAt: now, meetingStartAt: at(60 * 48), now }))
      .toEqual(at(60 * 24));
  });

  test("a before-meeting step with no meeting is skipped", () => {
    expect(stepDueAt({ timing: "before_meeting", delayMinutes: 60 }, { previousAt: now, meetingStartAt: null, now })).toBeNull();
  });

  test("a before-meeting step whose time has passed is skipped", () => {
    expect(stepDueAt({ timing: "before_meeting", delayMinutes: 120 }, { previousAt: now, meetingStartAt: at(60), now })).toBeNull();
  });

  test("a before-meeting step due exactly now still runs", () => {
    expect(stepDueAt({ timing: "before_meeting", delayMinutes: 60 }, { previousAt: now, meetingStartAt: at(60), now })).toEqual(now);
  });
});

describe("materializeStepDueTimes", () => {
  test("after-previous delays accumulate from the start", () => {
    expect(materializeStepDueTimes(
      [{ timing: "after_previous", delayMinutes: 0 }, { timing: "after_previous", delayMinutes: 60 }, { timing: "after_previous", delayMinutes: 30 }],
      { start: now, meetingStartAt: null, now },
    )).toEqual([now, at(60), at(90)]);
  });

  test("steps after a reminder count on from the reminder's time", () => {
    expect(materializeStepDueTimes(
      [{ timing: "after_previous", delayMinutes: 60 }, { timing: "before_meeting", delayMinutes: 60 }, { timing: "after_previous", delayMinutes: 30 }],
      { start: now, meetingStartAt: at(600), now },
    )).toEqual([at(60), at(540), at(570)]);
  });

  test("a skipped reminder does not move the clock", () => {
    expect(materializeStepDueTimes(
      [{ timing: "after_previous", delayMinutes: 60 }, { timing: "before_meeting", delayMinutes: 60 }, { timing: "after_previous", delayMinutes: 30 }],
      { start: now, meetingStartAt: null, now },
    )).toEqual([at(60), null, at(90)]);
  });
});

describe("planNextStep", () => {
  test("picks the first step and its time", () => {
    expect(planNextStep([{ timing: "after_previous", delayMinutes: 15 }], { previousAt: now, meetingStartAt: null, now }))
      .toEqual({ index: 0, dueAt: at(15), skipped: [] });
  });

  test("skips reminders that cannot run and moves on", () => {
    expect(planNextStep(
      [{ timing: "before_meeting", delayMinutes: 60 }, { timing: "before_meeting", delayMinutes: 10 }, { timing: "after_previous", delayMinutes: 15 }],
      { previousAt: now, meetingStartAt: at(30), now },
    )).toEqual({ index: 1, dueAt: at(20), skipped: [0] });
  });

  test("nothing left when every step is skipped", () => {
    expect(planNextStep([{ timing: "before_meeting", delayMinutes: 60 }], { previousAt: now, meetingStartAt: null, now }))
      .toEqual({ index: null, dueAt: null, skipped: [0] });
    expect(planNextStep([], { previousAt: now, meetingStartAt: null, now }))
      .toEqual({ index: null, dueAt: null, skipped: [] });
  });
});
