import {
  toSeries,
  type AnalyticsRange,
  type EmailAnalytics,
  type LinkedinAnalytics,
  type OverviewAnalytics,
  type WhatsappAnalytics,
} from "@/lib/analytics/contract";

/**
 * Sample responses for the landing page's live Analytics showcase, typed by
 * the real contract (src/lib/analytics/contract.ts) so the real views render
 * them exactly as they render GET /api/analytics/[view].
 *
 * Nothing here comes from a database. Every name is fictional; the volumes
 * are modelled on one small team running all three channels for four weeks
 * at the app's own guardrails (30 sends a day per mailbox, 30 invites a day
 * per premium LinkedIn account, 25 new WhatsApp chats a day per number).
 *
 * Deterministic on purpose (a seeded generator, fixed dates) so the server
 * render and the client render agree and the page never shifts on hydrate.
 */

export const RANGE: AnalyticsRange = { from: "2026-09-02", to: "2026-09-29", tz: "UTC", bucket: "day" };

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One value per day of RANGE: weekdays near `base`, weekends at `weekend` of it, drifting up by `growth` over the range. */
function daily(seed: number, base: number, { weekend = 0.18, growth = 0.25, jitter = 0.22 } = {}) {
  const rand = seeded(seed);
  const out: Array<{ date: string; value: number }> = [];
  const start = Date.parse(`${RANGE.from}T00:00:00Z`);
  for (let i = 0; i < 28; i++) {
    const d = new Date(start + i * 86_400_000);
    const day = d.getUTCDay();
    const trend = 1 + growth * (i / 27);
    const off = day === 0 || day === 6 ? weekend : 1;
    const value = Math.max(0, Math.round(base * trend * off * (1 - jitter + rand() * jitter * 2)));
    out.push({ date: d.toISOString().slice(0, 10), value });
  }
  return out;
}

function series<K extends string>(keys: readonly K[], columns: Record<K, Array<{ date: string; value: number }>>) {
  const rows = columns[keys[0]].map((row, i) => ({ date: row.date, ...Object.fromEntries(keys.map((k) => [k, columns[k][i].value])) }) as { date: string } & Record<K, number>);
  return toSeries(keys, RANGE, rows);
}

const sum = (rows: Array<{ value: number }>) => rows.reduce((t, r) => t + r.value, 0);
/** The last 14 points of a column, for a campaign row's sparkline. */
const trend = (seed: number, base: number) => daily(seed, base).slice(-14).map((r) => r.value);

// ---------------------------------------------------------------- overview

const interested = daily(11, 5.4);
const customer = daily(12, 0.5, { jitter: 0.9 });
const notInterested = daily(13, 4.1);
const other = daily(14, 3.2);
const unclassified = daily(15, 0.35, { jitter: 1 });

