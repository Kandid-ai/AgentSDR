/**
 * Sample Action required rows for the landing page, shaped like the rows
 * GET /api/crm/actions returns (what src/components/crm/CrmActionsClient.tsx
 * reads through describeAction), so the real ActionRows / ActionCard render
 * them. Every person, company and message here is fictional.
 *
 * Built from `now` at render time: the rows show "2h ago" and "in 3h", and a
 * module-level clock would drift between the server render and hydration.
 *
 * Ids are placeholders. The row's hover prefetch of /crm/records/:id is
 * answered by the Showcase's API sandbox, never the real API.
 */

type Data = Record<string, unknown>;

/** The taxonomy the classification picker lists (the seeded default subcategories). */
export const CATEGORIES: Data[] = [
  {
    key: "interested",
    subcategories: [
      { id: "s-info", name: "Information Requested", categoryKey: "interested" },
      { id: "s-demo", name: "Demo Requested", categoryKey: "interested" },
      { id: "s-meet", name: "Meeting Requested", categoryKey: "interested" },
      { id: "s-done", name: "Meeting Done", categoryKey: "interested" },
      { id: "s-trial", name: "Trial Requested", categoryKey: "interested" },
    ],
  },
  { key: "customer", subcategories: [{ id: "s-cust", name: "Customer", categoryKey: "customer" }] },
  {
    key: "not_interested",
    subcategories: [
      { id: "s-later", name: "Not Required Right Now", categoryKey: "not_interested" },
      { id: "s-dnc", name: "Do Not Contact", categoryKey: "not_interested" },
    ],
  },
  {
    key: "other",
    subcategories: [
      { id: "s-ooo", name: "Out of Office", categoryKey: "other" },
      { id: "s-poc", name: "Connected to Different POC", categoryKey: "other" },
    ],
  },
];

const MIN = 60_000;
const HOUR = 60 * MIN;

function row(now: number, spec: {
  id: string;
  name: string;
  company: string;
  channel: "email" | "linkedin" | "whatsapp";
  category: string;
  subcategoryId: string;
  subcategory: string;
  repliedMinutesAgo: number;
  reply: string;
  subject?: string;
  draft?: string;
  dueState: string;
  dueInMinutes?: number;
  sequence?: string;
  step?: string;
  actionType?: string;
  proposed?: { categoryKey: string; subcategoryId: string };
}): Data {
  const repliedAt = new Date(now - spec.repliedMinutesAgo * MIN).toISOString();
  const dueAt = spec.dueInMinutes === undefined ? null : new Date(now + spec.dueInMinutes * MIN).toISOString();
  return {
    id: spec.id,
    name: spec.name,
    channel: spec.channel,
    category: spec.category,
    dueState: spec.dueState,
    dueAt,
    actionType: spec.actionType ?? (spec.draft ? "Reply review" : "Human review"),
    latestInboundExcerpt: spec.reply,
    record: {
      categoryKey: spec.category,
      subcategoryId: spec.subcategoryId,
      contextVersion: 3,
      lastInboundAt: repliedAt,
      lastOutboundAt: new Date(now - 3 * 24 * HOUR).toISOString(),
    },
    person: {},
    company: { name: spec.company },
    subcategory: { name: spec.subcategory },
    latestInbound: { bodyText: spec.reply, subject: spec.subject ?? "", sentAt: repliedAt },
    classification: spec.proposed
      ? { status: "proposed", category: spec.category, proposedCategoryKey: spec.proposed.categoryKey, proposedSubcategoryId: spec.proposed.subcategoryId }
      : { status: "auto_applied", category: spec.category },
    draft: spec.draft ? { id: "d", status: "awaiting_review", aiBodyText: spec.draft, revision: 1, expectedContextVersion: 3, subject: spec.subject ? `Re: ${spec.subject}` : "" } : {},
    activeRun: spec.sequence ? { run: { id: "r" }, sequence: { name: spec.sequence }, step: { name: spec.step ?? "Immediate reply" } } : {},
    contactPolicy: {},
  };
}

export function actionRows(now: number): Data[] {
  return [
    row(now, {
      id: "sample-1",
      name: "Hannah Weiss",
      company: "Lumen Freight",
      channel: "email",
      category: "interested",
      subcategoryId: "s-meet",
      subcategory: "Meeting Requested",
      repliedMinutesAgo: 14,
      subject: "Outbound for the ops team",
      reply: "This is timely — we're rebuilding outbound this quarter. Could you do Thursday afternoon?",
      draft: "Hi Hannah — Thursday works. I've held 3:00pm CET; here's the invite link so you can move it if needed. I'll bring the reply-rate numbers from teams your size.",
      dueState: "immediate_reply",
      sequence: "Meeting Requested",
      step: "Immediate reply",
    }),
    row(now, {
      id: "sample-2",
      name: "Rafael Costa",
      company: "Brightloop",
      channel: "linkedin",
      category: "interested",
      subcategoryId: "s-info",
      subcategory: "Information Requested",
      repliedMinutesAgo: 52,
      reply: "Interesting. Does it work with our own Google Workspace mailboxes, or do we need new ones?",
      draft: "It sends from the Workspace mailboxes you already have — each one gets its own daily limit and sending window. Happy to show you the setup in 15 minutes.",
      dueState: "immediate_reply",
      sequence: "Information Requested",
      step: "Share information",
    }),
    row(now, {
      id: "sample-3",
      name: "Aiko Tanaka",
      company: "Kestrel Health",
      channel: "whatsapp",
      category: "other",
      subcategoryId: "s-poc",
      subcategory: "Connected to Different POC",
      repliedMinutesAgo: 95,
      reply: "I've moved teams — Daniel runs growth now, I'll forward this to him.",
      dueState: "immediate_reply",
      actionType: "Classification review",
      proposed: { categoryKey: "interested", subcategoryId: "s-info" },
    }),
    row(now, {
      id: "sample-4",
      name: "Marcus Lindqvist",
      company: "Oakridge Capital",
      channel: "email",
      category: "interested",
      subcategoryId: "s-demo",
      subcategory: "Demo Requested",
      repliedMinutesAgo: 60 * 26,
      subject: "Quick question on pricing",
      reply: "Before a demo — is there a per-seat fee? We'd have a few reps on it.",
      draft: "No per-seat fee — you host it yourself. The running costs are your server and your own AI usage through your OpenRouter key. Want me to walk you through a deploy?",
      dueState: "follow_up_ready",
      dueInMinutes: -60 * 3,
      sequence: "Demo Requested",
      step: "Follow-up 2 · Share information",
    }),
    row(now, {
      id: "sample-5",
      name: "Chloé Martin",
      company: "Atelier Nord",
      channel: "linkedin",
      category: "not_interested",
      subcategoryId: "s-later",
      subcategory: "Not Required Right Now",
      repliedMinutesAgo: 60 * 5,
      reply: "Not this quarter, but reach out again in January.",
      dueState: "follow_up",
      dueInMinutes: 60 * 24 * 92,
      sequence: "Not Required Right Now",
      step: "Check back in January",
      actionType: "Follow-up review",
    }),
  ];
}
