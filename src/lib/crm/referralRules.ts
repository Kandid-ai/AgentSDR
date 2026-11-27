/**
 * The pure half of referrals (server half: referrals.ts, referralExtract.ts):
 * when a reply is worth reading for them, the checks every contact the AI
 * read must pass before it is stored, request parsing, and row shaping.
 *
 * The AI only proposes. A contact is believed only when its email, phone or
 * profile URL is written in the reply (or its participants), exactly as the
 * CRM's draft recipients are (draftRecipients.ts).
 */
import { normalizePhone } from "@/lib/calls/phone";
import {
  CrmConfigurationValidationError,
  assertExactKeys,
  assertObject,
  parseUuid,
} from "./categories";
import type { Referral, ReferralChannel, ReferralUpdateRequest, ReferralCreateRequest, ReferralStartRequest } from "./referralTypes";
import { REFERRAL_CHANNELS } from "./referralTypes";

export const CONNECTED_TO_DIFFERENT_POC_KEY = "connected_to_different_poc";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;
const LINKEDIN_PATTERN = /linkedin\.com\/in\/([A-Za-z0-9\-_%]+)/gi;

const MAX_NAME = 200;
const MAX_CONTEXT = 600;

// --- finding candidates in text -------------------------------------------------

export function emailsIn(text: string): string[] {
  return [...new Set((text.match(EMAIL_PATTERN) ?? []).map((email) => email.toLowerCase().replace(/[.]+$/, "")))];
}

export function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/** Phone-like runs of 10 to 15 digits. */
export function phonesIn(text: string): string[] {
  return (text.match(PHONE_PATTERN) ?? []).map((run) => run.trim()).filter((run) => {
    const digits = digitsOf(run).length;
    return digits >= 10 && digits <= 15;
  });
}

export function linkedinSlugsIn(text: string): string[] {
  const slugs: string[] = [];
  for (const match of text.matchAll(LINKEDIN_PATTERN)) slugs.push(decodeURIComponent(match[1]).toLowerCase());
  return [...new Set(slugs)];
}

/** The last ten digits: how two spellings of one number ("+91 95370 19872", "095370 19872") compare. */
function phoneTail(value: string): string {
  const digits = digitsOf(value);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function sameDomain(email: string, domains: ReadonlySet<string>): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return Boolean(domain) && domains.has(domain);
}

/** Who the reply is from and who we are: details that are never a referral. */
export type ReferralOwnIdentity = {
  email: string | null;
  phone: string | null;
  linkedinSlug: string | null;
  fullName: string | null;
  /** Our sending mailboxes and the addresses on the thread that are ours. */
  ourAddresses: readonly string[];
};

function ourDomains(identity: ReferralOwnIdentity): Set<string> {
  return new Set(identity.ourAddresses.map((address) => address.split("@")[1]?.toLowerCase()).filter((domain): domain is string => Boolean(domain)));
}

function isOurAddress(email: string, identity: ReferralOwnIdentity): boolean {
  return identity.ourAddresses.some((address) => address.toLowerCase() === email) || sameDomain(email, ourDomains(identity));
}

// --- when to read a reply ------------------------------------------------------

export type ReferralTriggerInput = {
  /** The classification's proposed or applied subcategory key. */
  subcategoryKey: string | null;
  /** The latest inbound text with quoted history removed. */
  text: string;
  own: ReferralOwnIdentity;
  /** Addresses copied on the reply that no earlier message of the thread carried. */
  newCc: readonly string[];
};

/** True when the reply is worth the AI's read. Cheap: no model call. */
export function shouldExtractReferrals(input: ReferralTriggerInput): boolean {
  if (input.subcategoryKey === CONNECTED_TO_DIFFERENT_POC_KEY) return true;
  const own = input.own;
  if (input.newCc.some((email) => email !== own.email && !isOurAddress(email, own))) return true;
  if (emailsIn(input.text).some((email) => email !== own.email && !isOurAddress(email, own))) return true;
  const ownTail = own.phone ? phoneTail(own.phone) : null;
  if (phonesIn(input.text).some((phone) => phoneTail(phone) !== ownTail)) return true;
  return linkedinSlugsIn(input.text).some((slug) => slug !== own.linkedinSlug);
}

