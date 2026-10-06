import {
  RiAlarmWarningLine,
  RiBracesLine,
  RiChat3Line,
  RiForbidLine,
  RiLinkedinBoxFill,
  RiRefreshLine,
  RiSearchEyeLine,
  RiShieldCheckLine,
  RiTimeLine,
} from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureGrid, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section, Steps } from "@/components/marketing/blocks";
import { ACCENT } from "@/components/marketing/catalog";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ProductShot, SceneStage, StatBand } from "@/components/marketing/live";
import { AccountCards } from "@/components/marketing/pages/channels/AccountCards";
import { LimitReset } from "@/components/marketing/pages/channels/LimitReset";
import { PacingTimeline } from "@/components/marketing/pages/channels/PacingTimeline";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";

const PATH = "/product/linkedin";
const DESCRIPTION =
  "Open-source LinkedIn automation for multi-account outreach: invites, acceptance messages and follow-ups, paced in small runs inside daily limits and working hours.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "LinkedIn automation across many accounts",
  ogTitle: "LinkedIn automation across many accounts",
  eyebrow: "LinkedIn",
  description: DESCRIPTION,
});

const FAQ = [
  {
    q: "How does AgentSDR connect to LinkedIn?",
    a: "Through Unipile. You connect Unipile once for your organization, then add each LinkedIn profile from Settings → LinkedIn. Sign-in happens on Unipile's hosted page, so AgentSDR never sees your LinkedIn password. The same Unipile connection also powers WhatsApp.",
  },
  {
    q: "How many LinkedIn invitations does it send a day?",
    a: "30 a day for Premium or Sales Navigator accounts and 5 a day for free accounts, by default. They go out in runs of 3 to 4, 30 to 60 seconds apart, with a 30 to 60 minute rest between runs. All of it is editable in Sending rules, and a single account can override its own daily limit.",
  },
  {
    q: "Is LinkedIn automation safe?",
    a: "No tool can promise that. LinkedIn's terms do not allow automation and it can restrict accounts. AgentSDR keeps activity modest by default: small daily limits, short runs with long rests, working hours per account, and an automatic stop for the day if LinkedIn pushes back. Read the Responsible use page before you start.",
  },
  {
    q: "What does a LinkedIn sequence look like?",
    a: "A connection request (optionally with a note of up to 300 characters), an acceptance message sent once the lead accepts, then up to three follow-ups: 1 day after the acceptance message, 2 days after follow-up 1 and 3 days after follow-up 2. Any step can be left empty. The delays are fixed.",
  },
  {
    q: "What happens when a lead replies?",
    a: "The lead is marked Replied and every automated message stops, on LinkedIn and on their email and WhatsApp sequences too. The reply appears in Messages and, for regular campaigns, in Action required with an AI classification and a drafted answer. Nothing is sent until you approve it.",
  },
  {
    q: "Can I run several LinkedIn accounts in one campaign?",
    a: "Yes. Tick the senders that may send for a campaign and the engine runs every connected account within its own limit and working hours. If one account hits a limit, its lead goes back to Pending so another account or the next day can send it.",
  },
  {
    q: "Can it find leads on LinkedIn?",
    a: "LinkedIn Search runs LinkedIn people-search URLs in batches, one URL with one account or a CSV of company names and search URLs across several accounts. You export the people found and import them into a campaign. Each account can pull 400 search leads a day by default.",
  },
];

