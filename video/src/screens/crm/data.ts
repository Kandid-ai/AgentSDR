import { CATEGORIES } from "@/components/landing/data/crm";

/** Fictional CRM sample data for the film, shaped like what /api/crm/* returns. */
export type Data = Record<string, unknown>;

export { CATEGORIES };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Rows are dated relative to the render, so "9m ago" reads true. */
export const NOW = Date.now();

type Stage = "needs_action" | "waiting" | "exhausted";

type Spec = {
  id: string;
  name: string;
  title?: string;
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
  stage?: Stage;
  sentDaysAgo?: number;
};

function row(spec: Spec): Data {
  const repliedAt = new Date(NOW - spec.repliedMinutesAgo * MIN).toISOString();
  const dueAt = spec.dueInMinutes === undefined ? null : new Date(NOW + spec.dueInMinutes * MIN).toISOString();
  return {
    id: spec.id,
    name: spec.name,
    channel: spec.channel,
    category: spec.category,
    dueState: spec.dueState,
    dueAt,
    stage: spec.stage ?? "needs_action",
    actionType: spec.actionType ?? (spec.draft ? "Reply review" : "Human review"),
    latestInboundExcerpt: spec.reply,
    record: {
      categoryKey: spec.category,
      subcategoryId: spec.subcategoryId,
      contextVersion: 3,
      lastInboundAt: repliedAt,
      lastOutboundAt: new Date(NOW - (spec.sentDaysAgo ?? 3) * DAY).toISOString(),
    },
    person: { title: spec.title },
    company: { name: spec.company },
    subcategory: { name: spec.subcategory },
    latestInbound: { bodyText: spec.reply, subject: spec.subject ?? "", sentAt: repliedAt },
    classification: { status: "auto_applied", category: spec.category },
    draft: spec.draft ? { id: `d-${spec.id}`, status: "awaiting_review", aiBodyText: spec.draft, revision: 1, expectedContextVersion: 3, subject: spec.subject ? `Re: ${spec.subject}` : "" } : {},
    activeRun: spec.sequence ? { run: { id: `r-${spec.id}` }, sequence: { name: spec.sequence }, step: { name: spec.step ?? "Immediate reply" } } : {},
    contactPolicy: {},
  };
}

