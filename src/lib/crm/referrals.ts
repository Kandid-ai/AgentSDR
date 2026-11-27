import "server-only";

/**
 * Referrals (`crm_referrals`): people a lead's reply points us to. The AI
 * reads them out (referralExtract.ts) and the referrer's record sits in
 * Action required, group "referral", until a person decides: edit it, dismiss
 * it, or START OUTREACH, which makes the referred person a lead of their own
 * and enrolls them in a chosen campaign per channel. Shapes: referralTypes.ts;
 * the pure rules: referralRules.ts.
 *
 * Starting runs every channel on its own: one that fails or skips (suppressed,
 * already in the campaign, no contact detail) is reported beside the others,
 * never in their place. A new email lead is queued at the next daily queue
 * build (src/lib/outreach/buildQueue.ts); starting does not run it, because
 * that rebuilds every mailbox's queue.
 */
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, people } from "@/lib/leads/schema";
import { createProvisionalPerson, upsertPerson, withLeadTransaction, type LeadTransaction } from "@/lib/leads/records";
import { normalizeEmail, normalizeLinkedinSlug } from "@/lib/leads/identity";
import { importRowsForCampaign, type ParsedRow } from "@/lib/outreach/leadImport";
import { isSuppressed } from "@/lib/outreach/suppression";
import { outreachCampaigns } from "@/lib/outreach/schema";
import { whatsappCampaigns } from "@/lib/whatsapp/schema";
import { addPeopleToWhatsappCampaign } from "@/lib/whatsapp/campaigns/campaigns.server";
import { campaigns as linkedinCampaigns } from "@/lib/linkedin/schema";
import { importLeads, IMPORT_FAILURE, type MappedLeadRow } from "@/lib/linkedin/importLeads";
import { callCampaignContacts, callCampaigns } from "@/lib/calls/schema";
import { addPeopleToAiCampaign, updateAiLead } from "@/lib/calls/aiCampaigns/campaigns.server";
import { contactInOrg } from "@/lib/calls/campaigns";
import { normalizePhone } from "@/lib/calls/phone";
import { organizationPhoneCountry } from "@/lib/calls/phone.server";
import { currentOrganizationId, inOrg } from "@/lib/tenancy/scope";
import { appendCrmEvent } from "./events";
import { isEmailDoNotContact, isPersonDoNotContact } from "./policies";
import { lockCrmRecord } from "./records";
import { CrmConflictError, CrmNotFoundError, withCrmTransaction, type CrmTransaction } from "./repository";
import { crmReferrals, crmRecords } from "./schema";
import { CrmConfigurationValidationError } from "./categories";
import {
  isSuggestedReferralCampaign,
  parseReferralCreate,
  parseReferralStart,
  parseReferralUpdate,
  referralFromRow,
  referralMergeFields,
  referralStillIdentified,
  type ReferralFieldChanges,
  type ValidReferral,
} from "./referralRules";
import {
  REFERRAL_CHANNEL_LABELS,
  REFERRAL_CHANNELS,
  referralChannelAvailable,
  type Referral,
  type ReferralChannel,
  type ReferralChannelResult,
  type ReferralStartResponse,
  type ReferralTargetsResponse,
} from "./referralTypes";

export { parseReferralCreate, parseReferralStart, parseReferralUpdate };

type ReferralRow = typeof crmReferrals.$inferSelect;

// --- reading ---------------------------------------------------------------------

async function loadReferralRow(executor: Pick<CrmTransaction, "select">, id: string, lock = false): Promise<ReferralRow> {
  const query = executor.select().from(crmReferrals).where(and(inOrg(crmReferrals), eq(crmReferrals.id, id))).limit(1);
  const [row] = lock ? await query.for("update") : await query;
  if (!row) throw new CrmNotFoundError("Referral", id);
  return row;
}

