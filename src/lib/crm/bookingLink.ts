import "server-only";

/**
 * The CRM's booking link: a message's `{{booking_link}}` becomes the
 * organization's Cal.com booking page (crm_settings.booking_url) with the
 * record's own booking code in the booking's metadata (`metadata[c]=…`), so a
 * booking made from it names its record (src/lib/crm/meetings.ts). The link
 * carries nothing else about the person: it may be forwarded.
 *
 * The send resolves the token as the message goes out
 * (resolveBookingLinkInTransaction) and counts it once delivered
 * (recordBookingLinkSentInTransaction).
 */
import { and, eq, sql } from "drizzle-orm";
import { bookingLinkFor, newBookingCode } from "@/lib/calls/aiCampaigns/engineRules";
import { isUniqueViolation } from "@/lib/whatsapp/messages";
import { inOrg } from "@/lib/tenancy/scope";
import {
  BOOKING_LINK_TOKEN,
  CRM_BOOKING_CODE_LENGTH,
  hasBookingLinkToken,
  replaceBookingLinkToken,
  replaceBookingLinkTokenInHtml,
} from "./bookingLinkToken";
import { CrmConflictError, CrmNotFoundError, type CrmExecutor, type CrmTransaction } from "./repository";
import { crmRecords, crmSettings } from "./schema";

/** The pipeline's booking page; null when none is set. crm_settings is reached through the record's (scoped) pipeline. */
export async function crmBookingUrl(executor: CrmExecutor, pipelineId: string): Promise<string | null> {
  const [row] = await executor
    .select({ bookingUrl: crmSettings.bookingUrl })
    .from(crmSettings)
    .where(eq(crmSettings.pipelineId, pipelineId))
    .limit(1);
  return row?.bookingUrl?.trim() || null;
}

/**
 * The record's booking code, given the first time a link is resolved: random,
 * tried again past a collision (in a savepoint, so the send's transaction
 * survives it), and a character longer after a few so the space never runs
 * out. `coalesce` keeps a code a concurrent send already gave.
 */
export async function crmBookingCodeInTransaction(tx: CrmTransaction, recordId: string): Promise<string> {
  const [current] = await tx
    .select({ code: crmRecords.bookingCode })
    .from(crmRecords)
    .where(and(inOrg(crmRecords), eq(crmRecords.id, recordId)))
    .limit(1);
  if (!current) throw new CrmNotFoundError("CRM record", recordId);
  if (current.code) return current.code;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = newBookingCode(CRM_BOOKING_CODE_LENGTH + Math.floor(attempt / 4));
    try {
      const row = await tx.transaction(async (savepoint) => {
        const [updated] = await savepoint
          .update(crmRecords)
          .set({ bookingCode: sql`coalesce(${crmRecords.bookingCode}, ${code})` })
          .where(and(inOrg(crmRecords), eq(crmRecords.id, recordId)))
          .returning({ code: crmRecords.bookingCode });
        return updated;
      });
      if (!row?.code) throw new CrmNotFoundError("CRM record", recordId);
      return row.code;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Could not find a free booking code");
}

/**
 * Puts the record's booking link wherever the body says `{{booking_link}}`
 * (in HTML, as a link). Unchanged, with `used: false`, when it does not; a
 * conflict a person can act on when it does and no booking page is set.
 */
export async function resolveBookingLinkInTransaction(
  tx: CrmTransaction,
  input: { recordId: string; pipelineId: string; bodyText: string; bodyHtml: string | null },
): Promise<{ bodyText: string; bodyHtml: string | null; used: boolean }> {
  if (!hasBookingLinkToken(input.bodyText, input.bodyHtml)) {
    return { bodyText: input.bodyText, bodyHtml: input.bodyHtml, used: false };
  }
  const bookingUrl = await crmBookingUrl(tx, input.pipelineId);
  if (!bookingUrl) {
    throw new CrmConflictError(`Set your booking link in CRM settings before sending a message with ${BOOKING_LINK_TOKEN}`);
  }
  const link = bookingLinkFor(bookingUrl, await crmBookingCodeInTransaction(tx, input.recordId));
  if (!link) {
    throw new CrmConflictError(`The booking link in CRM settings is not a valid URL; fix it before sending a message with ${BOOKING_LINK_TOKEN}`);
  }
  return {
    bodyText: replaceBookingLinkToken(input.bodyText, link),
    bodyHtml: input.bodyHtml === null ? null : replaceBookingLinkTokenInHtml(input.bodyHtml, link),
    used: true,
  };
}

/** A message carrying the record's booking link went out. */
export async function recordBookingLinkSentInTransaction(tx: CrmTransaction, recordId: string, now: Date = new Date()): Promise<void> {
  await tx
    .update(crmRecords)
    .set({
      bookingLinkSentCount: sql`${crmRecords.bookingLinkSentCount} + 1`,
      bookingLinkFirstSentAt: sql`coalesce(${crmRecords.bookingLinkFirstSentAt}, ${now.toISOString()}::timestamptz)`,
    })
    .where(and(inOrg(crmRecords), eq(crmRecords.id, recordId)));
}
