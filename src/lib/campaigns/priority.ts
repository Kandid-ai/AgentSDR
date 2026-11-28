/**
 * Campaign priority: which campaign a sending account works on first.
 *
 * Every email, LinkedIn and WhatsApp campaign has one (`priority` column,
 * `scripts/add-campaign-priority.ts`, default "medium"). A sending account
 * (mailbox, LinkedIn account, WhatsApp number) takes its next lead from the
 * highest-priority campaign it sends for that has one due, and reaches a lower
 * priority only when every higher one has nothing due. Within one priority
 * each engine keeps the order it always had (follow-ups before first
 * messages, oldest first). On email and WhatsApp, where first messages and
 * follow-ups share one daily allowance, priority outranks the follow-up-first
 * rule: an Urgent campaign's first message goes before a Low campaign's
 * follow-up, which simply waits for the next free turn. LinkedIn gives
 * invitations, profile lookups and each follow-up stage their own batch, so
 * there priority orders each batch (most of all the daily invitation cap).
 *
 * Email builds its day's queue once each morning; Urgent and High campaigns
 * also rebuild it when leads are added or the campaign starts
 * (`src/lib/outreach/queueRefresh.ts`), so they send the same day.
 *
 * Client-safe: no database imports. The SQL ordering is built from the same
 * rank table (`campaignPriorityRankSql`), so the tests cover the order the
 * queries use.
 */
import { sql, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

export const CAMPAIGN_PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export type CampaignPriority = (typeof CAMPAIGN_PRIORITIES)[number];

export const DEFAULT_CAMPAIGN_PRIORITY: CampaignPriority = "medium";

/** Lower sends first. A lead with no campaign (LinkedIn allows it) ranks after every priority. */
export const CAMPAIGN_PRIORITY_RANK: Record<CampaignPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
export const NO_CAMPAIGN_RANK = 9;

export const CAMPAIGN_PRIORITY_LABELS: Record<CampaignPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const CAMPAIGN_PRIORITY_HINTS: Record<CampaignPriority, string> = {
  urgent: "Goes before every other campaign. Email starts the same day.",
  high: "Goes before Medium and Low. Email starts the same day.",
  medium: "The default.",
  low: "Only when no other campaign has anything due.",
};

/** Priorities that make an email campaign's new leads start the same day instead of at the next morning's queue build. */
export const SAME_DAY_PRIORITIES: readonly CampaignPriority[] = ["urgent", "high"];

export function isCampaignPriority(value: unknown): value is CampaignPriority {
  return typeof value === "string" && (CAMPAIGN_PRIORITIES as readonly string[]).includes(value);
}

export type ParsedCampaignPriority = { ok: true; priority: CampaignPriority } | { ok: false; error: string };

/** A request's `priority`. Case-insensitive, trimmed; anything else is a 400. */
export function parseCampaignPriority(value: unknown): ParsedCampaignPriority {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : value;
  if (isCampaignPriority(normalized)) return { ok: true, priority: normalized };
  return { ok: false, error: `priority must be one of: ${CAMPAIGN_PRIORITIES.join(", ")}` };
}

/** A stored value read back; anything unexpected counts as the default rather than breaking a page. */
export function campaignPriorityOf(value: unknown): CampaignPriority {
  return isCampaignPriority(value) ? value : DEFAULT_CAMPAIGN_PRIORITY;
}

export function campaignPriorityRank(value: unknown): number {
  if (value === null || value === undefined) return NO_CAMPAIGN_RANK;
  return CAMPAIGN_PRIORITY_RANK[campaignPriorityOf(value)];
}

/** Sort comparator: higher priority first. Stable sorts keep each engine's own order within a priority. */
export function compareCampaignPriority(a: unknown, b: unknown): number {
  return campaignPriorityRank(a) - campaignPriorityRank(b);
}

export function isSameDayPriority(value: unknown): boolean {
  return SAME_DAY_PRIORITIES.includes(campaignPriorityOf(value));
}

/**
 * `ORDER BY` key for a priority column: 0 for urgent … 3 for low, and
 * NO_CAMPAIGN_RANK for NULL (a left-joined lead without a campaign). Never
 * sort on the text itself: alphabetically "high" < "low" < "medium" < "urgent".
 */
export function campaignPriorityRankSql(column: AnyColumn | SQL): SQL<number> {
  const whens = CAMPAIGN_PRIORITIES.map((priority) => sql`when ${priority} then ${sql.raw(String(CAMPAIGN_PRIORITY_RANK[priority]))}`);
  return sql<number>`(case ${column} ${sql.join(whens, sql` `)} else ${sql.raw(String(NO_CAMPAIGN_RANK))} end)`;
}