/** Addresses copied on the latest inbound that no earlier message of the thread carried (from, to or cc). */
export function newCcParticipants(
  latest: { cc: readonly string[] } | undefined,
  earlier: readonly { from: string | null; to: readonly string[]; cc: readonly string[] }[],
): string[] {
  if (!latest) return [];
  const seen = new Set<string>();
  for (const message of earlier) {
    if (message.from) seen.add(message.from.toLowerCase());
    for (const address of [...message.to, ...message.cc]) seen.add(address.toLowerCase());
  }
  return [...new Set(latest.cc.map((address) => address.toLowerCase()))].filter((address) => !seen.has(address));
}

// --- validating what the AI read -----------------------------------------------

/** One contact as the AI answers it: every field nullable. */
export type ExtractedReferral = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  role?: string | null;
  companyName?: string | null;
  context?: string | null;
  anonymous?: boolean | null;
};

export type ValidReferral = {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  role: string | null;
  companyName: string | null;
  context: string | null;
  anonymous: boolean;
};

export type ReferralValidationContext = {
  /** The latest inbound text with quoted history removed. */
  text: string;
  /** Emails on the message's from / to / cc. */
  participants: readonly string[];
  own: ReferralOwnIdentity;
  /** The organization's default phone country, for numbers written without a +. */
  phoneCountry?: string;
};

function clip(value: string | null | undefined, max: number): string | null {
  const clean = value?.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : null;
}

function nameAppearsIn(name: string, text: string): boolean {
  const haystack = text.toLowerCase().replace(/\s+/g, " ");
  const needle = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (needle.length >= 2 && haystack.includes(needle)) return true;
  const first = needle.split(" ")[0];
  return Boolean(first) && first.length >= 3 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(haystack);
}

function linkedinUrlFromSlug(slug: string): string {
  return `https://www.linkedin.com/in/${slug}`;
}

/**
 * Keeps the contacts the reply actually supports. An email must be written in
 * the reply or on its participants; a phone's digits and a LinkedIn profile
 * must be in its text; the sender's own and our own details drop the whole
 * entry (the model confused who was who); a name alone is believed only when
 * the reply says it.
 */
export function validateExtractedReferrals(items: readonly ExtractedReferral[], context: ReferralValidationContext): ValidReferral[] {
  const text = context.text;
  const lowerText = text.toLowerCase();
  const textDigits = digitsOf(text);
  const participants = new Set(context.participants.map((address) => address.toLowerCase()));
  const own = context.own;
  const ownTail = own.phone ? phoneTail(own.phone) : null;
  const ownName = own.fullName?.trim().toLowerCase() ?? null;
  const written = new Set(emailsIn(text));
  const slugsInText = new Set(linkedinSlugsIn(text));
  const kept: ValidReferral[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const name = clip(item.name, MAX_NAME);
    let email: string | null = null;
    let phone: string | null = null;
    let linkedinUrl: string | null = null;
    let reject = false;

    const rawEmail = item.email?.trim().toLowerCase().replace(/^mailto:/, "") || null;
    if (rawEmail) {
      const valid = emailsIn(rawEmail)[0] === rawEmail;
      if (valid && (written.has(rawEmail) || participants.has(rawEmail) || lowerText.includes(rawEmail))) {
        if (rawEmail === own.email || isOurAddress(rawEmail, own)) reject = true;
        else email = rawEmail;
      }
    }

    const rawPhone = item.phone?.trim() || null;
    if (rawPhone) {
      const digits = digitsOf(rawPhone);
      if (digits.length >= 7 && digits.length <= 15 && textDigits.includes(digits.length >= 10 ? digits.slice(-10) : digits)) {
        if (ownTail && phoneTail(rawPhone) === ownTail) reject = true;
        else phone = normalizePhone(rawPhone, context.phoneCountry) ?? rawPhone.slice(0, 40);
      }
    }

    const rawLinkedin = item.linkedinUrl?.trim() || null;
    if (rawLinkedin) {
      const slug = linkedinSlugsIn(rawLinkedin)[0];
      if (slug && slugsInText.has(slug)) {
        if (slug === own.linkedinSlug) reject = true;
        else linkedinUrl = linkedinUrlFromSlug(slug);
      }
    }

    if (reject) continue;
    if (!email && !phone && !linkedinUrl) {
      if (!name || !nameAppearsIn(name, text)) continue;
      if (ownName && name.toLowerCase() === ownName) continue;
    }
    if (!name && !email && !phone && !linkedinUrl) continue;

    const key = email ?? (phone ? `p:${phoneTail(phone)}` : linkedinUrl ?? `n:${name?.toLowerCase()}`);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({
      name,
      email,
      phone,
      linkedinUrl,
      role: clip(item.role, MAX_NAME),
      companyName: clip(item.companyName, MAX_NAME),
      context: clip(item.context, MAX_CONTEXT),
      anonymous: item.anonymous === true,
    });
  }
  return kept;
}

