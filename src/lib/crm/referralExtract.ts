import "server-only";

/**
 * Reads the people a lead's reply points us to out of one inbound message and
 * stores them as pending referrals (referrals.ts).
 *
 * Runs after a reply is classified (handlers.ts), never inside the
 * classification: a cheap check decides whether the reply is worth a model
 * call (the classifier read "connected to a different point of contact", or
 * the text carries an email, phone number or LinkedIn profile that is not the
 * sender's or ours, or someone new is copied in), the model proposes contacts
 * through the app's BYOK structured-call runtime (traced as `crm-referral-
 * extract`), and referralRules.validateExtractedReferrals keeps only what the
 * message itself supports. Idempotent per message: a message that already has
 * referrals is not read again, and the unique index drops a repeated contact.
 *
 * `extractReferralsForMessage` is the single entry point; a backfill calls it
 * for old message ids inside `runInOrganization`.
 */
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { people } from "@/lib/leads/schema";
import { mailboxes } from "@/lib/outreach/schema";
import { normalizeLinkedinSlug } from "@/lib/leads/identity";
import { completeStructuredWithOpenRouter } from "@/lib/ai/server/structuredCompletion";
import { getPrompt, getPromptTemplate } from "@/lib/observability/langfuse";
import { fillPrompt } from "@/lib/prompts/template";
import { organizationPhoneCountry } from "@/lib/calls/phone.server";
import { inOrg } from "@/lib/tenancy/scope";
import { withoutQuotedHistory } from "./context";
import { messageParticipants } from "./participants";
import { insertExtractedReferrals } from "./referrals";
import { lockCrmRecord } from "./records";
import { withCrmTransaction } from "./repository";
import {
  newCcParticipants,
  parseExtractionOutput,
  referralExtractionJsonSchema,
  shouldExtractReferrals,
  validateExtractedReferrals,
  type ReferralOwnIdentity,
} from "./referralRules";
import { crmClassifications, crmConversationMessages, crmConversations, crmReferrals, crmRecords, crmSubcategories } from "./schema";

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 4_000;
const MAX_TEXT_CHARS = 8_000;

export type ReferralExtractionOutcome = {
  messageId: string;
  /** Why nothing was read, when nothing was. */
  skipped: "not_inbound" | "already_read" | "not_worth_reading" | null;
  /** How many new referrals were stored. */
  stored: number;
};

/** The subcategory key the message's newest classification proposed or applied, for callers that were not handed it. */
async function classifiedSubcategoryKey(messageId: string): Promise<string | null> {
  const [row] = await db.select({
    key: crmSubcategories.key,
  }).from(crmClassifications)
    .innerJoin(crmSubcategories, eq(crmSubcategories.id, crmClassifications.proposedSubcategoryId))
    .where(eq(crmClassifications.messageId, messageId))
    .orderBy(desc(crmClassifications.createdAt))
    .limit(1);
  return row?.key ?? null;
}

/**
 * Read one inbound message for referrals. Must run in the organization's
 * scope. Throws on a failed model call (the caller decides whether that
 * matters); the classification hook catches and logs it.
 *
 * `subcategoryKey`: what the classifier proposed or applied for it; when
 * omitted it is read from the message's newest classification.
 */