/** The campaigns a referral can be enrolled in, per channel. `suggested`: the name says "referral". */
export async function listReferralTargets(): Promise<ReferralTargetsResponse> {
  const [email, whatsapp, linkedin, call] = await Promise.all([
    db.select({ id: outreachCampaigns.id, name: outreachCampaigns.name, status: outreachCampaigns.status }).from(outreachCampaigns)
      .where(and(inOrg(outreachCampaigns), sql`${outreachCampaigns.status} <> 'completed'`)).orderBy(asc(outreachCampaigns.name)),
    db.select({ id: whatsappCampaigns.id, name: whatsappCampaigns.name, status: whatsappCampaigns.status }).from(whatsappCampaigns)
      .where(and(inOrg(whatsappCampaigns), isNull(whatsappCampaigns.archivedAt))).orderBy(asc(whatsappCampaigns.name)),
    db.select({ id: linkedinCampaigns.id, name: linkedinCampaigns.name, status: linkedinCampaigns.status }).from(linkedinCampaigns)
      .where(inOrg(linkedinCampaigns)).orderBy(asc(linkedinCampaigns.name)),
    db.select({ id: callCampaigns.id, name: callCampaigns.name, status: callCampaigns.status }).from(callCampaigns)
      .where(and(inOrg(callCampaigns), eq(callCampaigns.runBy, "ai"), isNull(callCampaigns.archivedAt))).orderBy(asc(callCampaigns.name)),
  ]);
  const shape = (rows: { id: string; name: string; status: string }[]) =>
    rows.map((row) => ({ id: row.id, name: row.name, status: row.status.toLowerCase(), suggested: isSuggestedReferralCampaign(row.name) }));
  return { email: shape(email), whatsapp: shape(whatsapp), linkedin: shape(linkedin), call: shape(call) };
}

/** A record's referrals, newest first (the workspace read is in queries.ts; this is for the routes). */
export async function listRecordReferrals(recordId: string): Promise<Referral[]> {
  const rows = await db.select().from(crmReferrals)
    .where(and(inOrg(crmReferrals), eq(crmReferrals.crmRecordId, recordId)))
    .orderBy(desc(crmReferrals.createdAt), asc(crmReferrals.id));
  return rows.map(referralFromRow);
}

// --- creating, editing, dismissing -------------------------------------------------

async function appendReferralEvent(
  tx: CrmTransaction,
  record: { id: string; personId: string; pipelineId: string },
  eventType: string,
  actor: { type: "ai" | "human"; ref: string | null },
  data: Record<string, unknown>,
) {
  await appendCrmEvent(tx, {
    personId: record.personId,
    crmRecordId: record.id,
    pipelineId: record.pipelineId,
    eventType,
    actorType: actor.type,
    actorRef: actor.ref,
    toData: data,
  });
}

function referralLabel(row: Pick<ReferralRow, "name" | "email" | "phone" | "linkedinUrl">): string {
  return row.name || row.email || row.phone || row.linkedinUrl || "contact";
}

async function normalizedPhone(phone: string | null): Promise<string | null> {
  if (!phone) return null;
  return normalizePhone(phone, await organizationPhoneCountry()) ?? phone;
}

/** A person adds a referral the AI missed. */
export async function createManualReferral(recordId: string, body: unknown, actorName: string): Promise<Referral> {
  const input = parseReferralCreate(body);
  const phone = await normalizedPhone(input.phone);
  return withCrmTransaction(async (tx) => {
    const record = await lockCrmRecord(tx, recordId);
    const [row] = await tx.insert(crmReferrals).values({
      organizationId: currentOrganizationId(),
      crmRecordId: record.id,
      referrerPersonId: record.personId,
      sourceMessageId: null,
      name: input.name,
      email: input.email,
      phone,
      linkedinUrl: input.linkedinUrl,
      role: input.role,
      companyName: input.companyName,
      context: null,
      anonymous: input.anonymous,
      status: "pending",
      source: "human",
    }).returning();
    await appendReferralEvent(tx, record, "referral.added", { type: "human", ref: actorName }, { referralId: row.id, label: referralLabel(row) });
    return referralFromRow(row);
  });
}

/** Stores the contacts the AI read from one message; returns how many were new. */
export async function insertExtractedReferrals(
  tx: CrmTransaction,
  record: { id: string; personId: string; pipelineId: string },
  messageId: string,
  items: readonly ValidReferral[],
  model: string | null,
): Promise<number> {
  let inserted = 0;
  for (const item of items) {
    const [row] = await tx.insert(crmReferrals).values({
      organizationId: currentOrganizationId(),
      crmRecordId: record.id,
      referrerPersonId: record.personId,
      sourceMessageId: messageId,
      ...item,
      status: "pending",
      source: "ai",
    }).onConflictDoNothing().returning();
    if (!row) continue;
    inserted += 1;
    await appendReferralEvent(tx, record, "referral.detected", { type: "ai", ref: model }, { referralId: row.id, messageId, label: referralLabel(row) });
  }
  return inserted;
}

