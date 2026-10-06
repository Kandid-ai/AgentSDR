/**
 * Body of POST /api/outreach/inbox/leads/[id]/reply, the Master Inbox's send.
 *
 * The composer also posts `to`/`cc`/`bcc` and any future keys; they are
 * ignored rather than rejected, because CRM sends to the conversation's
 * contact and the Master Inbox is not allowed to redirect a thread.
 */
import { CrmConfigurationValidationError, parseOptionalText, parseRequiredText, parseUuid } from "@/lib/crm/categories";

export type InboxReplyRequest = {
  subject: string;
  text: string;
  html: string | null;
  /** An existing awaiting-review CRM draft to edit and send instead of creating a manual one. */
  draft: { id: string; revision: number } | null;
};

export const INBOX_REPLY_SUBJECT_MAX = 998;
export const INBOX_REPLY_BODY_MAX = 100_000;

export function parseInboxReplyRequest(value: unknown): InboxReplyRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CrmConfigurationValidationError("Request body must be a JSON object");
  }
  const body = value as Record<string, unknown>;
  const subject = parseRequiredText(body.subject, "subject", INBOX_REPLY_SUBJECT_MAX);
  const text = parseRequiredText(body.text, "text", INBOX_REPLY_BODY_MAX);
  // An empty HTML part means "text only", not a validation failure.
  const html = typeof body.html === "string" && !body.html.trim()
    ? null
    : parseOptionalText(body.html, "html", INBOX_REPLY_BODY_MAX) ?? null;

  let draft: InboxReplyRequest["draft"] = null;
  if (body.draftId !== undefined && body.draftId !== null) {
    const id = parseUuid(body.draftId, "draftId");
    const revision = body.revision;
    if (!Number.isSafeInteger(revision) || Number(revision) < 0) {
      throw new CrmConfigurationValidationError("revision must be a non-negative integer when draftId is given");
    }
    draft = { id, revision: Number(revision) };
  }
  return { subject, text, html, draft };
}