export default function LinkedinPage() {
  return (
    <>
      <JsonLd data={softwareLd(DESCRIPTION, PATH)} />
      <PageHero
        eyebrow="LinkedIn automation"
        eyebrowIcon={RiLinkedinBoxFill}
        title="LinkedIn automation across many accounts, paced like a person"
        lede="Connection requests, acceptance messages and follow-ups sent from every LinkedIn account you connect, in small runs inside daily limits and working hours. Replies stop the sequence and land in one AI inbox."
      >
        <HeroFrame>
          <ProductShot screen="inbox" />
        </HeroFrame>
      </PageHero>

      <Section id="multi-account" eyebrow="Multi-account outreach" title="One campaign, every account you connect" lede="Connect Unipile once, add each LinkedIn profile, and let a campaign draw on whichever of them is allowed to send.">
        <FeatureSplit
          eyebrow="Accounts"
          accent={ACCENT.linkedin}
          title="Add profiles through Unipile, never share a password"
          body="Each profile signs in on Unipile's hosted page, including any captcha or code. AgentSDR then lists it with its status, requests sent today, leads waiting and working hours."
          bullets={["Connected, Limit reached or Disconnected at a glance", "Reconnect an account in place; campaigns and history stay", "Premium and Sales Navigator accounts are labelled"]}
          visual={<AccountCards accent={ACCENT.linkedin} />}
        />
        <FeatureSplit
          reverse
          eyebrow="Sequence"
          accent={ACCENT.linkedin}
          title="Invite, then message once they accept"
          body="A sequence has a connection request, an acceptance message and up to three follow-ups, all optional. Merge fields come from your lead database and imported columns, and Preview renders a step for a real lead through the same path as the live sender."
          bullets={["Request notes are checked against LinkedIn's 300 character limit", "Fixed 1, 2 and 3 day gaps between follow-ups", "A person already contacted by an account is not invited again by it"]}
          visual={<SceneStage channel="linkedin" index={0} accent={ACCENT.linkedin} label="A LinkedIn sequence: a connection request, an acceptance message and three follow-ups. An illustration with sample data." />}
        />
        <FeatureSplit
          eyebrow="Search"
          accent={ACCENT.linkedin}
          title="Find people in batches, then import them"
          body="LinkedIn Search runs people-search URLs and collects who they return. Run one URL with one account, or a CSV of company names and search URLs across several, then export the leads into a campaign."
          bullets={["400 search leads per account per day by default", "A URL out of quota pauses and can be run again after the daily reset", "Search capacity today shows what is left"]}
          visual={<SceneStage channel="linkedin" index={2} accent={ACCENT.linkedin} label="A LinkedIn search running in a batch and its leads being exported. An illustration with sample data." />}
        />
      </Section>

      <Section id="safe-pacing" tone="grey" eyebrow="Safe pacing" title="Modest by default, adjustable by rule" lede="The numbers a careful person would stay under are the defaults. Change any of them in Sending rules, and the page warns you before you pass the safe edge.">
        <FeatureSplit
          eyebrow="Runs, not bursts"
          accent={ACCENT.linkedin}
          title="Short runs, long rests, a daily cap"
          body="An account sends 3 to 4 invitations, 30 to 60 seconds apart, then rests 30 to 60 minutes before its next run. The daily limit is 30 for Premium and Sales Navigator and 5 for free accounts. Flip the switch to see the same day on each."
          bullets={["Working hours per account, in its own timezone and days", "Nothing runs outside the window, not even profile lookups", "Older campaigns, then older leads, go first"]}
          visual={<PacingTimeline accent={ACCENT.linkedin} />}
        />
        <FeatureSplit
          reverse
          eyebrow="When LinkedIn pushes back"
          accent={ACCENT.linkedin}
          title="A limit stops the account for the day"
          body="If LinkedIn or Unipile refuses an invitation over a limit, quota or the weekly allowance, that account is marked Limit reached and stops. The lead goes back to Pending so another account or tomorrow can send it, and the daily reset clears the flag."
          bullets={["No manual restart needed", "Disconnected accounts are skipped until you reconnect", "Lower the daily limit if it keeps happening"]}
          visual={<LimitReset accent={ACCENT.linkedin} />}
        />
      </Section>

      <Section tone="white">
        <StatBand
          items={[
            { value: 30, label: "invitations a day for Premium accounts, by default" },
            { value: 5, label: "invitations a day for free accounts, by default" },
            { value: 3, suffix: " retries", label: "for a failed profile lookup or follow-up before a lead is Failed" },
            { value: 0, prefix: "$", label: "per seat or per LinkedIn account" },
          ]}
        />
      </Section>

      <Section id="replies" tone="grey" eyebrow="Replies" title="Answer from one inbox, with a draft ready">
        <FeatureSplit
          eyebrow="Messages"
          accent={ACCENT.linkedin}
          title="Replies stop the sequence and wait for you"
          body="Unipile sends AgentSDR an event for every message and accepted invitation, so there is no polling. A reply marks the lead Replied, ends their automated messages and puts the conversation under Needs reply."
          bullets={["Filter by campaign, sender, last activity or CRM category", "AI draft above the box: review, edit, Approve & send", "A reply on LinkedIn also stops that person's email and WhatsApp steps"]}
          visual={<SceneStage channel="linkedin" index={3} accent={ACCENT.linkedin} label="A LinkedIn reply arriving with an AI drafted answer. An illustration with sample data." />}
        />
      </Section>

      <Section id="details" eyebrow="The details" title="What keeps a LinkedIn campaign honest" lede="Guards that run on the server, so they hold no matter who clicks what.">
        <FeatureGrid
          items={[
            { icon: RiTimeLine, title: "Working hours", body: "Timezone, start, end and days per account, or one rule for every account without its own." },
            { icon: RiShieldCheckLine, title: "Never twice", body: "A request or message is claimed in the database first, so a step cannot be sent twice." },
            { icon: RiForbidLine, title: "Do Not Contact", body: "Checked across the workspace and again right before each send." },
            { icon: RiBracesLine, title: "Merge fields", body: "{{firstName}}, {{company}} and any imported column. Empty values resolve to nothing." },
            { icon: RiRefreshLine, title: "Bounded retries", body: "Lookups and follow-ups retry up to 3 times. A failed connection request is not retried, to avoid a duplicate." },
            { icon: RiAlarmWarningLine, title: "Limit pauses", body: "A refused invitation stops that account for the day and returns the lead to Pending." },
            { icon: RiSearchEyeLine, title: "Search capacity", body: "A daily quota per account, with paused URLs that resume after the reset." },
            { icon: RiChat3Line, title: "Personal campaigns", body: "Kept out of shared Messages, and their replies never reach the CRM." },
            { icon: RiLinkedinBoxFill, title: "Preview", body: "Render any step for a real lead and see invitations that run past 300 characters." },
          ]}
        />
      </Section>

      <Section tone="grey" id="get-started" eyebrow="Get started" title="From Unipile to first reply">
        <Steps
          items={[
            { title: "Connect Unipile", body: "Enter the DSN and access token. AgentSDR checks them and registers its own webhooks." },
            { title: "Add LinkedIn accounts", body: "Sign each profile in on Unipile's page, then set its daily limit and working hours." },
            { title: "Build the campaign", body: "Import leads, choose senders and write the request, acceptance message and follow-ups." },
            { title: "Launch and reply", body: "Replies arrive in Messages and Action required with a draft waiting for approval." },
          ]}
        />
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/product/email", "/product/whatsapp", "/product/inbox", "/product/ai-crm", "/guides/linkedin-automation-limits", "/solutions/agencies"]} />

      <ClosingCta title="Run LinkedIn outreach you control" lede="Clone the repo, connect Unipile and launch a paced campaign from your own accounts. LinkedIn restricts automation, so read Responsible use first." />
    </>
  );
}
