import { RiAlarmWarningLine, RiBarChartBoxFill, RiCalendarLine, RiLinkedinBoxFill, RiMailFill, RiRobot2Line, RiRouteLine, RiTimerLine, RiWhatsappFill, RiArrowUpDownLine } from "@remixicon/react";
import { Reveal } from "@/components/landing/Reveal";
import { ClosingCta, FaqSection, FeatureGrid, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section, Steps } from "@/components/marketing/blocks";
import { ACCENT } from "@/components/marketing/catalog";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ProductShot, StatBand } from "@/components/marketing/live";
import { ChannelRates, FunnelChart } from "@/components/marketing/pages/crm";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";

const PATH = "/product/analytics";
const DESCRIPTION =
  "Outbound sales analytics for email, LinkedIn and WhatsApp: replies, positive replies, meetings and customers by period and channel, plus what needs attention.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "Outbound sales analytics across every channel",
  ogTitle: "Outbound sales analytics",
  eyebrow: "Analytics",
  description: DESCRIPTION,
});

const FAQ = [
  {
    q: "What does the analytics page measure?",
    a: "Replies, positive replies, meetings, customers and median first response across your CRM, plus reach and reply rate for email, LinkedIn and WhatsApp. Each channel has its own tab with its own figures and per-campaign detail.",
  },
  {
    q: "How are meetings and customers counted?",
    a: "Positive, Meetings and Customers count distinct CRM records that moved into that stage during the period, so a record already there before the period is not counted again. Meeting no-shows are not counted as meetings.",
  },
  {
    q: "Does it track email opens and clicks?",
    a: "No. Opens and clicks are not recorded, so there are no open or click rates. Email figures are emails sent, leads contacted, replied, reply rate, bounced and unsubscribed.",
  },
  {
    q: "Can I compare with a previous period?",
    a: "Yes. Most figures carry a change badge comparing your period with the period of the same length that ends the day before it starts. For figures where lower is better, such as bounces, a decrease is shown as an improvement.",
  },
  {
    q: "Which date ranges can I choose?",
    a: "Last 7, 30 or 90 days, this month, last month or a custom range of up to 180 days. Days are cut in your browser's time zone, and the view and period are kept in the address so you can share a link.",
  },
  {
    q: "Is the conversion funnel a cohort?",
    a: "No. The funnel runs from Reached to Replied, Positive, Meeting and Customer using counts for the period. It is not one group of people followed from first touch to customer, so a later stage can include people reached before the period began.",
  },
  {
    q: "Can I see how well the AI classifies replies?",
    a: "Yes. The AI assistant card shows drafts generated and sent, replies classified and the override rate, which is the share of labels a person changed. It also splits sent drafts into unedited, edited and discarded.",
  },
];

const FIGURES = [
  { name: "Replies", what: "Inbound messages received in CRM conversations in the period, on any channel." },
  { name: "Positive", what: "Distinct records moved into Interested or Customer in the period." },
  { name: "Meetings", what: "Distinct records moved into a meeting or demo stage. No-shows are not counted." },
  { name: "Customers", what: "Distinct records moved into Customer in the period." },
  { name: "Median first response", what: "The median time from a lead's message to your next reply in that conversation." },
];

const TABS = [
  { icon: RiMailFill, color: ACCENT.email, name: "Email", items: ["Emails sent and leads contacted", "Replied and reply rate", "Bounced and unsubscribed", "Mailbox capacity today", "Campaigns for the period"] },
  { icon: RiLinkedinBoxFill, color: ACCENT.linkedin, name: "LinkedIn", items: ["Invites sent and accepted", "Acceptance rate", "Messages sent, replied, reply rate", "Daily invite capacity", "Accounts and connection state"] },
  { icon: RiWhatsappFill, color: ACCENT.whatsapp, name: "WhatsApp", items: ["Calls placed, connected, connect rate", "Talk time and average call", "Messages sent and received", "Chat reply rate and new chats", "Call outcomes"] },
];

