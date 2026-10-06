import CampaignDetailClient from "@/components/outreach/CampaignDetailClient";
import type { CampaignPulse, DailySends, LeadPage } from "@/lib/outreach/campaigns";
import type { mailboxes, outreachCampaigns } from "@/lib/outreach/schema";
import { AppScreen } from "../Shell";
import { mockRoutes } from "../mock";
import { ClickOnMount } from "./openRow";

type Campaign = typeof outreachCampaigns.$inferSelect;
type Mailbox = typeof mailboxes.$inferSelect;

const campaign: Campaign = {
  organizationId: "org_northstar",
  id: "ec1",
  name: "Heads of Sales · US SaaS",
  status: "active",
  sequence: [
    {
      stepNumber: 1,
      subject: "Quick question about {{company}}'s outbound",
      body: "Hi {{firstName}},\n\nI noticed {{company}} is hiring on the revenue team. Most sales leaders I talk to at that stage want more meetings without adding SDR headcount.\n\nNorthstar runs outbound end to end: research, personalised first emails, follow-ups and reply handling. Worth a 15 minute look?\n\nAlex",
      waitDays: 0,
    },
    {
      stepNumber: 2,
      subject: "Re: Quick question about {{company}}'s outbound",
      body: "Hi {{firstName}}, floating this back up. Teams like {{company}} typically book 3x more meetings from the same lead list in the first month. Happy to show you how.\n\nAlex",
      waitDays: 3,
    },
    {
      stepNumber: 3,
      subject: "Re: Quick question about {{company}}'s outbound",
      body: "{{firstName}}, one last note. If outbound is not a priority right now, no problem at all. If it is, I can send over a two page overview.\n\nAlex",
      waitDays: 5,
    },
  ],
  createdAt: new Date("2026-09-02T14:30:00Z"),
  updatedAt: new Date("2026-09-30T09:00:00Z"),
};

const mailbox = (id: string, email: string, name: string) =>
  ({ id, emailAddress: email, displayName: name, status: "connected", dailySendLimit: 40, todayEmailsSent: 22 }) as unknown as Mailbox;
const mailboxList = [mailbox("mb1", "alex@northstar.io", "Alex Morgan"), mailbox("mb2", "sam@northstar.io", "Sam Reid")];

const stats = {
  totalLeads: 1240,
  pending: 180,
  inSequence: 720,
  replied: 96,
  completed: 120,
  bounced: 31,
  suppressed: 93,
  emailsSent: 3410,
  emailsScheduled: 1260,
  emailsFailed: 12,
  emailsTotal: 4682,
  contacted: 1060,
};

const stepBreakdown = [
  { stepNumber: 1, sent: 1060 },
  { stepNumber: 2, sent: 1520 },
  { stepNumber: 3, sent: 830 },
];

// A 30-day window ending today, ramping up through the first weeks. Weekends are quiet.
const dailySends: DailySends = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  const base = Math.round(70 + i * 3.2 + ((i * 37) % 23));
  return { date: d.toISOString().slice(0, 10), sent: weekend ? Math.round(base * 0.15) : base, scheduled: 0, failed: i % 9 === 4 ? 2 : 0 };
});

const leadPage: LeadPage = {
  leads: [],
  total: 1240,
  page: 1,
  pageSize: 50,
  counts: { all: 1240, pending: 180, in_sequence: 720, replied: 96, completed: 120, bounced: 31, suppressed: 93 },
  sequenceLength: 3,
};

const pulse: CampaignPulse = {
  followUpsToday: 142,
  newLeadsReachedToday: 64,
  activeSequences: 3,
  nextSendAt: new Date(Date.now() + 8 * 60_000),
};

mockRoutes([{ match: "/api/outreach/campaigns/", respond: () => ({ leads: [], total: 1240, page: 1, pageSize: 50, counts: leadPage.counts, sequenceLength: 3 }) }]);

function Detail() {
  return (
    <main className="h-full overflow-hidden bg-bg-white-0">
      <CampaignDetailClient campaign={campaign} stats={stats} mailboxes={mailboxList} leadPage={leadPage} stepBreakdown={stepBreakdown} dailySends={dailySends} pulse={pulse} />
    </main>
  );
}

/** Email → a campaign: the real CampaignDetailClient on its Sequence tab (Day 0 and two follow-ups with merge fields). */
export function EmailCampaign() {
  return (
    <AppScreen path="/outreach/campaigns/ec1" active="/outreach/campaigns">
      <ClickOnMount label="Sequence">
        <Detail />
      </ClickOnMount>
    </AppScreen>
  );
}
