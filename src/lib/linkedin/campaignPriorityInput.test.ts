import { describe, expect, test } from "bun:test";
import { readOptionalCampaignPriority } from "./campaignPriorityInput";

describe("readOptionalCampaignPriority", () => {
  test("absent leaves the priority alone", () => {
    expect(readOptionalCampaignPriority(undefined)).toEqual({ ok: true, priority: undefined });
  });

  test("accepts every priority, case-insensitive and trimmed", () => {
    expect(readOptionalCampaignPriority("urgent")).toEqual({ ok: true, priority: "urgent" });
    expect(readOptionalCampaignPriority("High")).toEqual({ ok: true, priority: "high" });
    expect(readOptionalCampaignPriority(" medium ")).toEqual({ ok: true, priority: "medium" });
    expect(readOptionalCampaignPriority("LOW")).toEqual({ ok: true, priority: "low" });
  });

  test("anything else present is an error with the allowed values", () => {
    for (const value of [null, "", "critical", 1, true, {}, ["high"]]) {
      const result = readOptionalCampaignPriority(value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("priority must be one of: urgent, high, medium, low");
    }
  });
});