/** Edit a pending referral. 404 unknown, 409 once decided, 400 when nothing would identify them. */
export async function updateReferral(id: string, body: unknown, actorName: string): Promise<Referral> {
  const changes: ReferralFieldChanges = parseReferralUpdate(body);
  const phone = "phone" in changes ? await normalizedPhone(changes.phone ?? null) : undefined;
  return withCrmTransaction(async (tx) => {
    const existing = await loadReferralRow(tx, id);
    const record = await lockCrmRecord(tx, existing.crmRecordId);
    const row = await loadReferralRow(tx, id, true);
    if (row.status !== "pending") throw new CrmConflictError(`This referral was already ${row.status}`);
    if (!referralStillIdentified(row, { ...changes, ...(phone !== undefined ? { phone } : {}) })) {
      throw new CrmConfigurationValidationError("A referral needs at least a name, email, phone or LinkedIn profile");
    }
    const { phone: _phone, ...rest } = changes;
    const [updated] = await tx.update(crmReferrals)
      .set({ ...rest, ...(phone !== undefined ? { phone } : {}), updatedAt: new Date() })
      .where(and(inOrg(crmReferrals), eq(crmReferrals.id, id)))
      .returning();
    await appendReferralEvent(tx, record, "referral.updated", { type: "human", ref: actorName }, { referralId: id, fields: Object.keys(changes) });
    return referralFromRow(updated);
  });
}

/** Dismiss a pending referral. Idempotent for a dismissed one; 409 for one already started. */
export async function dismissReferral(id: string, actorName: string): Promise<Referral> {
  return withCrmTransaction(async (tx) => {
    const existing = await loadReferralRow(tx, id);
    const record = await lockCrmRecord(tx, existing.crmRecordId);
    const row = await loadReferralRow(tx, id, true);
    if (row.status === "dismissed") return referralFromRow(row);
    if (row.status === "started") throw new CrmConflictError("Outreach to this referral was already started");
    const now = new Date();
    const [updated] = await tx.update(crmReferrals)
      .set({ status: "dismissed", decidedBy: actorName, decidedAt: now, updatedAt: now })
      .where(and(inOrg(crmReferrals), eq(crmReferrals.id, id)))
      .returning();
    await appendReferralEvent(tx, record, "referral.dismissed", { type: "human", ref: actorName }, { referralId: id, label: referralLabel(updated) });
    return referralFromRow(updated);
  });
}

// --- starting outreach -------------------------------------------------------------

type ReferrerProfile = {
  recordId: string;
  personId: string;
  pipelineId: string;
  name: string | null;
  firstName: string | null;
  company: { name: string | null; domain: string | null; linkedinUrl: string | null } | null;
};

async function loadReferrer(recordId: string): Promise<ReferrerProfile> {
  const [row] = await db.select({ record: crmRecords, person: people, company: companies })
    .from(crmRecords)
    .innerJoin(people, eq(people.id, crmRecords.personId))
    .leftJoin(companies, eq(companies.id, people.companyId))
    .where(and(inOrg(crmRecords), eq(crmRecords.id, recordId)))
    .limit(1);
  if (!row) throw new CrmNotFoundError("CRM record", recordId);
  return {
    recordId: row.record.id,
    personId: row.person.id,
    pipelineId: row.record.pipelineId,
    name: row.person.fullName ?? ([row.person.firstName, row.person.lastName].filter(Boolean).join(" ") || null),
    firstName: row.person.firstName,
    company: row.company ? { name: row.company.name, domain: row.company.domain, linkedinUrl: row.company.linkedinUrl } : null,
  };
}

function splitName(name: string | null): { firstName: string | null; lastName: string | null } {
  const [firstName, ...rest] = (name ?? "").trim().split(/\s+/);
  return { firstName: firstName || null, lastName: rest.join(" ") || null };
}