/** Parses the model's tool arguments; throws on anything that is not the schema's shape. */
export function parseExtractionOutput(text: string): ExtractedReferral[] {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || !Array.isArray((value as { referrals?: unknown }).referrals)) {
    throw new Error("Referral extraction must return { referrals: [...] }");
  }
  return (value as { referrals: unknown[] }).referrals.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const r = entry as Record<string, unknown>;
    const str = (key: string) => (typeof r[key] === "string" ? (r[key] as string) : null);
    return [{
      name: str("name"),
      email: str("email"),
      phone: str("phone"),
      linkedinUrl: str("linkedinUrl"),
      role: str("role"),
      companyName: str("companyName"),
      context: str("context"),
      anonymous: r.anonymous === true,
    }];
  });
}

export function referralExtractionJsonSchema(): Record<string, unknown> {
  const nullableText = { anyOf: [{ type: "string", maxLength: 600 }, { type: "null" }] };
  return {
    type: "object",
    additionalProperties: false,
    required: ["referrals"],
    properties: {
      referrals: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "email", "phone", "linkedinUrl", "role", "companyName", "context", "anonymous"],
          properties: {
            name: nullableText,
            email: nullableText,
            phone: nullableText,
            linkedinUrl: nullableText,
            role: nullableText,
            companyName: nullableText,
            context: nullableText,
            anonymous: { type: "boolean" },
          },
        },
      },
    },
  };
}

// --- request parsing -----------------------------------------------------------

type EditableKey = "name" | "email" | "phone" | "linkedinUrl" | "role" | "companyName";
const EDITABLE_KEYS: readonly EditableKey[] = ["name", "email", "phone", "linkedinUrl", "role", "companyName"];
const KEY_LIMITS: Record<EditableKey, number> = { name: 200, email: 320, phone: 40, linkedinUrl: 500, role: 200, companyName: 200 };

function optionalField(value: unknown, key: EditableKey): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new CrmConfigurationValidationError(`${key} must be a string or null`);
  const clean = value.trim();
  if (clean.length > KEY_LIMITS[key]) throw new CrmConfigurationValidationError(`${key} must be at most ${KEY_LIMITS[key]} characters`);
  if (!clean) return null;
  if (key === "email") {
    const email = clean.toLowerCase();
    if (emailsIn(email)[0] !== email) throw new CrmConfigurationValidationError("email is not a valid address");
    return email;
  }
  if (key === "linkedinUrl") {
    const slug = linkedinSlugsIn(clean)[0];
    if (!slug) throw new CrmConfigurationValidationError("linkedinUrl must be a linkedin.com/in/ profile address");
    return linkedinUrlFromSlug(slug);
  }
  if (key === "phone" && digitsOf(clean).length < 7) throw new CrmConfigurationValidationError("phone is not a valid number");
  return clean;
}

function hasContact(value: Partial<Record<EditableKey, string | null | undefined>>): boolean {
  return Boolean(value.name || value.email || value.phone || value.linkedinUrl);
}

export type ReferralFieldChanges = Partial<Record<EditableKey, string | null>> & { anonymous?: boolean };

/** PATCH body: any of the editable fields; null clears one. Whether something still identifies them is checked against the stored row. */
export function parseReferralUpdate(value: unknown): ReferralFieldChanges {
  assertObject(value);
  assertExactKeys(value, [...EDITABLE_KEYS, "anonymous"]);
  const changes: ReferralFieldChanges = {};
  for (const key of EDITABLE_KEYS) {
    const parsed = optionalField(value[key], key);
    if (parsed !== undefined) changes[key] = parsed;
  }
  if (value.anonymous !== undefined) {
    if (typeof value.anonymous !== "boolean") throw new CrmConfigurationValidationError("anonymous must be a boolean");
    changes.anonymous = value.anonymous;
  }
  if (Object.keys(changes).length === 0) throw new CrmConfigurationValidationError("Nothing to update");
  return changes satisfies ReferralUpdateRequest;
}

