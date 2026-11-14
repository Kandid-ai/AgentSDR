/**
 * When a sequence step comes due. Pure and client-safe (no database), so the
 * three places that schedule steps — a run starting, a send, a skip — and the
 * meeting reschedule all use the same rule.
 *
 * - 'after_previous': `delayMinutes` after the previous message (or the
 *   moment the previous step was handled).
 * - 'before_meeting': `delayMinutes` before the record's booked meeting
 *   starts — a reminder. With no open meeting, or when that moment has
 *   already passed, the step is skipped (null).
 */
import type { CrmSequenceStepTiming } from "./schema";

export type TimedStep = {
  timing: CrmSequenceStepTiming;
  delayMinutes: number;
};

export type StepClock = {
  /** What an 'after_previous' step counts from. */
  previousAt: Date;
  /** Start of the record's open booked meeting, if any. */
  meetingStartAt: Date | null;
  now: Date;
};

/** The step's due time, or null when it must be skipped. */
export function stepDueAt(step: TimedStep, clock: StepClock): Date | null {
  if (step.timing === "before_meeting") {
    if (!clock.meetingStartAt) return null;
    const dueAt = new Date(clock.meetingStartAt.getTime() - step.delayMinutes * 60_000);
    return dueAt.getTime() < clock.now.getTime() ? null : dueAt;
  }
  return new Date(clock.previousAt.getTime() + step.delayMinutes * 60_000);
}

/**
 * Due times for a whole run's steps at its start, in order: each
 * 'after_previous' step counts from the one before it (from `start` for the
 * first), a 'before_meeting' step is fixed to the meeting, and the steps after
 * it count on from its time. A skipped step (null) does not move the clock.
 */
export function materializeStepDueTimes(
  steps: readonly TimedStep[],
  clock: { start: Date; meetingStartAt: Date | null; now: Date },
): (Date | null)[] {
  let previousAt = clock.start;
  return steps.map((step) => {
    const dueAt = stepDueAt(step, { previousAt, meetingStartAt: clock.meetingStartAt, now: clock.now });
    if (dueAt) previousAt = dueAt;
    return dueAt;
  });
}

/**
 * The next step to schedule among `steps` (ordered by position, all still to
 * come): the first one that is not skipped, with its due time, and the
 * indexes of the ones skipped on the way. `index` is null when every step is
 * skipped (or there are none) — the run has nothing left.
 */
export function planNextStep(
  steps: readonly TimedStep[],
  clock: StepClock,
): { index: number | null; dueAt: Date | null; skipped: number[] } {
  const skipped: number[] = [];
  for (let index = 0; index < steps.length; index += 1) {
    const dueAt = stepDueAt(steps[index]!, clock);
    if (dueAt) return { index, dueAt, skipped };
    skipped.push(index);
  }
  return { index: null, dueAt: null, skipped };
}
