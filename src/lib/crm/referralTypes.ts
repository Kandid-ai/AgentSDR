/**
 * A referral: a lead's reply named someone else to talk to ("speak to Arjun,
 * arjun@brand.in, he runs our ads"). Client-safe shapes shared by the API,
 * the Action required list and the record's Referral card.
 *
 * Flow: the AI reads the contact out of the reply (only details that appear in
 * it) → the referrer's record sits in Action required, group "referral" → a
 * person checks the contact and starts outreach (the referred person becomes a
 * lead of their own and is enrolled in the chosen campaign per channel) or
 * dismisses it. Server half: referrals.ts.
 */

export const REFERRAL_STATUSES = ["pending", "started", "dismissed"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const REFERRAL_CHANNELS = ["email", "whatsapp", "linkedin", "call"] as const;
export type ReferralChannel = (typeof REFERRAL_CHANNELS)[number];

export const REFERRAL_CHANNEL_LABELS: Record<ReferralChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  call: "AI call",
};

/** What a referral needs for each channel to be possible at all. */
export function referralChannelAvailable(
  referral: Pick<Referral, "email" | "phone" | "linkedinUrl">,
  channel: ReferralChannel,
): boolean {
  if (channel === "email") return Boolean(referral.email);
  if (channel === "linkedin") return Boolean(referral.linkedinUrl);
  return Boolean(referral.phone);
}

export type ReferralChannelResult = {
  campaignId: string;
  campaignName: string;
  /** "enrolled", or why not ("already in this campaign", "suppressed", …). */
  outcome: "enrolled" | "skipped" | "failed";
  message: string | null;
};

export type Referral = {
  id: string;
  /** The referrer's CRM record. */
  crmRecordId: string;
  referrerPersonId: string;
  sourceMessageId: string | null;
  name: string | null;
  email: string | null;
  /** E.164 once normalized; as written when it could not be. */
  phone: string | null;
  linkedinUrl: string | null;
  role: string | null;
  companyName: string | null;
  /** The sentence of the reply that names them, for the person checking it. */
  context: string | null;
  /** The referrer asked not to be named to them. */
  anonymous: boolean;
  status: ReferralStatus;
  source: "ai" | "human";
  /** The lead created for them once outreach started. */
  referredPersonId: string | null;
  channels: Partial<Record<ReferralChannel, ReferralChannelResult>> | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

/** PATCH /api/crm/referrals/:id — edit a pending referral. */
export type ReferralUpdateRequest = Partial<Pick<Referral, "name" | "email" | "phone" | "linkedinUrl" | "role" | "companyName" | "anonymous">>;

/** POST /api/crm/records/:id/referrals — a person adds one the AI missed. */
export type ReferralCreateRequest = Pick<Referral, "name" | "email" | "phone" | "linkedinUrl"> & Partial<Pick<Referral, "role" | "companyName" | "anonymous">>;

/** POST /api/crm/referrals/:id/start — campaign per channel; omitted channels are not used. */
export type ReferralStartRequest = { channels: Partial<Record<ReferralChannel, string>> };
export type ReferralStartResponse = {
  referral: Referral;
  person: { id: string; name: string | null };
  results: Partial<Record<ReferralChannel, ReferralChannelResult>>;
};

/** GET /api/crm/referrals/targets — campaigns a referral can be enrolled in, per channel. */
export type ReferralTarget = { id: string; name: string; status: string; suggested: boolean };
export type ReferralTargetsResponse = Record<ReferralChannel, ReferralTarget[]>;

/** On an Action required row (`referral` field) and in the record workspace (`referrals`). */
export type ReferralSummary = Pick<Referral, "id" | "name" | "email" | "phone" | "linkedinUrl" | "role" | "status">;
