import { describe, expect, test } from "bun:test";
import { draftBody, draftNextSteps, errorResult, iso, jsonResult, personName, recordUrl, stageLabel, truncate } from "./format";

describe("truncate", () => {
  test("keeps short text, trimmed", () => {
    expect(truncate("  hello  ", 10)).toBe("hello");
  });
  test("says how much it cut", () => {
    expect(truncate("abcdefghij", 4)).toBe("abcd…[truncated 6 chars]");
  });
  test("null stays null", () => {
    expect(truncate(null, 5)).toBeNull();
    expect(truncate(undefined, 5)).toBeNull();
  });
});

describe("personName", () => {
  test("prefers the full name", () => {
    expect(personName({ fullName: "Priya Shah", firstName: "P", email: "p@x.com" })).toBe("Priya Shah");
  });
  test("falls back to first + last, then the import's name, then email", () => {
    expect(personName({ firstName: "Priya", lastName: "Shah" })).toBe("Priya Shah");
    expect(personName({ raw: { full_name: "From Import" } })).toBe("From Import");
    expect(personName({ email: "p@x.com" })).toBe("p@x.com");
    expect(personName(null)).toBe("Unknown person");
  });
});

describe("stageLabel", () => {
  test("names category and sub-stage", () => {
    expect(stageLabel("interested", "Meeting Requested")).toBe("Interested › Meeting Requested");
    expect(stageLabel("not_interested", null)).toBe("Not interested");
    expect(stageLabel(null, null)).toBe("Unclassified");
  });
});

describe("drafts", () => {
  test("the rep's edit wins over the AI's text", () => {
    expect(draftBody({ aiBodyText: "ai", editedBodyText: " mine " })).toBe("mine");
    expect(draftBody({ aiBodyText: "ai", editedBodyText: null })).toBe("ai");
  });
  test("every status says what to do next", () => {
    for (const status of ["awaiting_review", "failed", "generating", "delivery_uncertain", "sent"]) {
      expect(draftNextSteps(status).length).toBeGreaterThan(10);
    }
    expect(draftNextSteps("awaiting_review")).toContain("crm_send_draft");
  });
});

describe("results", () => {
  test("json results carry the same object as text and structured content", () => {
    const result = jsonResult({ a: 1 });
    expect(result.structuredContent).toEqual({ a: 1 });
    expect(JSON.parse(result.content[0].text)).toEqual({ a: 1 });
  });
  test("errors are tool results, not throws", () => {
    expect(errorResult("nope")).toEqual({ content: [{ type: "text", text: "nope" }], isError: true });
  });
  test("iso and urls", () => {
    expect(iso(new Date("2026-01-02T03:04:05Z"))).toBe("2026-01-02T03:04:05.000Z");
    expect(iso("not a date")).toBeNull();
    expect(recordUrl("https://app.agentsdr.ai", "abc")).toBe("https://app.agentsdr.ai/crm/records/abc");
  });
});
