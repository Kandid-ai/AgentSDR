/**
 * Same-day start for Urgent and High email campaigns.
 *
 * The email queue is planned once each morning (buildQueue.ts), so a lead
 * added at noon would normally wait for tomorrow. When an active campaign
 * whose priority starts the same day (SAME_DAY_PRIORITIES) gets new leads,
 * starts, or is raised to such a priority, this rebuilds that organization's
 * queue a minute later. One rebuild covers every change in that minute, and a
 * change that arrives while one runs triggers one more after it.
 *
 * A rebuild re-plans the rest of the day: it keeps the mailboxes' counts of
 * what they already sent (no second daily allowance), puts the Urgent/High
 * leads first, and may push lower-priority sends to tomorrow.
 *
 * In-process timers, like the email tick (internalScheduler.ts): only where
 * that tick runs (production, one instance) and never while email outbound
 * is paused. Elsewhere (the dev server shares the production database) it
 * does nothing.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { isSameDayPriority } from "@/lib/campaigns/priority";
import { isMigrationControlPaused } from "@/lib/migration/controls";
import { currentOrganizationId, inOrg } from "@/lib/tenancy/scope";
import { buildMailboxQueues } from "./buildQueue";
import { outreachCampaigns } from "./schema";

export const QUEUE_REFRESH_DELAY_MS = 60_000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const running = new Set<string>();
const again = new Set<string>();

function refreshEnabled(): boolean {
  if (process.env.OUTREACH_SAME_DAY_REFRESH === "off") return false;
  return process.env.NODE_ENV === "production" && !isMigrationControlPaused("emailOutbound");
}

async function rebuild(organizationId: string): Promise<void> {
  if (running.has(organizationId)) {
    again.add(organizationId);
    return;
  }
  running.add(organizationId);
  try {
    const result = await buildMailboxQueues({ organizationIds: [organizationId] });
    console.log(`[outreach/queueRefresh] organization ${organizationId} queue rebuilt for an Urgent/High campaign:`, result);
  } catch (error) {
    console.error(`[outreach/queueRefresh] organization ${organizationId} rebuild failed:`, error);
  } finally {
    running.delete(organizationId);
    if (again.delete(organizationId)) schedule(organizationId);
  }
}

function schedule(organizationId: string): void {
  if (timers.has(organizationId)) return;
  timers.set(organizationId, setTimeout(() => {
    timers.delete(organizationId);
    void rebuild(organizationId);
  }, QUEUE_REFRESH_DELAY_MS));
}

/**
 * Call after leads were added to these campaigns, or after a campaign started
 * or changed priority. Must run in the organization's scope. Never throws:
 * the change that called it has already happened.
 */
export async function requestSameDayQueueRefresh(campaignIds: readonly string[]): Promise<boolean> {
  try {
    if (!campaignIds.length || !refreshEnabled()) return false;
    const rows = await db
      .select({ status: outreachCampaigns.status, priority: outreachCampaigns.priority })
      .from(outreachCampaigns)
      .where(and(inOrg(outreachCampaigns), inArray(outreachCampaigns.id, [...campaignIds]), eq(outreachCampaigns.status, "active")));
    if (!rows.some((row) => isSameDayPriority(row.priority))) return false;
    schedule(currentOrganizationId());
    return true;
  } catch (error) {
    console.error("[outreach/queueRefresh] could not request a rebuild:", error);
    return false;
  }
}

/** For tests: run every waiting rebuild now instead of after the delay. Returns the organizations rebuilt. */
export async function flushSameDayQueueRefreshes(): Promise<string[]> {
  const waiting = [...timers.keys()];
  for (const organizationId of waiting) {
    clearTimeout(timers.get(organizationId));
    timers.delete(organizationId);
    await rebuild(organizationId);
  }
  return waiting;
}