export const OVERVIEW: OverviewAnalytics = {
  view: "overview",
  range: RANGE,
  kpis: {
    reached: { value: 5_318, previous: 4_602 },
    replied: { value: 386, previous: 331 },
    positive: { value: 104, previous: 83 },
    meetings: { value: 37, previous: 29 },
    customers: { value: 6, previous: 4 },
  },
  funnel: [
    { key: "reached", label: "Reached", value: 5_318 },
    { key: "replied", label: "Replied", value: 386 },
    { key: "positive", label: "Positive", value: 104 },
    { key: "meeting", label: "Meeting", value: 37 },
    { key: "customer", label: "Customer", value: 6 },
  ],
  channels: [
    { channel: "email", reached: 2_874, replied: 118, replyRate: 118 / 2_874, positive: 29 },
    { channel: "linkedin", reached: 1_902, replied: 171, replyRate: 171 / 1_902, positive: 47 },
    { channel: "whatsapp", reached: 542, replied: 97, replyRate: 97 / 542, positive: 28 },
  ],
  attention: { actionRequired: 23, overdue: 4, draftsAwaitingReview: 11, mailboxesFailing: 0, linkedinDisconnected: 1, whatsappDisconnected: 0 },
  crm: {
    kpis: {
      replies: { value: 512, previous: 437 },
      classified: { value: 498, previous: 421 },
      draftsSent: { value: 214, previous: 168 },
      medianFirstResponseMinutes: { value: 38, previous: 71 },
      overrideRate: { value: 0.064, previous: 0.091 },
    },
    repliesByCategory: series(["interested", "customer", "not_interested", "other", "unclassified"] as const, {
      interested,
      customer,
      not_interested: notInterested,
      other,
      unclassified,
    }),
    pipeline: [
      { subcategoryId: "s-info", name: "Information Requested", categoryKey: "interested", stageRank: 1, count: 41 },
      { subcategoryId: "s-demo", name: "Demo Requested", categoryKey: "interested", stageRank: 1, count: 18 },
      { subcategoryId: "s-meet", name: "Meeting Requested", categoryKey: "interested", stageRank: 2, count: 22 },
      { subcategoryId: "s-done", name: "Meeting Done", categoryKey: "interested", stageRank: 3, count: 15 },
      { subcategoryId: "s-trial", name: "Trial User", categoryKey: "interested", stageRank: 5, count: 7 },
      { subcategoryId: "s-cust", name: "Customer", categoryKey: "customer", stageRank: 6, count: 9 },
      { subcategoryId: "s-later", name: "Not Required Right Now", categoryKey: "not_interested", stageRank: null, count: 64 },
      { subcategoryId: "s-ooo", name: "Out of Office", categoryKey: "other", stageRank: null, count: 27 },
      { subcategoryId: null, name: "Unclassified", categoryKey: "unclassified", stageRank: null, count: 5 },
    ],
    stageEntries: [
      { subcategoryId: "s-info", name: "Information Requested", categoryKey: "interested", entered: 46 },
      { subcategoryId: "s-meet", name: "Meeting Requested", categoryKey: "interested", entered: 29 },
      { subcategoryId: "s-demo", name: "Demo Requested", categoryKey: "interested", entered: 17 },
      { subcategoryId: "s-cust", name: "Customer", categoryKey: "customer", entered: 6 },
      { subcategoryId: "s-later", name: "Not Required Right Now", categoryKey: "not_interested", entered: 58 },
      { subcategoryId: "s-ooo", name: "Out of Office", categoryKey: "other", entered: 31 },
    ],
    drafts: { generated: 262, sentAsIs: 151, sentEdited: 63, discarded: 29, awaitingReview: 11 },
    workflow: [
      { key: "action_required", label: "Action required", value: 23 },
      { key: "waiting", label: "Waiting", value: 118 },
      { key: "idle", label: "Idle", value: 204 },
      { key: "closed", label: "Closed", value: 87 },
      { key: "paused", label: "Paused", value: 9 },
      { key: "error", label: "Error", value: 2 },
      { key: "unclassified", label: "Unclassified", value: 5 },
    ],
    attention: { actionRequired: 23, overdue: 4 },
  },
};

// ---------------------------------------------------------------- email

const firstTouch = daily(21, 64);
const followUp = daily(22, 58, { growth: 0.4 });
const emailReplies = daily(23, 5.2);