/** POST body of a manual add: name, email, phone and linkedinUrl (null when not known), optional role, companyName, anonymous. */
export function parseReferralCreate(value: unknown): Required<Pick<ValidReferral, "name" | "email" | "phone" | "linkedinUrl" | "anonymous">> & Pick<ValidReferral, "role" | "companyName"> {
  assertObject(value);
  assertExactKeys(value, [...EDITABLE_KEYS, "anonymous"]);
  const fields = {
    name: optionalField(value.name, "name") ?? null,
    email: optionalField(value.email, "email") ?? null,
    phone: optionalField(value.phone, "phone") ?? null,
    linkedinUrl: optionalField(value.linkedinUrl, "linkedinUrl") ?? null,
    role: optionalField(value.role, "role") ?? null,
    companyName: optionalField(value.companyName, "companyName") ?? null,
  };
  if (value.anonymous !== undefined && typeof value.anonymous !== "boolean") throw new CrmConfigurationValidationError("anonymous must be a boolean");
  if (!hasContact(fields)) throw new CrmConfigurationValidationError("Give at least a name, email, phone or LinkedIn profile");
  const request: ReferralCreateRequest = { ...fields, anonymous: value.anonymous === true };
  return { ...fields, anonymous: request.anonymous === true };
}

export function referralStillIdentified(row: Pick<Referral, "name" | "email" | "phone" | "linkedinUrl">, changes: ReferralFieldChanges): boolean {
  return hasContact({
    name: "name" in changes ? changes.name : row.name,
    email: "email" in changes ? changes.email : row.email,
    phone: "phone" in changes ? changes.phone : row.phone,
    linkedinUrl: "linkedinUrl" in changes ? changes.linkedinUrl : row.linkedinUrl,
  });
}

/** POST /start body: { channels: { email?: campaignId, … } }; at least one. */
export function parseReferralStart(value: unknown): Partial<Record<ReferralChannel, string>> {
  assertObject(value);
  assertExactKeys(value, ["channels"]);
  assertObject(value.channels, "channels");
  assertExactKeys(value.channels, REFERRAL_CHANNELS);
  const channels: Partial<Record<ReferralChannel, string>> = {};
  for (const channel of REFERRAL_CHANNELS) {
    const campaignId = value.channels[channel];
    if (campaignId === undefined || campaignId === null) continue;
    channels[channel] = parseUuidOrId(campaignId, `channels.${channel}`, channel);
  }
  if (Object.keys(channels).length === 0) throw new CrmConfigurationValidationError("Choose a campaign for at least one channel");
  return channels satisfies ReferralStartRequest["channels"];
}

/** LinkedIn campaign ids are cuids (text), the others UUIDs. */
function parseUuidOrId(value: unknown, label: string, channel: ReferralChannel): string {
  if (channel === "linkedin") {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(value)) throw new CrmConfigurationValidationError(`${label} must be a campaign id`);
    return value;
  }
  return parseUuid(value, label);
}

// --- shaping -------------------------------------------------------------------

/** Merge fields every channel's templates can use for a referred lead (people.raw). */
export function referralMergeFields(input: {
  referrerName: string | null;
  referrerFirstName: string | null;
  referrerCompany: string | null;
  referrerPersonId: string;
  anonymous: boolean;
}): Record<string, string> {
  const fields: Record<string, string> = { referredByPersonId: input.referrerPersonId };
  if (!input.anonymous) {
    if (input.referrerName) fields.referrerName = input.referrerName;
    if (input.referrerFirstName) fields.referrerFirstName = input.referrerFirstName;
  }
  if (input.referrerCompany) fields.referrerCompany = input.referrerCompany;
  return fields;
}

type ReferralRowShape = {
  id: string;
  crmRecordId: string;
  referrerPersonId: string;
  sourceMessageId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  role: string | null;
  companyName: string | null;
  context: string | null;
  anonymous: boolean;
  status: Referral["status"];
  source: Referral["source"];
  referredPersonId: string | null;
  channels: Record<string, unknown> | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
};

export function referralFromRow(row: ReferralRowShape): Referral {
  return {
    id: row.id,
    crmRecordId: row.crmRecordId,
    referrerPersonId: row.referrerPersonId,
    sourceMessageId: row.sourceMessageId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    linkedinUrl: row.linkedinUrl,
    role: row.role,
    companyName: row.companyName,
    context: row.context,
    anonymous: row.anonymous,
    status: row.status,
    source: row.source,
    referredPersonId: row.referredPersonId,
    channels: row.channels as Referral["channels"],
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A campaign is pre-selected for a referral when its name says so. */
export function isSuggestedReferralCampaign(name: string): boolean {
  return /referr/i.test(name);
}
