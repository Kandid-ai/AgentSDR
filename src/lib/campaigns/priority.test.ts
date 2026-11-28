import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  CAMPAIGN_PRIORITIES,
  CAMPAIGN_PRIORITY_HINTS,
  CAMPAIGN_PRIORITY_LABELS,
  CAMPAIGN_PRIORITY_RANK,
  DEFAULT_CAMPAIGN_PRIORITY,
  NO_CAMPAIGN_RANK,
  campaignPriorityOf,
  campaignPriorityRank,
  campaignPriorityRankSql,
  compareCampaignPriority,
  isCampaignPriority,
  isSameDayPriority,
  parseCampaignPriority,
} from "./priority";

describe("campaign priority", () => {
  test("four priorities, highest first, medium by default", () => {
    expect([...CAMPAIGN_PRIORITIES]).toEqual(["urgent", "high", "medium", "low"]);
    expect(DEFAULT_CAMPAIGN_PRIORITY).toBe("medium");
    const ranks = CAMPAIGN_PRIORITIES.map((priority) => CAMPAIGN_PRIORITY_RANK[priority]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(4);
    for (const priority of CAMPAIGN_PRIORITIES) {
      expect(CAMPAIGN_PRIORITY_LABELS[priority]).toBeTruthy();
      expect(CAMPAIGN_PRIORITY_HINTS[priority]).toBeTruthy();
    }
  });

  test("parses request values: trimmed, any case; anything else is an error", () => {
    expect(parseCampaignPriority("urgent")).toEqual({ ok: true, priority: "urgent" });
    expect(parseCampaignPriority(" HIGH ")).toEqual({ ok: true, priority: "high" });
    expect(parseCampaignPriority("Low")).toEqual({ ok: true, priority: "low" });
    for (const bad of ["", "critical", "1", null, undefined, 0, 2, {}, ["high"], true]) {
      const parsed = parseCampaignPriority(bad);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toContain("urgent, high, medium, low");
    }
  });

  test("a stored value that is not a priority reads as medium", () => {
    expect(campaignPriorityOf("urgent")).toBe("urgent");
    expect(campaignPriorityOf("URGENT")).toBe("medium");
    expect(campaignPriorityOf(null)).toBe("medium");
    expect(campaignPriorityOf(undefined)).toBe("medium");
    expect(isCampaignPriority("medium")).toBe(true);
    expect(isCampaignPriority("Medium")).toBe(false);
  });

  test("sorting puts urgent first and a lead without a campaign last; equal priorities keep their order", () => {
    const rows = [
      { id: "a", priority: "low" },
      { id: "b", priority: null },
      { id: "c", priority: "medium" },
      { id: "d", priority: "urgent" },
      { id: "e", priority: "medium" },
      { id: "f", priority: "high" },
      { id: "g", priority: "urgent" },
    ];
    const sorted = [...rows].sort((x, y) => compareCampaignPriority(x.priority, y.priority)).map((row) => row.id);
    expect(sorted).toEqual(["d", "g", "f", "c", "e", "a", "b"]);
    expect(campaignPriorityRank(null)).toBe(NO_CAMPAIGN_RANK);
    expect(campaignPriorityRank("low")).toBeLessThan(NO_CAMPAIGN_RANK);
  });

  test("urgent and high start email the same day; medium and low wait for the morning", () => {
    expect(isSameDayPriority("urgent")).toBe(true);
    expect(isSameDayPriority("high")).toBe(true);
    expect(isSameDayPriority("medium")).toBe(false);
    expect(isSameDayPriority("low")).toBe(false);
    expect(isSameDayPriority(null)).toBe(false);
  });

  test("the SQL rank uses the same table, never the text order", () => {
    const query = new PgDialect().sqlToQuery(sql`select ${campaignPriorityRankSql(sql.raw(`"priority"`))}`);
    expect(query.sql).toBe(`select (case "priority" when $1 then 0 when $2 then 1 when $3 then 2 when $4 then 3 else ${NO_CAMPAIGN_RANK} end)`);
    expect(query.params).toEqual(["urgent", "high", "medium", "low"]);
  });
});
