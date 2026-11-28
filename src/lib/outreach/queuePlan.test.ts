import { describe, expect, test } from "bun:test";
import { assignNewLeads, planMailboxQueues, type DatedNewLead, type DueFollowUp, type MailboxSlot, type QueueCampaign } from "./campaignMailboxes";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

function slots(...caps: Array<[string, number]>): MailboxSlot[] {
  return caps.map(([mailboxId, capacity]) => ({ mailboxId, currentAvailableCapacity: capacity, queue: [] }));
}
const day = (n: number) => new Date(Date.UTC(2026, 10, n));
function fresh(campaignId: string, n: number, createdDay = 1): DatedNewLead[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${campaignId}-new-${i}`, campaignId, createdAt: day(createdDay + i) }));
}
function due(campaignId: string, mailboxId: string, n: number): DueFollowUp[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${campaignId}-fu-${mailboxId.slice(-1)}-${i}`, campaignId, mailboxId }));
}
const campaign = (id: string, priority: string, mailboxIds: string[] | null = null): QueueCampaign => ({ id, priority, mailboxIds });
const queueOf = (all: MailboxSlot[], mailboxId: string) => all.find((slot) => slot.mailboxId === mailboxId)!.queue;

describe("planMailboxQueues", () => {
  test("all on medium: exactly the old two passes (follow-ups, then new leads round robin, oldest first)", () => {
    const campaigns = [campaign("c1", "medium"), campaign("c2", "medium")];
    const followUps = [...due("c1", A, 2), ...due("c2", B, 1)];
    const newLeads = [...fresh("c2", 3, 1), ...fresh("c1", 3, 2)];

    const planned = slots([A, 4], [B, 4]);
    const result = planMailboxQueues({ slots: planned, followUps, newLeads, campaigns });

    // The old algorithm, by hand: follow-ups onto their mailbox, then the merged, date-sorted new leads.
    const old = slots([A, 4], [B, 4]);
    for (const lead of followUps) queueOf(old, lead.mailboxId).push(lead.id);
    const merged = [...newLeads].sort((x, y) => x.createdAt!.getTime() - y.createdAt!.getTime());
    const oldNew = assignNewLeads(merged, old, new Map(campaigns.map((c) => [c.id, null])));

    expect(planned).toEqual(old);
    expect(result).toEqual({ followUpsQueued: 3, newLeadsQueued: oldNew });
  });

  test("an urgent campaign's new leads go before a low campaign's follow-ups", () => {
    const planned = slots([A, 2]);
    const result = planMailboxQueues({
      slots: planned,
      followUps: due("low", A, 2),
      newLeads: fresh("urgent", 2),
      campaigns: [campaign("low", "low"), campaign("urgent", "urgent")],
    });
    expect(queueOf(planned, A)).toEqual(["urgent-new-0", "urgent-new-1"]);
    expect(result).toEqual({ followUpsQueued: 0, newLeadsQueued: 2 });
  });

  test("within a priority, follow-ups still go before new leads", () => {
    const planned = slots([A, 2]);
    planMailboxQueues({
      slots: planned,
      followUps: due("h1", A, 1),
      newLeads: fresh("h2", 3),
      campaigns: [campaign("h1", "high"), campaign("h2", "high")],
    });
    expect(queueOf(planned, A)).toEqual(["h1-fu-a-0", "h2-new-0"]);
  });

  test("tiers in order urgent, high, medium, low; a lower tier only gets what is left", () => {
    const planned = slots([A, 5]);
    planMailboxQueues({
      slots: planned,
      followUps: [...due("med", A, 1), ...due("low", A, 1)],
      newLeads: [...fresh("low", 2, 1), ...fresh("med", 2, 2), ...fresh("high", 1, 3), ...fresh("urgent", 1, 4)],
      campaigns: [campaign("low", "low"), campaign("med", "medium"), campaign("high", "high"), campaign("urgent", "urgent")],
    });
    expect(queueOf(planned, A)).toEqual(["urgent-new-0", "high-new-0", "med-fu-a-0", "med-new-0", "med-new-1"]);
  });

  test("order of the queue is the order the tick sends: position 0 is the urgent lead", () => {
    const planned = slots([A, 3], [B, 3]);
    planMailboxQueues({
      slots: planned,
      followUps: [...due("low", A, 1), ...due("low", B, 1)],
      newLeads: [...fresh("medium", 2, 1), ...fresh("urgent", 2, 9)],
      campaigns: [campaign("low", "low"), campaign("medium", "medium"), campaign("urgent", "urgent")],
    });
    expect(queueOf(planned, A)[0]).toBe("urgent-new-0");
    expect(queueOf(planned, B)[0]).toBe("urgent-new-1");
    expect(queueOf(planned, A)).toEqual(["urgent-new-0", "medium-new-0", "low-fu-a-0"]);
    expect(queueOf(planned, B)).toEqual(["urgent-new-1", "medium-new-1", "low-fu-b-0"]);
  });

  test("a campaign limited to some mailboxes only fills those, even when urgent", () => {
    const planned = slots([A, 2], [B, 2]);
    const result = planMailboxQueues({
      slots: planned,
      followUps: [],
      newLeads: [...fresh("urgent", 3, 1), ...fresh("medium", 3, 5)],
      campaigns: [campaign("urgent", "urgent", [B]), campaign("medium", "medium")],
    });
    expect(queueOf(planned, B)).toEqual(["urgent-new-0", "urgent-new-1"]);
    expect(queueOf(planned, A)).toEqual(["medium-new-0", "medium-new-1"]);
    expect(result.newLeadsQueued).toBe(4);
  });

  test("a follow-up stays on its own mailbox even if another has room", () => {
    const planned = slots([A, 1], [B, 5]);
    planMailboxQueues({
      slots: planned,
      followUps: due("low", A, 2),
      newLeads: fresh("urgent", 1),
      campaigns: [campaign("low", "low"), campaign("urgent", "urgent")],
    });
    expect(queueOf(planned, A)).toEqual(["urgent-new-0"]);
    expect(queueOf(planned, B)).toEqual([]);
  });

  test("full mailboxes, unknown campaigns, follow-ups on mailboxes not in the plan, and repeated ids are skipped", () => {
    const planned = slots([A, 0], [B, 2]);
    const result = planMailboxQueues({
      slots: planned,
      followUps: [
        { id: "x", campaignId: "c", mailboxId: A },
        { id: "y", campaignId: "c", mailboxId: "00000000-0000-4000-8000-0000000000ff" },
        { id: "z", campaignId: "gone", mailboxId: B },
        { id: "w", campaignId: "c", mailboxId: B },
        { id: "w", campaignId: "c", mailboxId: B },
      ],
      newLeads: [{ id: "n", campaignId: "gone", createdAt: day(1) }],
      campaigns: [campaign("c", "high")],
    });
    expect(queueOf(planned, A)).toEqual([]);
    expect(queueOf(planned, B)).toEqual(["w"]);
    expect(result).toEqual({ followUpsQueued: 1, newLeadsQueued: 0 });
  });

  test("leads already queued on a slot keep their place and count against capacity", () => {
    const planned: MailboxSlot[] = [{ mailboxId: A, currentAvailableCapacity: 2, queue: ["earlier"] }];
    planMailboxQueues({ slots: planned, followUps: [], newLeads: fresh("urgent", 3), campaigns: [campaign("urgent", "urgent")] });
    expect(queueOf(planned, A)).toEqual(["earlier", "urgent-new-0"]);
  });

  test("new leads within a priority go oldest first across campaigns; a missing date counts as oldest", () => {
    const planned = slots([A, 4]);
    planMailboxQueues({
      slots: planned,
      followUps: [],
      newLeads: [
        { id: "late", campaignId: "h1", createdAt: day(9) },
        { id: "early", campaignId: "h2", createdAt: day(2) },
        { id: "undated", campaignId: "h2", createdAt: null },
        { id: "mid", campaignId: "h1", createdAt: day(5) },
      ],
      campaigns: [campaign("h1", "high"), campaign("h2", "high")],
    });
    expect(queueOf(planned, A)).toEqual(["undated", "early", "mid", "late"]);
  });

  test("an unexpected stored priority is treated as medium, not dropped", () => {
    const planned = slots([A, 3]);
    planMailboxQueues({
      slots: planned,
      followUps: [],
      newLeads: [...fresh("odd", 1, 1), ...fresh("low", 1, 2), ...fresh("high", 1, 3)],
      campaigns: [campaign("odd", "critical"), campaign("low", "low"), campaign("high", "high")],
    });
    expect(queueOf(planned, A)).toEqual(["high-new-0", "odd-new-0", "low-new-0"]);
  });
});
