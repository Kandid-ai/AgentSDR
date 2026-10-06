import { MessagesLayout } from "@/components/linkedin/MessagesLayout";
import type { ConnectionItem } from "@/lib/linkedin/messages/connectionList";
import type { InboxCrmContext, InboxCrmSummary } from "@/lib/linkedin/messages/crmContext";
import { AppScreen } from "../Shell";
import { mockRoutes } from "../mock";
import { OpenRow, ago } from "./openRow";

const alex = { id: "a1", username: "alex-morgan", name: "Alex Morgan", profilePictureUrl: null };
const sam = { id: "a2", username: "sam-reid", name: "Sam Reid", profilePictureUrl: null };
const jordan = { id: "a3", username: "jordan-lee", name: "Jordan Lee", profilePictureUrl: null };
const accounts = [alex, sam, jordan];
const campaigns = [
  { id: "c1", name: "Heads of Sales · US SaaS" },
  { id: "c2", name: "VP Revenue · Fintech" },
  { id: "c3", name: "CROs · Healthtech" },
];

const crm = (id: string, sub: string, hasDraft: boolean, category = "interested"): InboxCrmSummary => ({
  recordId: `rec-${id}`,
  workflowState: "action_required",
  categoryKey: category,
  subcategoryId: `sub-${sub}`,
  subcategoryName: sub,
  nextActionAt: null,
  sequenceName: "Warm reply",
  step: hasDraft ? { position: 1, total: 3, name: "Reply", type: "reply", status: "awaiting_review", dueAt: null } : null,
  hasDraft,
});

const conn = (
  id: string,
  name: string,
  headline: string,
  hoursAgo: number,
  last: string,
  unseen: number,
  campaign: (typeof campaigns)[number],
  sender: typeof alex,
  summary: InboxCrmSummary,
): ConnectionItem => ({
  id,
  name,
  headline,
  profilePictureUrl: null,
  linkedinUrl: `https://www.linkedin.com/in/${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
  providerId: `prov-${id}`,
  chatId: `chat-${id}`,
  connectedAt: ago(hoursAgo + 120),
  leadStatus: "REPLIED",
  campaignId: campaign.id,
  campaignName: campaign.name,
  linkedInAccountId: sender.id,
  linkedInAccountUsername: sender.username,
  linkedInAccountName: sender.name,
  linkedInAccountPicture: null,
  lastMessage: { text: last, type: "RECEIVED", createdAt: ago(hoursAgo) },
  unseenCount: unseen,
  crm: summary,
});

const connections: ConnectionItem[] = [
  conn("l1", "Daniel Okafor", "Head of Sales at Brightloop", 0.5, "Interesting — can you send a short deck?", 1, campaigns[0], alex, crm("daniel", "Asked for info", true)),
  conn("l2", "Aiko Tanaka", "Head of Sales at Lumen Freight", 2.1, "Thanks for connecting. What does onboarding look like?", 1, campaigns[0], sam, crm("aiko", "Question", true)),
  conn("l3", "Grace Kim", "VP Sales at Atlas Pay", 3.4, "Yes, let's find 20 minutes next week.", 0, campaigns[1], jordan, crm("grace", "Meeting requested", true)),
  conn("l4", "Omar Haddad", "Head of Revenue at Stackwise", 6.8, "We already use an SDR agency, but curious how you compare.", 0, campaigns[1], jordan, crm("omar", "Curious", false)),
  conn("l5", "Leo Rossi", "Sales Director at Brightwave", 22, "Can you share pricing?", 0, campaigns[0], alex, crm("leo", "Pricing", true)),
  conn("l6", "Chloé Martin", "Head of Sales at Atelier Nord", 27, "Not a priority this quarter, try me in January.", 0, campaigns[2], sam, crm("chloe", "Not now", false, "other")),
  conn("l7", "Hannah Weiss", "VP Growth at Copperline", 49, "Appreciate it, but we are all set.", 0, campaigns[2], jordan, crm("hannah", "Not interested", false, "not_interested")),
];

const daniel = connections[0];
const threadMessages = [
  { id: "t1", type: "INVITATION", text: "Hi Daniel, I work with sales leaders at SaaS teams on outbound that books meetings on its own. Would love to connect.", seen: true, createdAt: ago(122) },
  { id: "t2", type: "ACCEPTANCE", text: "Thanks for connecting, Daniel. Northstar runs outbound end to end, from research to follow-ups, for teams like Brightloop. Happy to share how it works if useful.", seen: true, createdAt: ago(100) },
  { id: "t3", type: "FOLLOW_UP_1", text: "Quick follow-up. Teams using Northstar book 3x more meetings from the same list. Worth a look?", seen: true, createdAt: ago(52) },
  { id: "t4", type: "RECEIVED", text: "Interesting — can you send a short deck?", seen: false, createdAt: ago(0.5) },
];

const context: InboxCrmContext = {
  ...(daniel.crm as InboxCrmSummary),
  conversationId: "conv-daniel",
  contextVersion: 3,
  doNotContact: false,
  classificationId: "cls-daniel",
  draft: {
    id: "draft-daniel",
    revision: 1,
    status: "awaiting_review",
    subject: null,
    body: "Happy to, Daniel. I'll attach a short deck showing how Northstar runs outbound end to end for a team like Brightloop's. If it looks relevant, I can walk you through it in 15 minutes on Thursday. Does 2pm work?",
    stepType: "reply",
    stepName: "Reply",
    error: null,
  },
};

mockRoutes([
  { match: "/api/linkedin/messages/connections", respond: () => ({ ok: true, connections, totalCount: connections.length, hasMore: false, page: 1 }) },
  { match: "/api/linkedin/messages/thread", respond: () => ({ ok: true, messages: threadMessages }) },
  { match: "/api/linkedin/messages/crm-context", respond: () => ({ context }) },
  {
    match: "/api/crm/categories",
    respond: () => ({
      categories: [
        { key: "interested", label: "Interested", subcategories: [{ id: "sub-Asked for info", name: "Asked for info", categoryKey: "interested" }] },
        { key: "not_interested", label: "Not interested", subcategories: [] },
        { key: "other", label: "Other", subcategories: [] },
      ],
    }),
  },
  {
    match: "/api/crm/records/",
    respond: () => ({
      id: "rec-daniel",
      person: { id: "p-daniel", fullName: "Daniel Okafor", title: "Head of Sales", email: "daniel@brightloop.com", phone: null, linkedinUrl: daniel.linkedinUrl, company: "Brightloop" },
      company: { name: "Brightloop", domain: "brightloop.com" },
      categoryKey: "interested",
      subcategory: "Asked for info",
      workflowState: "action_required",
      lastInboundAt: ago(0.5),
      lastOutboundAt: ago(52),
      nextActionAt: null,
      dnc: false,
      runs: [{ run: { status: "active" }, sequence: { name: "Warm reply" } }],
    }),
  },
]);

/** LinkedIn → Messages: the real MessagesLayout with Daniel's thread open and the AI draft in the composer. */
export function LinkedinMessages() {
  return (
    <AppScreen path="/linkedin/messages" active="/linkedin/messages">
      <main className="relative h-full overflow-hidden bg-bg-white-0 px-8 py-6 text-text-strong-950 [&_.max-w-3xl]:!pb-44">
        <OpenRow text="Daniel Okafor" thenButton="Review draft">
          <MessagesLayout campaigns={campaigns} accounts={accounts} initialList={{ connections, totalCount: connections.length, hasMore: false }} />
        </OpenRow>
      </main>
    </AppScreen>
  );
}