export const EMAIL: EmailAnalytics = {
  view: "email",
  range: RANGE,
  kpis: {
    sent: { value: sum(firstTouch) + sum(followUp), previous: 2_690 },
    contacted: { value: sum(firstTouch), previous: 1_402 },
    replied: { value: 118, previous: 97 },
    replyRate: { value: 118 / sum(firstTouch), previous: 97 / 1_402 },
    bounced: { value: 21, previous: 34 },
    unsubscribed: { value: 9, previous: 12 },
  },
  sends: series(["firstTouch", "followUp"] as const, { firstTouch, followUp }),
  replies: series(["replies"] as const, { replies: emailReplies }),
  failedSends: 0,
  campaigns: [
    { id: "e1", name: "Series A SaaS · Heads of Growth", status: "active", leads: 1_240, contacted: 812, sentInRange: 1_388, replied: 46, replyRate: 46 / 812, bounced: 7, trend: trend(31, 52) },
    { id: "e2", name: "Agencies · Founders (EU)", status: "active", leads: 860, contacted: 544, sentInRange: 902, replied: 31, replyRate: 31 / 544, bounced: 5, trend: trend(32, 34) },
    { id: "e3", name: "RevOps leaders · follow-up", status: "active", leads: 420, contacted: 402, sentInRange: 611, replied: 22, replyRate: 22 / 402, bounced: 4, trend: trend(33, 21) },
    { id: "e4", name: "Webinar attendees · Sept", status: "paused", leads: 310, contacted: 196, sentInRange: 244, replied: 12, replyRate: 12 / 196, bounced: 3, trend: trend(34, 9) },
    { id: "e5", name: "Dev-tools CTOs · pilot", status: "completed", leads: 180, contacted: 180, sentInRange: 118, replied: 7, replyRate: 7 / 180, bounced: 2, trend: trend(35, 4) },
  ],
  mailboxes: {
    total: 5,
    connected: 5,
    failing: 0,
    sentToday: 108,
    capacityToday: 150,
    rows: [
      { id: "m1", email: "maya@northwind.example", status: "active", sentToday: 23, dailyLimit: 30 },
      { id: "m2", email: "maya@mail.northwind.example", status: "active", sentToday: 22, dailyLimit: 30 },
      { id: "m3", email: "leo@northwind.example", status: "active", sentToday: 24, dailyLimit: 30 },
      { id: "m4", email: "leo@mail.northwind.example", status: "active", sentToday: 21, dailyLimit: 30 },
      { id: "m5", email: "team@northwind.example", status: "active", sentToday: 18, dailyLimit: 30 },
    ],
  },
};

// ---------------------------------------------------------------- linkedin

const invites = daily(41, 76);
const accepted = daily(42, 24);
const liReplied = daily(43, 7.4);
const invitesTotal = sum(invites);
const acceptedTotal = sum(accepted);
const liRepliedTotal = sum(liReplied);

export const LINKEDIN: LinkedinAnalytics = {
  view: "linkedin",
  range: RANGE,
  kpis: {
    invites: { value: invitesTotal, previous: 1_689 },
    accepted: { value: acceptedTotal, previous: 511 },
    acceptanceRate: { value: acceptedTotal / invitesTotal, previous: 511 / 1_689 },
    messages: { value: 1_436, previous: 1_190 },
    replied: { value: liRepliedTotal, previous: 138 },
    replyRate: { value: liRepliedTotal / acceptedTotal, previous: 138 / 511 },
  },
  activity: series(["invites", "accepted", "replied"] as const, { invites, accepted, replied: liReplied }),
  funnel: [
    { key: "invited", label: "Invited", value: invitesTotal },
    { key: "accepted", label: "Accepted", value: acceptedTotal },
    { key: "messaged", label: "Messaged", value: acceptedTotal - 21 },
    { key: "replied", label: "Replied", value: liRepliedTotal },
  ],
  accounts: [
    { id: "a1", name: "Maya Brandt", status: "CONNECTED", premium: true, sentToday: 30, dailyLimit: 30, pending: 412 },
    { id: "a2", name: "Leo Okafor", status: "CONNECTED", premium: true, sentToday: 26, dailyLimit: 30, pending: 358 },
    { id: "a3", name: "Priya Raman", status: "CONNECTED", premium: true, sentToday: 22, dailyLimit: 30, pending: 297 },
    { id: "a4", name: "Tomás Ibarra", status: "DISCONNECTED", premium: false, sentToday: 0, dailyLimit: 5, pending: 64 },
  ],
  campaigns: [
    { id: "l1", name: "Heads of Growth · US", status: "ACTIVE", leads: 940, invited: 822, accepted: 271, replied: 84, acceptanceRate: 271 / 822, replyRate: 84 / 271, trend: trend(51, 30) },
    { id: "l2", name: "Agency founders · EU", status: "ACTIVE", leads: 610, invited: 540, accepted: 176, replied: 49, acceptanceRate: 176 / 540, replyRate: 49 / 176, trend: trend(52, 20) },
    { id: "l3", name: "RevOps community", status: "ACTIVE", leads: 420, invited: 388, accepted: 131, replied: 33, acceptanceRate: 131 / 388, replyRate: 33 / 131, trend: trend(53, 14) },
    { id: "l4", name: "Event follow-up · SaaStr", status: "PAUSED", leads: 212, invited: 198, accepted: 71, replied: 19, acceptanceRate: 71 / 198, replyRate: 19 / 71, trend: trend(54, 6) },
  ],
};