/** A person already in the organization by any of these details, so nobody's own record is overwritten by a referrer's guess. */
async function findExistingPerson(tx: LeadTransaction, input: { email: string | null; linkedinSlug: string | null; phone: string | null }) {
  const conditions = [
    input.email ? sql`lower(${people.email}) = ${input.email}` : undefined,
    input.linkedinSlug ? eq(people.linkedinUrl, input.linkedinSlug) : undefined,
    input.phone ? eq(people.phone, input.phone) : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
  if (!conditions.length) return null;
  const [row] = await tx.select().from(people).where(and(inOrg(people), or(...conditions))).limit(1);
  return row ?? null;
}

async function refuseDoNotContact(referral: ReferralRow, email: string | null, linkedinSlug: string | null, phone: string | null) {
  const existing = await withLeadTransaction((tx) => findExistingPerson(tx, { email, linkedinSlug, phone }));
  if ((existing && await isPersonDoNotContact(db, existing.id)) || (email && await isEmailDoNotContact(db, email))) {
    throw new CrmConflictError(`${referralLabel(referral)} is on the Do Not Contact list, so outreach cannot be started`);
  }
}

/** The lead for a referral: an existing person untouched but for the referrer's merge fields, else a new one at the referrer's company. */
async function createReferredPerson(referral: ReferralRow, referrer: ReferrerProfile, phone: string | null) {
  const email = normalizeEmail(referral.email);
  const linkedinSlug = normalizeLinkedinSlug(referral.linkedinUrl);
  const raw = referralMergeFields({
    referrerName: referrer.name,
    referrerFirstName: referrer.firstName,
    referrerCompany: referrer.company?.name ?? null,
    referrerPersonId: referrer.personId,
    anonymous: referral.anonymous,
  });
  return withLeadTransaction(async (tx) => {
    const existing = await findExistingPerson(tx, { email, linkedinSlug, phone });
    if (existing) {
      if (existing.id === referrer.personId) throw new CrmConflictError("This referral is the person who referred us");
      const [updated] = await tx.update(people).set({
        raw: { ...(existing.raw ?? {}), ...raw },
        phone: existing.phone ?? phone,
        updatedAt: new Date(),
      }).where(and(inOrg(people), eq(people.id, existing.id))).returning();
      return updated;
    }
    const names = splitName(referral.name);
    const input = {
      email,
      linkedinUrl: referral.linkedinUrl,
      fullName: referral.name,
      ...names,
      title: referral.role,
      phone,
      company: referrer.company?.domain || referrer.company?.name
        ? { domain: referrer.company.domain, name: referrer.company.name, linkedinUrl: referrer.company.linkedinUrl }
        : referral.companyName ? { name: referral.companyName } : null,
      raw,
      source: "crm-referral",
    };
    const person = email || linkedinSlug ? await upsertPerson(tx, input) : await createProvisionalPerson(tx, input);
    if (person.id === referrer.personId) throw new CrmConflictError("This referral is the person who referred us");
    return person;
  });
}

async function campaignName(channel: ReferralChannel, id: string): Promise<string | null> {
  const [row] = channel === "email"
    ? await db.select({ name: outreachCampaigns.name }).from(outreachCampaigns).where(and(inOrg(outreachCampaigns), eq(outreachCampaigns.id, id))).limit(1)
    : channel === "whatsapp"
    ? await db.select({ name: whatsappCampaigns.name }).from(whatsappCampaigns).where(and(inOrg(whatsappCampaigns), eq(whatsappCampaigns.id, id))).limit(1)
    : channel === "linkedin"
    ? await db.select({ name: linkedinCampaigns.name }).from(linkedinCampaigns).where(and(inOrg(linkedinCampaigns), eq(linkedinCampaigns.id, id))).limit(1)
    : await db.select({ name: callCampaigns.name }).from(callCampaigns).where(and(inOrg(callCampaigns), eq(callCampaigns.id, id), eq(callCampaigns.runBy, "ai"))).limit(1);
  return row?.name ?? null;
}

type Enrollee = typeof people.$inferSelect;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

async function enrollChannel(
  channel: ReferralChannel,
  campaign: { id: string; name: string },
  referral: ReferralRow,
  person: Enrollee,
  referrer: ReferrerProfile,
  actorName: string,
): Promise<ReferralChannelResult> {
  const result = (outcome: ReferralChannelResult["outcome"], message: string | null): ReferralChannelResult => ({
    campaignId: campaign.id,
    campaignName: campaign.name,
    outcome,
    message,
  });
  const mergeFields = referralMergeFields({
    referrerName: referrer.name,
    referrerFirstName: referrer.firstName,
    referrerCompany: referrer.company?.name ?? null,
    referrerPersonId: referrer.personId,
    anonymous: referral.anonymous,
  });
  if (channel === "email") {
    if (!person.email) return result("skipped", "No email address");
    if (await isSuppressed(person.email)) return result("skipped", "On the suppression list");
    const row: ParsedRow = {
      email: person.email,
      linkedinUrl: person.linkedinUrl,
      firstName: person.firstName,
      lastName: person.lastName,
      company: referrer.company?.name ?? referral.companyName,
      domain: referrer.company?.domain ?? null,
      companyLinkedinUrl: referrer.company?.linkedinUrl ?? null,
      title: person.title,
      customFields: mergeFields,
    };
    const outcome = await importRowsForCampaign(campaign.id, [row], { source: "api", filename: null, mapping: {}, firstRow: 0 });
    if ("error" in outcome) return result("failed", outcome.error);
    if (outcome.imported > 0) return result("enrolled", "Added. Its first email is queued at the next daily queue build.");
    if (outcome.skippedSuppressed > 0) return result("skipped", "On the suppression list");
    if (outcome.skippedDuplicate > 0) return result("skipped", "Already in this campaign");
    return result("failed", outcome.failed[0]?.error ?? "Not added");
  }
  if (channel === "whatsapp") {
    if (!person.phone) return result("skipped", "No phone number");
    const outcome = await addPeopleToWhatsappCampaign(campaign.id, [person.id]);
    if (outcome.added > 0) return result("enrolled", null);
    if (outcome.skippedDuplicate > 0) return result("skipped", "Already in this campaign");
    return result("skipped", "No usable phone number");
  }
  if (channel === "linkedin") {
    if (!person.linkedinUrl) return result("skipped", "No LinkedIn profile");
    const row: MappedLeadRow = {
      linkedinUrl: referral.linkedinUrl ?? person.linkedinUrl,
      email: person.email,
      firstName: person.firstName,
      lastName: person.lastName,
      name: person.fullName,
      headline: person.title,
      location: null,
      profilePictureUrl: null,
      companyName: referrer.company?.name ?? referral.companyName,
      companyDomain: referrer.company?.domain ?? null,
      companyLinkedinUrl: referrer.company?.linkedinUrl ?? null,
      campaignId: campaign.id,
      campaignName: null,
      invitationMessage: null,
      acceptanceMessage: null,
      followUp1Message: null,
      followUp2Message: null,
      followUp3Message: null,
    };
    const outcome = await importLeads([row], { campaignId: campaign.id, attachCampaignToExisting: true });
    if (outcome.created + outcome.attached > 0) return result("enrolled", null);
    const reason = outcome.errors[0] ?? "Not added";
    return result(reason === IMPORT_FAILURE.ALREADY_EXISTS ? "skipped" : "failed", reason === IMPORT_FAILURE.ALREADY_EXISTS ? "Already in this campaign" : reason);
  }
  if (!person.phone) return result("skipped", "No phone number");
  const outcome = await addPeopleToAiCampaign(campaign.id, [person.id]);
  if (outcome.added === 0) {
    return result("skipped", outcome.skippedDuplicate > 0 ? "Already in this campaign" : "No usable phone number");
  }
  if (!referral.anonymous && referrer.name) {
    // The lead's own instructions tell the agent who sent us; failing to set them never undoes the enrollment.
    try {
      const [contact] = await db.select({ id: callCampaignContacts.id }).from(callCampaignContacts)
        .where(and(contactInOrg(), eq(callCampaignContacts.campaignId, campaign.id), eq(callCampaignContacts.personId, person.id)))
        .limit(1);
      if (contact) {
        const said = referral.context ? `: ${referral.context}` : "";
        const instructions = `Referred by ${referrer.name}${referrer.company?.name ? ` at ${referrer.company.name}` : ""}${said}`.slice(0, 1_900);
        await updateAiLead(campaign.id, contact.id, { instructions }, actorName);
      }
    } catch (error) {
      return result("enrolled", `Added, but the referrer note was not saved: ${errorMessage(error)}`);
    }
  }
  return result("enrolled", null);
}

/**
 * Start outreach: create the referred person as a lead and enroll them in the
 * chosen campaign of each channel. 404 unknown referral, 409 when it was
 * already decided or the person is Do Not Contact, 400 when no chosen channel
 * is possible with the details it has.
 */
export async function startReferral(id: string, body: unknown, actorName: string): Promise<ReferralStartResponse> {
  const channels = parseReferralStart(body);
  const referral = await loadReferralRow(db, id);
  if (referral.status !== "pending") throw new CrmConflictError(`This referral was already ${referral.status}`);

  const chosen = REFERRAL_CHANNELS.filter((channel) => channels[channel]);
  const usable = chosen.filter((channel) => referralChannelAvailable(referral, channel));
  if (!usable.length) {
    throw new CrmConfigurationValidationError(`The details this referral has do not allow ${chosen.map((channel) => REFERRAL_CHANNEL_LABELS[channel]).join(" or ")}. Add the missing email, phone or LinkedIn profile first.`);
  }

  const phone = await normalizedPhone(referral.phone);
  const referrer = await loadReferrer(referral.crmRecordId);
  await refuseDoNotContact(referral, normalizeEmail(referral.email), normalizeLinkedinSlug(referral.linkedinUrl), phone);

  // Claim it, so two people pressing Start never enroll twice.
  const now = new Date();
  const [claimed] = await db.update(crmReferrals)
    .set({ status: "started", decidedBy: actorName, decidedAt: now, updatedAt: now })
    .where(and(inOrg(crmReferrals), eq(crmReferrals.id, id), eq(crmReferrals.status, "pending")))
    .returning();
  if (!claimed) throw new CrmConflictError("Someone else already decided this referral");

  let person: Enrollee;
  try {
    person = await createReferredPerson(claimed, referrer, phone);
  } catch (error) {
    await db.update(crmReferrals)
      .set({ status: "pending", decidedBy: null, decidedAt: null, updatedAt: new Date() })
      .where(and(inOrg(crmReferrals), eq(crmReferrals.id, id)));
    throw error;
  }

  const results: Partial<Record<ReferralChannel, ReferralChannelResult>> = {};
  for (const channel of chosen) {
    const campaignId = channels[channel]!;
    const name = await campaignName(channel, campaignId).catch(() => null);
    if (name === null) {
      results[channel] = { campaignId, campaignName: "", outcome: "failed", message: "Campaign not found" };
      continue;
    }
    if (!usable.includes(channel)) {
      results[channel] = { campaignId, campaignName: name, outcome: "skipped", message: channel === "email" ? "No email address" : channel === "linkedin" ? "No LinkedIn profile" : "No phone number" };
      continue;
    }
    try {
      results[channel] = await enrollChannel(channel, { id: campaignId, name }, claimed, person, referrer, actorName);
    } catch (error) {
      console.error(`[referrals] ${channel} enrollment failed:`, error);
      results[channel] = { campaignId, campaignName: name, outcome: "failed", message: errorMessage(error) };
    }
  }

  const row = await withCrmTransaction(async (tx) => {
    const record = await lockCrmRecord(tx, referral.crmRecordId);
    const [updated] = await tx.update(crmReferrals)
      .set({ referredPersonId: person.id, channels: results, updatedAt: new Date() })
      .where(and(inOrg(crmReferrals), eq(crmReferrals.id, id)))
      .returning();
    await appendReferralEvent(tx, record, "referral.started", { type: "human", ref: actorName }, {
      referralId: id,
      referredPersonId: person.id,
      channels: Object.fromEntries(Object.entries(results).map(([channel, value]) => [channel, { campaign: value.campaignName, outcome: value.outcome, message: value.message }])),
    });
    return updated;
  });
  const name = person.fullName ?? ([person.firstName, person.lastName].filter(Boolean).join(" ") || null);
  return { referral: referralFromRow(row), person: { id: person.id, name }, results };
}
