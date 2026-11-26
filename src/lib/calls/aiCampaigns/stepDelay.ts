/**
 * A calling campaign step's wait (`delayHours`, after the previous step),
 * kept to the minute: 5 minutes is 5/60 of an hour. The editor shows it in
 * minutes, hours or days. Client-safe and import-free.
 *
 * An agent campaign still waits at least MIN_STEP_GAP_MS (engineRules.ts)
 * between steps; a rep's campaign waits exactly this, so 0 is right away.
 */

export type StepDelayUnit = "minutes" | "hours" | "days";

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** The wait in whole minutes. */
export function delayMinutes(delayHours: number): number {
  return Math.max(0, Math.round(delayHours * MINUTES_PER_HOUR));
}

/** A wait rounded to the minute, as stored. */
export function roundDelayHours(delayHours: number): number {
  return delayMinutes(delayHours) / MINUTES_PER_HOUR;
}

/** The unit a stored wait reads best in: days or hours when it is a whole number of them, else minutes. */
export function delayUnitOf(delayHours: number): StepDelayUnit {
  const minutes = delayMinutes(delayHours);
  if (minutes > 0 && minutes % MINUTES_PER_DAY === 0) return "days";
  if (minutes > 0 && minutes % MINUTES_PER_HOUR === 0) return "hours";
  return "minutes";
}

const PER_UNIT: Record<StepDelayUnit, number> = { minutes: 1, hours: MINUTES_PER_HOUR, days: MINUTES_PER_DAY };

/** The wait as a number in `unit` (up to two decimals when it does not divide evenly). */
export function delayValueIn(delayHours: number, unit: StepDelayUnit): number {
  return Math.round((delayMinutes(delayHours) / PER_UNIT[unit]) * 100) / 100;
}

/** A value typed in `unit`, back to the stored hours (to the minute). */
export function delayHoursFrom(value: number, unit: StepDelayUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * PER_UNIT[unit]) / MINUTES_PER_HOUR;
}

/** "no wait", "5 minutes", "2 hours", "1 day", "1 day 2 hours". */
export function formatStepDelay(delayHours: number): string {
  const minutes = delayMinutes(delayHours);
  if (minutes === 0) return "no wait";
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const hours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  return [days ? plural(days, "day") : "", hours ? plural(hours, "hour") : "", rest ? plural(rest, "minute") : ""].filter(Boolean).join(" ");
}