export const ACTIONS: Data[] = [
  row({ id: "maya", name: "Maya Chen", title: "VP Sales", company: "Northwind Labs", channel: "email", category: "interested", subcategoryId: "s-meet", subcategory: "Meeting Requested", repliedMinutesAgo: 9, subject: "Outbound at Northwind", reply: "Sure — what would that look like for us? Thursday afternoon could work.", draft: "Hi Maya — Thursday works. 2:00 or 3:30 PM PT? I'll send a 20-minute invite and walk you through it.", dueState: "immediate_reply", sequence: "Meeting requested", step: "Immediate reply" }),
  row({ id: "daniel", name: "Daniel Okafor", title: "Head of Growth", company: "Brightloop", channel: "linkedin", category: "interested", subcategoryId: "s-info", subcategory: "Information Requested", repliedMinutesAgo: 31, reply: "Interesting — can you send a short deck?", draft: "Absolutely, Daniel — here's a 6-slide deck on how teams like Brightloop run outbound from their own mailboxes. Happy to walk through it in 15 minutes if useful.", dueState: "immediate_reply", sequence: "Send a deck", step: "Send the deck" }),
  row({ id: "priya", name: "Priya Raman", title: "Revenue Operations", company: "Ledgerly", channel: "whatsapp", category: "interested", subcategoryId: "s-meet", subcategory: "Meeting Requested", repliedMinutesAgo: 47, reply: "Can we do Thursday instead?", draft: "Thursday is perfect, Priya. Does 11:00 AM GMT work? I'll send the invite as soon as you confirm.", dueState: "immediate_reply", sequence: "Meeting requested", step: "Immediate reply" }),
  row({ id: "ethan", name: "Ethan Brooks", title: "Director of Sales", company: "Oakridge Cloud", channel: "email", category: "other", subcategoryId: "s-poc", subcategory: "Connected to Different POC", repliedMinutesAgo: 80, subject: "Re: Outbound for Oakridge", reply: "Not the right person — talk to Mia on our RevOps team.", draft: "Thanks for pointing me to Mia, Ethan — I'll reach out to her directly and mention you suggested it.", dueState: "immediate_reply", sequence: "Wrong person — ask for referral", step: "Thank and ask for intro" }),
  row({ id: "grace", name: "Grace Kim", title: "COO", company: "Atlas Pay", channel: "email", category: "interested", subcategoryId: "s-demo", subcategory: "Demo Requested", repliedMinutesAgo: 140, subject: "Atlas Pay + AgentSDR", reply: "Could we see a live demo with our own CRM fields? Our reps live in HubSpot.", draft: "Yes — the demo can run on a HubSpot-synced list so you see your own fields. Would Tuesday at 10:00 AM ET suit you?", dueState: "immediate_reply", sequence: "Demo requested", step: "Immediate reply" }),
  row({ id: "omar", name: "Omar Haddad", title: "Founder", company: "Stackwise", channel: "linkedin", category: "interested", subcategoryId: "s-info", subcategory: "Information Requested", repliedMinutesAgo: 60 * 5, reply: "How is this different from the sequencer we already use?", draft: "Short answer: replies are classified and answered in the same place, and you own the whole stack. I can show a side-by-side if helpful.", dueState: "immediate_reply", sequence: "Information requested", step: "Share information" }),
  row({ id: "aiko", name: "Aiko Tanaka", title: "Sales Lead", company: "Lumen Freight", channel: "email", category: "interested", subcategoryId: "s-info", subcategory: "Information Requested", repliedMinutesAgo: 60 * 26, subject: "Quick question on pricing", reply: "Is there a per-seat fee? A few of our reps would use it.", draft: "No per-seat fee — you host it yourself and pay only for your server and your own AI usage. Want me to walk you through a deploy?", dueState: "follow_up_ready", dueInMinutes: -60 * 30, sequence: "Information requested", step: "Follow-up 1" }),
  row({ id: "hannah", name: "Hannah Weiss", title: "VP Marketing", company: "Copperline", channel: "email", category: "interested", subcategoryId: "s-meet", subcategory: "Meeting Requested", repliedMinutesAgo: 60 * 52, subject: "Outbound for Copperline", reply: "Let's find time next week — mornings are best.", draft: "Great, Hannah — how about Tuesday at 9:30 AM PT? I'll hold it and send an invite.", dueState: "follow_up_ready", dueInMinutes: -60 * 50, sequence: "Meeting requested", step: "Follow-up 1" }),
  row({ id: "sofia", name: "Sofia Alvarez", title: "Head of Revenue", company: "Kestrel Health", channel: "email", category: "other", subcategoryId: "s-ooo", subcategory: "Out of Office", repliedMinutesAgo: 60 * 6, subject: "Auto-reply: Outbound for Kestrel", reply: "I'm out of the office until Oct 14 with limited access to email.", dueState: "follow_up", dueInMinutes: 60 * 24 * 13, sequence: "Out of office", step: "Check back after return", actionType: "Follow-up review" }),
  row({ id: "lucas", name: "Lucas Meyer", title: "CRO", company: "Parcelly", channel: "email", category: "not_interested", subcategoryId: "s-later", subcategory: "Not Required Right Now", repliedMinutesAgo: 60 * 8, subject: "Re: Outbound for Parcelly", reply: "Not this quarter, try me in January.", dueState: "follow_up", dueInMinutes: 60 * 24 * 92, sequence: "Not now — follow up in a quarter", step: "Check back in January", actionType: "Follow-up review" }),
];