export async function extractReferralsForMessage(
  messageId: string,
  options: { subcategoryKey?: string | null } = {},
): Promise<ReferralExtractionOutcome> {
  const [scope] = await db.select({ message: crmConversationMessages, conversation: crmConversations, record: crmRecords, person: people })
    .from(crmConversationMessages)
    .innerJoin(crmConversations, eq(crmConversations.id, crmConversationMessages.conversationId))
    .innerJoin(crmRecords, eq(crmRecords.id, crmConversations.crmRecordId))
    .innerJoin(people, eq(people.id, crmRecords.personId))
    .where(and(inOrg(crmRecords), inOrg(crmConversations), inOrg(people), eq(crmConversationMessages.id, messageId)))
    .limit(1);
  const base = { messageId, stored: 0 };
  if (!scope || scope.message.direction !== "inbound") return { ...base, skipped: "not_inbound" };

  const [alreadyRead] = await db.select({ id: crmReferrals.id }).from(crmReferrals)
    .where(and(inOrg(crmReferrals), eq(crmReferrals.sourceMessageId, messageId))).limit(1);
  if (alreadyRead) return { ...base, skipped: "already_read" };

  const { message, record, person } = scope;
  const [earlier, mailboxRows, subcategoryKey] = await Promise.all([
    db.select({ message: crmConversationMessages }).from(crmConversationMessages)
      .innerJoin(crmConversations, eq(crmConversations.id, crmConversationMessages.conversationId))
      .where(and(inOrg(crmConversations), eq(crmConversations.crmRecordId, record.id), lt(crmConversationMessages.sentAt, message.sentAt)))
      .orderBy(asc(crmConversationMessages.sentAt)),
    db.select({ email: mailboxes.emailAddress }).from(mailboxes).where(inOrg(mailboxes)),
    options.subcategoryKey !== undefined ? Promise.resolve(options.subcategoryKey) : classifiedSubcategoryKey(messageId),
  ]);

  const text = withoutQuotedHistory(message.bodyText ?? "");
  const participants = messageParticipants(message);
  const earlierParticipants = earlier.flatMap((row) => {
    const found = messageParticipants(row.message);
    return found ? [{ from: found.from ?? null, to: found.to, cc: found.cc }] : [];
  });
  const ourAddresses = [...new Set([
    ...mailboxRows.map((row) => row.email.toLowerCase()),
    ...earlier.flatMap((row) => row.message.direction === "outbound" && row.message.channel === "email" ? [row.message.accountRef.toLowerCase()] : []),
    scope.conversation.channel === "email" ? scope.conversation.accountRef.toLowerCase() : "",
  ].filter((address) => address.includes("@")))];
  const own: ReferralOwnIdentity = {
    email: person.email?.toLowerCase() ?? null,
    phone: person.phone,
    linkedinSlug: normalizeLinkedinSlug(person.linkedinUrl),
    fullName: person.fullName,
    ourAddresses,
  };
  const newCc = newCcParticipants(participants ? { cc: participants.cc } : undefined, earlierParticipants);

  if (!shouldExtractReferrals({ subcategoryKey, text, own, newCc })) return { ...base, skipped: "not_worth_reading" };

  const [system, userTemplate, tool] = await Promise.all([
    getPromptTemplate("crm/referral-extract-system"),
    getPromptTemplate("crm/referral-extract-user"),
    getPrompt("crm/referral-extract-tool"),
  ]);
  const contextJson = JSON.stringify({
    sender: { name: person.fullName, email: person.email, title: person.title },
    ourAddresses,
    latestInboundMessage: {
      channel: message.channel,
      subject: message.subject,
      text: text.slice(0, MAX_TEXT_CHARS),
      participants: participants ?? null,
      newlyCopiedIn: newCc,
    },
    classifiedAs: subcategoryKey,
  }, null, 2);
  const completion = await completeStructuredWithOpenRouter({
    timeoutMs: TIMEOUT_MS,
    systemPrompt: system.text,
    userPrompt: fillPrompt(userTemplate.text, { context_json: contextJson }),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    jsonSchema: referralExtractionJsonSchema(),
    schemaName: "crm_referral_extraction",
    schemaDescription: tool.text,
    accept: (output) => { parseExtractionOutput(output); },
    trace: {
      name: "crm-referral-extract",
      prompts: [system, userTemplate, tool],
      metadata: { crmRecordId: record.id, messageId },
    },
  });

  const valid = validateExtractedReferrals(parseExtractionOutput(completion.text), {
    text,
    participants: participants ? [...(participants.from ? [participants.from] : []), ...participants.to, ...participants.cc] : [],
    own,
    phoneCountry: await organizationPhoneCountry(),
  });
  if (!valid.length) return { ...base, skipped: null };

  const stored = await withCrmTransaction(async (tx) => {
    const locked = await lockCrmRecord(tx, record.id);
    return insertExtractedReferrals(tx, locked, messageId, valid, completion.model);
  });
  return { ...base, skipped: null, stored };
}
