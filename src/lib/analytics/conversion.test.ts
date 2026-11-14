import { describe, expect, test } from "bun:test";
import { bookingFunnel, buildConversion, resolveStages, type CohortRow } from "./conversion";

const live = [
  { key: "meeting_requested", name: "Meeting Requested", stageRank: 2 },
  { key: "meeting_done", name: "Meeting Done", stageRank: 3 },
  { key: "trial_user", name: "Trial User", stageRank: 5 },
  { key: "customer", name: "Customer", stageRank: 6 },
];
const full = [
  { key: "meeting_booked", name: "Meeting Booked", stageRank: 3 },
  { key: "meeting_done", name: "Meeting Done", stageRank: 4 },
  { key: "pilot", name: "Pilot", stageRank: 5 },
  { key: "customer", name: "Customer", stageRank: 6 },
];
const range = { from: "2026-11-01", to: "2026-11-14" };
const funnel = bookingFunnel(0, 0, 0);

describe("resolveStages", () => {
  test("prefers the exact key and falls back by candidate order", () => {
    expect(resolveStages(full).booked?.rank).toBe(3);
    expect(resolveStages(live).booked?.rank).toBe(2);
    expect(resolveStages(live).pilot?.label).toBe("Trial User");
  });
  test("absent stages are null, customer is always present", () => {
    const s = resolveStages([]);
    expect(s.booked).toBeNull();
    expect(s.showed).toBeNull();
    expect(s.customer?.rank).toBeNull();
  });
});

describe("buildConversion", () => {
  const rows: CohortRow[] = [
    { cohortDay: "2026-11-02", maxRank: 1, everCustomer: false },
    { cohortDay: "2026-11-03", maxRank: 4, everCustomer: false }, // skipped booked, showed counts for booked too
    { cohortDay: "2026-11-09", maxRank: 6, everCustomer: true },
    { cohortDay: "2026-11-10", maxRank: null, everCustomer: false },
    { cohortDay: "2026-10-30", maxRank: 6, everCustomer: true }, // outside range
  ];
  const report = buildConversion(rows, resolveStages(full), range, funnel);

  test("buckets into weeks starting on the range's first day", () => {
    expect(report.weeks.map((w) => [w.weekStart, w.interested])).toEqual([["2026-11-01", 2], ["2026-11-08", 2]]);
    expect(report.total.interested).toBe(4);
  });
  test("is rank-based", () => {
    expect(report.total.reached).toEqual({ booked: 2, showed: 2, pilot: 1, customer: 1 });
    expect(report.total.rates.booked).toBe(0.5);
    expect(report.weeks[0].reached.booked).toBe(1);
  });
  test("an absent stage is null with no rate; others still count", () => {
    const r = buildConversion(rows, resolveStages([{ key: "customer", name: "Customer", stageRank: 6 }]), range, funnel);
    expect(r.total.reached.booked).toBeNull();
    expect(r.total.rates.booked).toBeNull();
    expect(r.total.reached.customer).toBe(1);
  });
  test("an empty cohort has no rates", () => {
    const r = buildConversion([], resolveStages(full), range, funnel);
    expect(r.total.interested).toBe(0);
    expect(r.total.rates.customer).toBeNull();
  });
});

describe("bookingFunnel", () => {
  test("rates are null at zero, showed is of booked", () => {
    expect(bookingFunnel(0, 0, 0).bookedRate).toBeNull();
    expect(bookingFunnel(10, 4, 3)).toMatchObject({ bookedRate: 0.4, showedRate: 0.75 });
  });
});