/** The pipeline board: the same people, spread over the three stages. */
export const PIPELINE: Data[] = [
  { ...ACTIONS[0] }, { ...ACTIONS[1] }, { ...ACTIONS[2] }, { ...ACTIONS[3] },
  row({ id: "w-lucas", name: "Lucas Meyer", title: "CRO", company: "Parcelly", channel: "email", category: "not_interested", subcategoryId: "s-later", subcategory: "Not Required Right Now", repliedMinutesAgo: 60 * 8, reply: "Not this quarter, try me in January.", dueState: "follow_up", dueInMinutes: 60 * 24 * 92, sequence: "Not now — follow up in a quarter", step: "Check back in January", stage: "waiting", sentDaysAgo: 1 }),
  row({ id: "w-sofia", name: "Sofia Alvarez", title: "Head of Revenue", company: "Kestrel Health", channel: "email", category: "other", subcategoryId: "s-ooo", subcategory: "Out of Office", repliedMinutesAgo: 60 * 6, reply: "I'm out of the office until Oct 14 with limited access to email.", dueState: "follow_up", dueInMinutes: 60 * 24 * 13, sequence: "Out of office", step: "Check back after return", stage: "waiting", sentDaysAgo: 1 }),
  row({ id: "w-grace", name: "Grace Kim", title: "COO", company: "Atlas Pay", channel: "email", category: "interested", subcategoryId: "s-demo", subcategory: "Demo Requested", repliedMinutesAgo: 60 * 30, reply: "Thanks — sharing this with my team before we pick a time.", dueState: "follow_up", dueInMinutes: 60 * 24 * 2, sequence: "Demo requested", step: "Follow-up 2", stage: "waiting", sentDaysAgo: 1 }),
  row({ id: "x-omar", name: "Omar Haddad", title: "Founder", company: "Stackwise", channel: "linkedin", category: "interested", subcategoryId: "s-info", subcategory: "Information Requested", repliedMinutesAgo: 60 * 24 * 21, reply: "Let me think about it and come back to you.", dueState: "none", sequence: undefined, stage: "exhausted", sentDaysAgo: 9 }),
  row({ id: "x-hannah", name: "Hannah Weiss", title: "VP Marketing", company: "Copperline", channel: "email", category: "interested", subcategoryId: "s-meet", subcategory: "Meeting Requested", repliedMinutesAgo: 60 * 24 * 18, reply: "Interested, but this month is packed.", dueState: "none", stage: "exhausted", sentDaysAgo: 6 }),
].map((item, i) => (i < 4 ? { ...item, stage: "needs_action" } : item));

export const STAGE_COUNTS = { needs_action: 4, waiting: 3, exhausted: 2 };

type Seq = { id: string; name: string; description: string; steps: number; assigned: string[]; published?: boolean; version?: number; updatedDaysAgo: number };
export const SEQUENCES: Data[] = ([
  { id: "q1", name: "Meeting requested", description: "Reply fast with two times, send the invite, then nudge twice if they go quiet.", steps: 4, assigned: ["s-meet"], version: 6, updatedDaysAgo: 3 },
  { id: "q2", name: "Send a deck", description: "Share the short deck, offer a 15-minute walkthrough, follow up after two days.", steps: 3, assigned: ["s-info"], version: 4, updatedDaysAgo: 5 },
  { id: "q3", name: "Not now — follow up in a quarter", description: "Acknowledge, then check back on the date they gave with one fresh angle.", steps: 2, assigned: ["s-later"], version: 3, updatedDaysAgo: 9 },
  { id: "q4", name: "Wrong person — ask for referral", description: "Thank them, ask who owns outbound, and reach out to the referral by name.", steps: 3, assigned: ["s-poc"], version: 2, updatedDaysAgo: 12 },
  { id: "q5", name: "Demo requested", description: "Offer a live demo on their own CRM fields and confirm the time.", steps: 3, assigned: ["s-demo", "s-trial"], version: 5, updatedDaysAgo: 2 },
  { id: "q6", name: "Out of office", description: "Wait for the return date, then resurface at the top of their inbox.", steps: 2, assigned: ["s-ooo"], version: 1, updatedDaysAgo: 20 },
  { id: "q7", name: "Pricing objection", description: "Explain self-hosted pricing and what they actually pay for.", steps: 3, assigned: [], updatedDaysAgo: 1 },
] as Seq[]).map((s) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  status: "active",
  draftStepCount: s.steps,
  stepCount: s.steps,
  assignedSubcategoryIds: s.assigned,
  latestPublishedVersion: s.version ?? null,
  latestPublishedVersionId: s.version ? `v-${s.id}` : null,
  updatedAt: new Date(NOW - s.updatedDaysAgo * DAY).toISOString(),
}));

