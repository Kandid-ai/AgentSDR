import { describe, expect, test } from "bun:test";
import { agentInstructions, budgetKnowledge, parseAgentName, parseAgentOutcome, parseAgentVoice } from "./liveAgent";
import { CallApiError } from "./sessions";
import { MAX_AGENT_NAME_CHARS } from "./contract";

describe("parseAgentOutcome", () => {
  test("accepts a valid outcome and trims text", () => {
    const parsed = parseAgentOutcome({ outcome: "meeting_booked", summary: "  Wants a demo  ", when: " Thursday around 4 " });
    expect(parsed.outcome).toBe("meeting_booked");
    expect(parsed.summary).toBe("Wants a demo");
    expect(parsed.when).toBe("Thursday around 4");
    expect(Number.isNaN(Date.parse(parsed.recordedAt))).toBe(false);
  });

  test("missing text becomes null", () => {
    const parsed = parseAgentOutcome({ outcome: "no_response", summary: "   " });
    expect(parsed.summary).toBeNull();
    expect(parsed.when).toBeNull();
  });

  test("limits long text", () => {
    const parsed = parseAgentOutcome({ outcome: "other", summary: "x".repeat(900), when: "y".repeat(400) });
    expect(parsed.summary?.length).toBe(500);
    expect(parsed.when?.length).toBe(120);
  });

  test("an unknown outcome throws a 400", () => {
    expect(() => parseAgentOutcome({ outcome: "won_the_lottery" })).toThrow(CallApiError);
    expect(() => parseAgentOutcome(null)).toThrow(CallApiError);
  });
});

describe("parseAgentVoice", () => {
  test("null, undefined and empty mean the default", () => {
    expect(parseAgentVoice(null)).toBeNull();
    expect(parseAgentVoice(undefined)).toBeNull();
    expect(parseAgentVoice("")).toBeNull();
  });
  test("a known voice passes, an unknown one throws", () => {
    expect(parseAgentVoice("Puck")).toBe("Puck");
    expect(() => parseAgentVoice("Nope")).toThrow(CallApiError);
  });
});

describe("parseAgentName", () => {
  test("blank is null, text is trimmed and squeezed", () => {
    expect(parseAgentName("  ")).toBeNull();
    expect(parseAgentName(null)).toBeNull();
    expect(parseAgentName("  Anita   Rao ")).toBe("Anita Rao");
  });
  test("too long throws", () => {
    expect(() => parseAgentName("a".repeat(MAX_AGENT_NAME_CHARS + 1))).toThrow(CallApiError);
  });
});

describe("budgetKnowledge", () => {
  test("orders product before case_study", () => {
    const docs = budgetKnowledge([
      { title: "Win", kind: "case_study", content: "case" },
      { title: "Prod", kind: "product", content: "product" },
    ]);
    expect(docs.map((doc) => doc.title)).toEqual(["Prod", "Win"]);
  });

  test("caps the total", () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({ title: `Doc ${index}`, kind: "product", content: "z".repeat(5_000) }));
    const docs = budgetKnowledge(rows);
    const total = docs.reduce((sum, doc) => sum + doc.content.length, 0);
    // Cut documents gain a trailing " …".
    expect(total).toBeLessThanOrEqual(12_000 + 2 * docs.length);
    expect(docs.length).toBeLessThan(rows.length);
  });
});

describe("agentInstructions", () => {
  const base = { brief: "Book a demo", lead: null };

  test("uses the given name", () => {
    expect(agentInstructions({ ...base, name: "Anita", voice: "Kore" }, [])).toContain("You are Anita");
  });

  test("falls back to Riya", () => {
    expect(agentInstructions({ ...base, name: null, voice: null }, [])).toContain("You are Riya");
  });

  test("a male voice gets masculine Hindi", () => {
    const text = agentInstructions({ ...base, name: null, voice: "Puck" }, []);
    expect(text).toContain("You are a man");
    expect(text).not.toContain("You are a woman");
  });

  test("no knowledge section when empty, one when given", () => {
    expect(agentInstructions({ ...base, name: null, voice: null }, [])).not.toContain("<knowledge>");
    expect(agentInstructions({ ...base, name: null, voice: null }, [{ title: "T", content: "C" }])).toContain("<knowledge>");
  });
});
