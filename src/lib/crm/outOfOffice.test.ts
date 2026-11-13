import { describe, expect, it } from "bun:test";
import { outOfOfficeReturnAt, resumedSendAt } from "./outOfOffice";

const now = new Date("2026-11-13T10:00:00Z"); // Friday

describe("outOfOfficeReturnAt", () => {
  it("is the start of the return day in the organization's time zone", () => {
    expect(outOfOfficeReturnAt("2026-11-23T00:00:00+05:30", "Asia/Kolkata", now)?.toISOString())
      .toBe("2026-11-22T18:30:00.000Z");
    // A time later in the day still means that day.
    expect(outOfOfficeReturnAt("2026-11-23T15:00:00+05:30", "Asia/Kolkata", now)?.toISOString())
      .toBe("2026-11-22T18:30:00.000Z");
    expect(outOfOfficeReturnAt("2026-11-23T09:00:00-05:00", "America/New_York", now)?.toISOString())
      .toBe("2026-11-23T05:00:00.000Z");
  });

  it("gives no date when the notice has none worth waiting for", () => {
    expect(outOfOfficeReturnAt(null, "UTC", now)).toBeNull();
    expect(outOfOfficeReturnAt("not a date", "UTC", now)).toBeNull();
    expect(outOfOfficeReturnAt("2026-11-13T00:00:00Z", "UTC", now)).toBeNull(); // back today
    expect(outOfOfficeReturnAt("2026-11-01T00:00:00Z", "UTC", now)).toBeNull(); // in the past
    expect(outOfOfficeReturnAt("2028-01-01T00:00:00Z", "UTC", now)).toBeNull(); // over a year out
  });
});

describe("resumedSendAt", () => {
  const due = new Date("2026-11-16T09:00:00Z");

  it("keeps the original schedule when the notice gives no date", () => {
    expect(resumedSendAt(due, null)).toEqual(due);
    expect(resumedSendAt(null, null)).toBeNull();
  });

  it("moves the next message to the return day when that is later", () => {
    const back = new Date("2026-11-23T00:00:00Z");
    expect(resumedSendAt(due, back)).toEqual(back);
  });

  it("never sends earlier than the sequence would have", () => {
    const back = new Date("2026-11-15T00:00:00Z");
    expect(resumedSendAt(due, back)).toEqual(due);
  });

  it("leaves a lead with nothing scheduled unscheduled", () => {
    expect(resumedSendAt(null, new Date("2026-11-23T00:00:00Z"))).toBeNull();
  });
});
