/**
 * Which mailboxes an email campaign may send from. Pure, so the queue build,
 * the route and the tests share one set of rules.
 *
 * `outreach_campaigns.mailbox_ids` is null for "every connected mailbox"
 * (every campaign before the column existed, and the default) or a list.
 * The list only decides which mailbox a NEW lead is given: once a lead's
 * first email has gone out it stays on that mailbox, so its follow-ups reply
 * in the same Gmail thread even if the campaign's list changes later.
 */

import { CAMPAIGN_PRIORITIES, campaignPriorityOf } from "@/lib/campaigns/priority";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when a campaign with this setting may give a new lead to this mailbox. */
export function campaignMayUseMailbox(campaignMailboxIds: readonly string[] | null, mailboxId: string): boolean {
  return campaignMailboxIds === null || campaignMailboxIds.includes(mailboxId);
}

export type ParsedCampaignMailboxes = { ok: true; mailboxIds: string[] | null } | { ok: false; error: string };

/**
 * The `mailboxIds` of a campaign PATCH: null (all mailboxes) or a non-empty
 * list of ids, de-duplicated. Whether each id is one of the organization's
 * mailboxes is checked by the caller against the database.
 */
export function parseCampaignMailboxIds(value: unknown): ParsedCampaignMailboxes {
  if (value === null) return { ok: true, mailboxIds: null };
  if (!Array.isArray(value)) return { ok: false, error: "mailboxIds must be null (all mailboxes) or a list of mailbox ids" };
  if (value.length === 0) return { ok: false, error: "Choose at least one mailbox, or send null to use all of them" };
  if (!value.every((id) => typeof id === "string" && UUID.test(id))) return { ok: false, error: "mailboxIds must be mailbox ids" };
  return { ok: true, mailboxIds: [...new Set((value as string[]).map((id) => id.toLowerCase()))] };
}

export type NewLead = { id: string; campaignId: string };
export type MailboxSlot = { mailboxId: string; queue: string[]; currentAvailableCapacity: number };

/**
 * Gives new leads (oldest first) to mailboxes with spare capacity, round
 * robin, each only to a mailbox its campaign may use. With every campaign on
 * all mailboxes this is exactly the plain round robin the queue build always
 * did. A lead none of whose mailboxes has room is left for another day.
 * Mutates `slots[].queue`; returns how many leads were queued.
 */
export function assignNewLeads(
  leads: readonly NewLead[],
  slots: readonly MailboxSlot[],
  campaignMailboxIds: ReadonlyMap<string, readonly string[] | null>,
): number {
  const cycle = slots.filter((slot) => slot.queue.length < slot.currentAvailableCapacity);
  let queued = 0;
  for (const lead of leads) {
    if (cycle.length === 0) break;
    const allowed = campaignMailboxIds.get(lead.campaignId) ?? null;
    const index = cycle.findIndex((slot) => campaignMayUseMailbox(allowed, slot.mailboxId));
    if (index === -1) continue;
    const [slot] = cycle.splice(index, 1);
    slot.queue.push(lead.id);
    queued += 1;
    if (slot.queue.length < slot.currentAvailableCapacity) cycle.push(slot);
  }
  return queued;
}

/**
 * How many new leads to load for each campaign: the spare capacity of the
 * mailboxes it may use. Loading per campaign keeps one big campaign's backlog
 * from crowding out a campaign whose mailboxes it cannot use.
 */
export function spareCapacityFor(campaignMailboxIds: readonly string[] | null, slots: readonly MailboxSlot[]): number {
  return slots
    .filter((slot) => campaignMayUseMailbox(campaignMailboxIds, slot.mailboxId))
    .reduce((sum, slot) => sum + Math.max(0, slot.currentAvailableCapacity - slot.queue.length), 0);
}

export type DueFollowUp = { id: string; campaignId: string; mailboxId: string };
export type QueueCampaign = { id: string; priority: unknown; mailboxIds: readonly string[] | null };
export type DatedNewLead = NewLead & { createdAt: Date | null };

/**
 * Fills each mailbox's queue for the day, campaign priority first
 * (src/lib/campaigns/priority.ts). For each priority, Urgent to Low: that
 * priority's due follow-ups go on the mailbox that sent their first email
 * (in the order given: most overdue, then deepest into the sequence), then
 * its new leads, oldest first, round robin over the mailboxes each campaign
 * may use. A lower priority only gets the capacity a higher one left. With
 * every campaign on the same priority this is exactly the old two passes:
 * every follow-up, then new leads.
 *
 * Mutates `slots[].queue`; a lead whose mailboxes are full waits for another day.
 */
export function planMailboxQueues(input: {
  slots: readonly MailboxSlot[];
  followUps: readonly DueFollowUp[];
  newLeads: readonly DatedNewLead[];
  campaigns: readonly QueueCampaign[];
}): { followUpsQueued: number; newLeadsQueued: number } {
  const slotByMailbox = new Map(input.slots.map((slot) => [slot.mailboxId, slot]));
  const campaignById = new Map(input.campaigns.map((campaign) => [campaign.id, campaign]));
  const campaignMailboxIds = new Map(input.campaigns.map((campaign) => [campaign.id, campaign.mailboxIds ?? null]));
  const priorityOf = (campaignId: string) => campaignPriorityOf(campaignById.get(campaignId)?.priority);
  const queued = new Set(input.slots.flatMap((slot) => slot.queue));
  let followUpsQueued = 0;
  let newLeadsQueued = 0;
  for (const priority of CAMPAIGN_PRIORITIES) {
    for (const lead of input.followUps) {
      if (!campaignById.has(lead.campaignId) || priorityOf(lead.campaignId) !== priority || queued.has(lead.id)) continue;
      const slot = slotByMailbox.get(lead.mailboxId);
      if (!slot || slot.queue.length >= slot.currentAvailableCapacity) continue;
      slot.queue.push(lead.id);
      queued.add(lead.id);
      followUpsQueued += 1;
    }
    const fresh = input.newLeads
      .filter((lead) => campaignById.has(lead.campaignId) && priorityOf(lead.campaignId) === priority && !queued.has(lead.id))
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
    for (const lead of fresh) queued.add(lead.id);
    newLeadsQueued += assignNewLeads(fresh, input.slots, campaignMailboxIds);
  }
  return { followUpsQueued, newLeadsQueued };
}
