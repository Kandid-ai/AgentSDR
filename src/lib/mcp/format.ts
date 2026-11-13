/**
 * Pure shaping for the MCP tools: turn the CRM's wide rows into the compact,
 * self-explaining JSON an AI assistant reads well. No database, no I/O — the
 * tests run against plain objects.
 *
 * Rules the shapes follow:
 * - ids the assistant needs for a next call sit beside the thing they act on
 *   (`draft.id` + `draft.revision`, `record.contextVersion`);
 * - long text is cut at a stated limit and says so (`…[truncated N chars]`),
 *   never silently;
 * - dates are ISO strings; absent values are null, not missing.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Cut `text` to `max` characters, saying how much was dropped. */
export function truncate(text: string | null | undefined, max: number): string | null {
  if (text == null) return null;
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…[truncated ${trimmed.length - max} chars]`;
}

export function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type PersonLike = {
  id?: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  title?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  raw?: Record<string, unknown> | null;
};

function rawString(raw: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** The name a person goes by: full name, else first + last, else the import's name, else the email. */
export function personName(person: PersonLike | null | undefined): string {
  if (!person) return "Unknown person";
  const full = person.fullName?.trim();
  if (full) return full;
  const joined = [person.firstName, person.lastName].map((part) => part?.trim()).filter(Boolean).join(" ");
  if (joined) return joined;
  return rawString(person.raw, "name", "fullName", "full_name") ?? person.email ?? "Unknown person";
}

/** Labels for the five Action required groups, as the app's queue filter names them. */
export const ACTION_GROUP_LABELS = {
  reply: "Immediate reply",
  follow_up: "Follow-up due",
  classification: "Confirm classification",
  next_step: "Needs a next step",
  problem: "Error or failed",
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  customer: "Customer",
  interested: "Interested",
  not_interested: "Not interested",
  other: "Other",
};

export function stageLabel(categoryKey: string | null | undefined, subcategory: string | null | undefined): string {
  if (!categoryKey) return "Unclassified";
  const category = CATEGORY_LABELS[categoryKey] ?? categoryKey;
  return subcategory ? `${category} › ${subcategory}` : category;
}

/** The text a draft would send: the rep's edit if there is one, else the AI's. */
export function draftBody(draft: { editedBodyText?: string | null; aiBodyText?: string | null; body?: string | null }): string {
  return (draft.editedBodyText ?? draft.body ?? draft.aiBodyText ?? "").trim();
}

/** What the assistant can do with a draft in its current status. */
export function draftNextSteps(status: string): string {
  switch (status) {
    case "awaiting_review":
      return "Ready to review: edit with crm_update_draft, send with crm_send_draft, rewrite with crm_regenerate_draft, or crm_discard_draft.";
    case "failed":
      return "Generation or sending failed (see error): crm_regenerate_draft, edit then crm_send_draft, or crm_discard_draft.";
    case "generating":
      return "The AI is still writing this draft; read the record again in a few seconds.";
    case "delivery_uncertain":
      return "A send may or may not have gone out. Check in the app before sending anything else to this person.";
    default:
      return `Draft is ${status}; nothing to do.`;
  }
}

export function recordUrl(baseUrl: string, recordId: string): string {
  return `${baseUrl}/crm/records/${recordId}`;
}

/** A tool result: JSON for the model, the same object as structured content. */
export function jsonResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

/** A tool-level failure the model can read and act on (not a protocol error). */
export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}