// ---------------------------------------------------------------- whatsapp

const connectedCalls = daily(61, 9);
const notConnectedCalls = daily(62, 14);
const sent = daily(63, 24);
const received = daily(64, 13);
const callsTotal = sum(connectedCalls) + sum(notConnectedCalls);
const connectedTotal = sum(connectedCalls);
const talkMs = connectedTotal * 262_000;

export const WHATSAPP: WhatsappAnalytics = {
  view: "whatsapp",
  range: RANGE,
  kpis: {
    calls: { value: callsTotal, previous: 498 },
    connected: { value: connectedTotal, previous: 176 },
    connectRate: { value: connectedTotal / callsTotal, previous: 176 / 498 },
    talkTimeMs: { value: talkMs, previous: 176 * 241_000 },
    avgCallMs: { value: 262_000, previous: 241_000 },
    messagesSent: { value: sum(sent), previous: 521 },
    messagesReceived: { value: sum(received), previous: 288 },
    chatReplyRate: { value: 0.46, previous: 0.41 },
    newChats: { value: 214, previous: 187 },
  },
  calls: series(["connected", "notConnected"] as const, { connected: connectedCalls, notConnected: notConnectedCalls }),
  outcomes: [
    { key: "connected", label: "Connected", value: connectedTotal },
    { key: "didNotPickUp", label: "Did not pick up", value: Math.round(sum(notConnectedCalls) * 0.78) },
    { key: "notOnWhatsApp", label: "Not on WhatsApp", value: Math.round(sum(notConnectedCalls) * 0.17) },
    { key: "failed", label: "Failed", value: sum(notConnectedCalls) - Math.round(sum(notConnectedCalls) * 0.78) - Math.round(sum(notConnectedCalls) * 0.17) },
    { key: "inProgress", label: "In progress", value: 0 },
  ],
  messages: series(["sent", "received"] as const, { sent, received }),
  campaigns: [
    { id: "w1", name: "Demo no-shows · call back", leads: 120, calls: 214, connected: 91, connectRate: 91 / 214, dueToday: 8, trend: trend(71, 8) },
    { id: "w2", name: "Trial users · week 1 check-in", leads: 86, calls: 172, connected: 69, connectRate: 69 / 172, dueToday: 12, trend: trend(72, 6) },
    { id: "w3", name: "Inbound demo requests", leads: 64, calls: 131, connected: 58, connectRate: 58 / 131, dueToday: 5, trend: trend(73, 5) },
  ],
  accounts: [
    { id: "n1", name: "Maya · Sales", phone: "+44 7700 900418", status: "connected", newChats24h: 17, newChatLimit: 25, warmingUpUntil: null },
    { id: "n2", name: "Leo · Sales", phone: "+44 7700 900266", status: "connected", newChats24h: 9, newChatLimit: 25, warmingUpUntil: null },
  ],
};