export default function AnalyticsPage() {
  return (
    <>
      <JsonLd data={softwareLd(DESCRIPTION, PATH)} />
      <PageHero
        path={PATH}
        crumb="Analytics"
        eyebrow="Analytics"
        eyebrowIcon={RiBarChartBoxFill}
        title="Outbound sales analytics, from first touch to customer"
        lede="See which channel gets replies, which replies become meetings and which meetings become customers, across email, LinkedIn and WhatsApp, in one page and one period."
      >
        <HeroFrame>
          <ProductShot screen="analytics" initialView="overview" />
        </HeroFrame>
      </PageHero>

      <Section id="overview" eyebrow="Overview" title="The whole funnel on one screen" lede="The Overview starts with the conversations in your CRM, then shows where they came from. Every figure is for the period you pick.">
        <FeatureSplit
          eyebrow="Conversion funnel"
          accent={ACCENT.linkedin}
          title="Reached, replied, positive, meeting, customer"
          body="The funnel runs from the people you reached to the customers you closed. Counts are for the period, so you read it as how much of each stage happened, not as a single cohort."
          bullets={["Reached counts distinct people with any outbound touch", "Positive, Meeting and Customer count records that moved into the stage", "Every stage carries a change badge against the previous period"]}
          visual={<FunnelChart />}
        />
        <FeatureSplit
          reverse
          eyebrow="Channels"
          accent={ACCENT.linkedin}
          title="Which channel actually earns replies"
          body="One table compares Email, LinkedIn and WhatsApp by people reached, replied, reply rate and positive. Select a row to open that channel's own tab."
          bullets={["The same four columns for every channel", "Reached covers emails, invitations, messages and calls", "One click from the comparison to the detail"]}
          visual={<ChannelRates />}
        />
      </Section>

      <Section tone="grey" id="figures" eyebrow="Definitions" title="What each figure counts" lede="No vanity numbers. Every figure has a stated definition, so two people reading the page read the same thing.">
        <Reveal>
          <dl className="grid overflow-hidden rounded-3xl bg-black/[0.06] [gap:1px] ring-1 ring-black/[0.06] sm:grid-cols-2 lg:grid-cols-3">
            {FIGURES.map((f) => (
              <div key={f.name} className="bg-white px-6 py-6 sm:px-7">
                <dt className="text-[16px] font-medium text-[#141414]">{f.name}</dt>
                <dd className="mt-1.5 text-[14px] leading-[22px] text-[#656565]">{f.what}</dd>
              </div>
            ))}
            <div className="bg-white px-6 py-6 sm:px-7">
              <dt className="text-[16px] font-medium text-[#141414]">Change badge</dt>
              <dd className="mt-1.5 text-[14px] leading-[22px] text-[#656565]">Compares with the previous period of the same length. Green is better, red is worse, and for lower-is-better figures a decrease is green.</dd>
            </div>
          </dl>
        </Reveal>
      </Section>

      <Section id="channels" eyebrow="Per-channel views" title="A tab for every channel, with the detail behind it" lede="Each channel has a figure strip, a chart and per-campaign or per-account detail, using the numbers that channel can actually tell you.">
        <Reveal>
          <ul className="grid gap-4 lg:grid-cols-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <li key={tab.name} className="rounded-3xl bg-[#f7f7f8] p-6 ring-1 ring-black/[0.04]">
                  <p className="flex items-center gap-2 text-[18px] font-medium text-[#141414]">
                    <Icon className="size-5" style={{ color: tab.color }} aria-hidden="true" />
                    {tab.name}
                  </p>
                  <ul className="mt-4 grid gap-2.5">
                    {tab.items.map((i) => (
                      <li key={i} className="flex items-center gap-2.5 text-[14px] text-[#525866]">
                        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: tab.color }} />
                        {i}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Reveal>
        <p className="mx-auto mt-6 max-w-[40rem] text-center text-[14px] leading-[22px] text-[#6b6b6b]">Opens and clicks are not recorded, so there are no open or click rates. LinkedIn reply rate divides by accepted connections, not invites sent.</p>
        <div className="mt-10">
          <ProductShot screen="analytics" initialView="email" height="h-[480px] sm:h-[560px]" />
        </div>
      </Section>

      <Section tone="grey" id="stats" eyebrow="At a glance" title="Built into the same workspace">
        <StatBand
          items={[
            { value: 3, label: "channels compared side by side" },
            { value: 5, label: "funnel stages, from Reached to Customer" },
            { value: 180, suffix: " days", label: "longest custom range" },
            { value: 0, prefix: "$", label: "extra: analytics ship with every self-hosted install" },
          ]}
        />
      </Section>

      <Section id="details" eyebrow="The details" title="Made to act on, not just to look at" lede="Analytics is where you land after signing in, so it also tells you what is waiting.">
        <FeatureGrid
          items={[
            { icon: RiAlarmWarningLine, title: "Needs attention", body: "Action required, follow-ups due, drafts to review, failing mailboxes and disconnected LinkedIn or WhatsApp accounts, each linking to the fix." },
            { icon: RiCalendarLine, title: "Periods and ranges", body: "Last 7, 30 or 90 days, this month, last month or a custom range. One point a day up to 62 days, one a week beyond." },
            { icon: RiArrowUpDownLine, title: "Previous-period change", body: "Badges compare with the period before, and say New when there was nothing to compare with." },
            { icon: RiRouteLine, title: "Pipeline now", body: "Open records by category and how far along the funnel they are, plus stage moves this period." },
            { icon: RiRobot2Line, title: "AI assistant card", body: "Drafts generated and sent, replies classified, override rate, and sent drafts split into unedited, edited or discarded." },
            { icon: RiTimerLine, title: "Median first response", body: "How long it takes you to answer a lead's message, as a median rather than a flattering average." },
          ]}
        />
      </Section>

      <Section tone="grey" id="get-started" eyebrow="Reading it" title="How to use it each week">
        <Steps
          items={[
            { title: "Start with Needs attention", body: "Clear what is open: replies waiting, drafts to review, accounts that stopped sending." },
            { title: "Compare channels", body: "Find which channel earns replies and positive replies for the same list." },
            { title: "Check the funnel", body: "See where reached people stop: no reply, no positive reply or no meeting." },
            { title: "Open the channel tab", body: "Drill into a campaign, mailbox or account that is pulling the figure up or down." },
          ]}
        />
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/product/ai-crm", "/product/inbox", "/product/email", "/product/linkedin", "/product/whatsapp", "/solutions/sales-teams"]} />

      <ClosingCta title="Know which channel is working" lede="Run every channel from one self-hosted workspace and read the results in the same place. Open source, no seats, no per-contact pricing." />
    </>
  );
}
