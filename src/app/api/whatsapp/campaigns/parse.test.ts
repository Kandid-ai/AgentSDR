import { describe, expect, test } from "bun:test";
import { CrmConfigurationValidationError } from "@/lib/crm/categories";
import { parseCreateRequest, parseUpdateRequest } from "./parse";

describe("WhatsApp campaign request priority", () => {
  test("create accepts each priority", () => {
    for (const priority of ["urgent", "high", "medium", "low"] as const) {
      expect(parseCreateRequest({ name: "Founders", priority }).priority).toBe(priority);
    }
  });

  test("create defaults to medium when priority is omitted", () => {
    expect(parseCreateRequest({ name: "Founders" }).priority).toBe("medium");
  });

  test("priority is case-insensitive and trimmed", () => {
    expect(parseCreateRequest({ name: "Founders", priority: " Urgent " }).priority).toBe("urgent");
    expect(parseUpdateRequest({ priority: "HIGH" }).priority).toBe("high");
  });

  test("update sets priority alone, and leaves it out when omitted", () => {
    expect(parseUpdateRequest({ priority: "low" })).toEqual({ priority: "low" });
    const request = parseUpdateRequest({ name: "Renamed" });
    expect(request).toEqual({ name: "Renamed" });
    expect("priority" in request).toBe(false);
  });

  test("an invalid priority is rejected", () => {
    for (const priority of ["critical", "", 1, null, ["high"]]) {
      expect(() => parseCreateRequest({ name: "Founders", priority })).toThrow(CrmConfigurationValidationError);
      expect(() => parseUpdateRequest({ priority })).toThrow("priority must be one of: urgent, high, medium, low");
    }
  });

  test("unknown fields are still rejected", () => {
    expect(() => parseUpdateRequest({ priority: "high", rank: 1 })).toThrow("Unknown field: rank");
  });
});
