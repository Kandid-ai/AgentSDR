import "server-only";

import type { AiConfig } from "@/lib/grid/types";
import type { AiModelDefinition } from "../types";

/** What one row's AI call receives. */
export type AiRunInput = {
  config: AiConfig;
  model: AiModelDefinition;
  credentials: Record<string, string>;
  /** Prompt with {{column}} tokens already resolved against the row. */
  prompt: string;
  /**
   * The JSON shape the model must return, when the user chose "Fields" or
   * supplied a schema. Null asks for plain text.
   */
  schema: Record<string, unknown> | null;
  /** Worked examples, already resolved to plain text. */
  examples: Array<{ input: string; response: string }>;
  timeoutMs: number;
  signal?: AbortSignal;
};

export type AiRunResult = {
  /** Parsed object when a schema was requested, otherwise the raw text. */
  value: unknown;
  /** Provider-reported token usage, for the run log. */
  usage?: { inputTokens?: number; outputTokens?: number };
  raw?: unknown;
  /** Sanitized provider request body, with credentials deliberately omitted. */
  request?: unknown;
};

export type AiRunner = (input: AiRunInput) => Promise<AiRunResult>;

/**
 * The instruction appended when the user picked "Fields".
 *
 * Kept in one place so every provider asks for the same thing — a bare JSON
 * object — even where the provider also enforces a schema natively.
 */
export function jsonInstruction(schema: Record<string, unknown>): string {
  return [
    "Respond with a single JSON object and nothing else — no prose, no code fences.",
    "It must match this JSON Schema exactly:",
    JSON.stringify(schema),
  ].join("\n");
}

/**
 * Pulls the JSON object out of a model response.
 *
 * Models still occasionally wrap JSON in a code fence or a sentence even when
 * told not to, so a bare JSON.parse would throw on output that is otherwise
 * perfectly good. Falls back to the outermost braces before giving up.
 */
export function parseJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    throw new Error("The model did not return valid JSON");
  }
}