/** Maya Chen's record, shaped like GET /api/crm/records/:id. */
export const MAYA_RECORD: Data = (() => {
  const at = (minutesAgo: number) => new Date(NOW - minutesAgo * MIN).toISOString();
  return {
    id: "maya",
    personId: "p-maya",
    person: { id: "p-maya", name: "Maya Chen", firstName: "Maya", lastName: "Chen", title: "VP Sales", company: "Northwind Labs", email: "maya@northwindlabs.io", linkedinUrl: "https://www.linkedin.com/in/maya-chen-northwind", phone: "+1 415 555 0142" },
    workflowState: "action_required",
    activeChannel: "email",
    categoryKey: "interested",
    subcategoryId: "s-meet",
    subcategory: "Meeting Requested",
    contextVersion: 3,
    classification: { id: "c1", status: "auto_applied", category: "interested", confidence: 0.96, reason: "She asks what a meeting would look like and proposes Thursday afternoon." },
    lastInboundAt: at(9),
    nextActionAt: at(0),
    draft: { id: "d-maya", status: "awaiting_review", conversationId: "conv-email", channel: "email", subject: "Re: Outbound at Northwind", body: "Hi Maya — Thursday works. 2:00 or 3:30 PM PT? I'll send a 20-minute invite and walk you through it.\n\nAlex", revision: 1, expectedContextVersion: 3 },
    conversations: [
      { id: "conv-email", channel: "email", status: "open", accountName: "Alex Morgan", accountLabel: "alex@northstar.com", accountRef: "alex@northstar.com" },
      { id: "conv-li", channel: "linkedin", status: "open", accountName: "Alex Morgan", accountLabel: "Alex Morgan", accountRef: "alex-morgan" },
      { id: "conv-wa", channel: "whatsapp", status: "open", accountName: "Alex Morgan", accountLabel: "Alex Morgan", accountRef: "+1 415 555 0100" },
    ],
    timeline: [
      { id: "m1", direction: "outbound", channel: "email", subject: "Outbound at Northwind", body: "Hi Maya — Northwind is hiring SDRs while your reply times keep slipping. We run AI outbound from your own mailboxes and answer replies the same hour. Worth a quick look?\n\nAlex", sentAt: at(60 * 24 * 6) },
      { id: "m2", direction: "outbound", channel: "linkedin", body: "Hi Maya, sent you a note by email about outbound at Northwind — happy to share how teams like yours run it.", sentAt: at(60 * 24 * 4) },
      { id: "m3", direction: "outbound", channel: "whatsapp", body: "Hi Maya, Alex from Northstar. Following up on my email about outbound — 15 minutes this week?", sentAt: at(60 * 24 * 2) },
      { id: "m4", direction: "inbound", channel: "email", subject: "Re: Outbound at Northwind", body: "Sure — what would that look like for us? Thursday afternoon could work.", sentAt: at(9) },
    ],
    runs: [{ run: { id: "run1", status: "active", currentStepPosition: 1 }, sequence: { id: "q1", name: "Meeting requested" } }],
    stepRuns: [{ stepRun: { sequenceRunId: "run1" }, step: { name: "Immediate reply", position: 1 } }],
    events: [
      { id: "e1", type: "record.created", createdAt: at(60 * 24 * 6) },
      { id: "e2", type: "reply.received", createdAt: at(9) },
      { id: "e3", type: "classification.auto_applied", createdAt: at(8) },
      { id: "e4", type: "sequence.started", createdAt: at(8) },
      { id: "e5", type: "draft.generated", createdAt: at(7) },
    ],
    drafts: [],
    sendAttempts: [],
    citations: [],
  };
})();
