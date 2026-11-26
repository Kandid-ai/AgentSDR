import { describe, expect, test } from "bun:test";
import { delayHoursFrom, delayMinutes, delayUnitOf, delayValueIn, formatStepDelay, roundDelayHours } from "./stepDelay";

describe("step waits in minutes", () => {
  test("5 minutes round-trips through the stored hours", () => {
    const stored = delayHoursFrom(5, "minutes");
    expect(delayMinutes(stored)).toBe(5);
    expect(delayUnitOf(stored)).toBe("minutes");
    expect(delayValueIn(stored, "minutes")).toBe(5);
    expect(formatStepDelay(stored)).toBe("5 minutes");
  });

  test("0 is right away", () => {
    expect(delayHoursFrom(0, "minutes")).toBe(0);
    expect(delayUnitOf(0)).toBe("minutes");
    expect(formatStepDelay(0)).toBe("no wait");
  });

  test("whole hours and days read in their unit", () => {
    expect(delayUnitOf(2)).toBe("hours");
    expect(delayUnitOf(48)).toBe("days");
    expect(delayValueIn(48, "days")).toBe(2);
    expect(formatStepDelay(24)).toBe("1 day");
    expect(formatStepDelay(26.5)).toBe("1 day 2 hours 30 minutes");
  });

  test("units convert to the minute", () => {
    expect(delayHoursFrom(1.5, "hours")).toBe(1.5);
    expect(delayHoursFrom(1, "days")).toBe(24);
    expect(delayHoursFrom(-3, "minutes")).toBe(0);
    expect(roundDelayHours(0.08333)).toBe(5 / 60);
  });
});
