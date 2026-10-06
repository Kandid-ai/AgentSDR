import {
  RiBracesLine,
  RiChatForwardLine,
  RiEyeLine,
  RiForbidLine,
  RiMailFill,
  RiMailUnreadLine,
  RiReplyLine,
  RiShuffleLine,
  RiSignalWifiErrorLine,
} from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureGrid, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section, Steps } from "@/components/marketing/blocks";
import { ACCENT } from "@/components/marketing/catalog";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ProductShot, SceneStage, StatBand } from "@/components/marketing/live";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";

const PATH = "/product/email";
const DESCRIPTION =
  "Open-source cold email software that sends multi-step sequences from your own Google Workspace mailboxes, with per-mailbox limits, merge fields, bounce and unsubscribe handling built in.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "Cold email sequences from your own Google Workspace",
  ogTitle: "Cold email sequences from your own mailboxes",
  eyebrow: "Email",
  description: DESCRIPTION,
});

const FAQ = [
  {
    q: "Which email providers can AgentSDR send from?",
    a: "Google Workspace mailboxes, connected once through a service account with domain-wide delegation. Each mailbox is added by address and gets its own daily limit, sending hours and signature. Other providers are not supported yet.",
  },
  {
    q: "How many cold emails does it send per mailbox a day?",
    a: "30 by default, with a random 18 to 24 minute gap between emails from the same mailbox, only inside that mailbox's sending hours. All three are Sending rules you can change for your organization, and a single mailbox can override its own daily limit.",
  },
  {
    q: "Do follow-ups stay in the same thread?",
    a: "Yes, if you leave a follow-up's subject blank: it is sent as a reply with Re: added to the earlier subject. A lead stays with the mailbox that sent its first email, so every follow-up comes from the same address.",
  },
  {
    q: "What happens when a lead replies?",
    a: "Their remaining emails are cancelled, they are marked Replied, and the reply lands in Action required with an AI classification and a drafted answer. A reply on LinkedIn or WhatsApp stops their email follow-ups too.",
  },
  {
    q: "How are bounces and unsubscribes handled?",
    a: "AgentSDR reads delivery failure reports in your mailbox, marks the lead Bounced and suppresses the address. Every email carries an unsubscribe link and a one-click List-Unsubscribe header. Suppressed addresses are never mailed again from any campaign in your organization.",
  },
  {
    q: "Can I personalise emails with my own CSV columns?",
    a: "Yes. Any column in an uploaded CSV or XLSX becomes a merge field, so a Job Title column is available as {{jobTitle}}. {A|B|C} spin text picks one option per email so no two leads get identical copy. Empty fields resolve to nothing, so preview a few leads before launch.",
  },
];

export default function EmailPage() {
  return (
    <>
      <JsonLd data={softwareLd(DESCRIPTION, PATH)} />
      <PageHero
        path={PATH}
        crumb="Email sequences"
        eyebrow="Email sequences"
        eyebrowIcon={RiMailFill}
        title="Cold email sequences from your own mailboxes"
        lede="Multi-step sequences sent slowly, inside working hours, from the Google Workspace mailboxes you already own. Replies, bounces and unsubscribes stop a lead on their own, and every answer lands in one AI inbox."
      >
        <HeroFrame>
          <ProductShot screen="campaigns" />
        </HeroFrame>
      </PageHero>

      <Section id="how-it-sends" eyebrow="How it sends" title="Built to land in the inbox, not to blast" lede="Every rule a careful SDR follows by hand is the default: small daily volumes, random gaps, one mailbox per lead, and a clean list.">
        <FeatureSplit
          eyebrow="Personalisation"
          accent={ACCENT.email}
          title="Every column becomes a merge field"
          body="Upload a CSV or XLSX and each column is ready to use, camelCased from its header. Add {A|B|C} spin text and the same step reads differently for every lead."
          bullets={["{{firstName}}, {{company}} and any custom column", "Spin text so no two emails are identical", "Preview a step rendered for a real lead and mailbox"]}
          visual={<SceneStage channel="email" index={0} accent={ACCENT.email} label="Merge fields filling in from a lead's CSV row. An illustration with sample data." />}
        />
        <FeatureSplit
          reverse
          eyebrow="Per-mailbox limits"
          accent={ACCENT.email}
          title="Slow and steady, per mailbox"
          body="Each mailbox has its own daily cap, sending window and signature. AgentSDR sends one email at a time with a random gap, so your volume looks like a person writing, not a script."
          bullets={["30 emails a day per mailbox by default", "A random 18–24 minute gap between sends", "Only inside each mailbox's sending hours"]}
          visual={<SceneStage channel="email" index={1} accent={ACCENT.email} label="Mailboxes filling up to their daily limit. An illustration with sample data." />}
        />
        <FeatureSplit
          eyebrow="Mailbox pool"
          accent={ACCENT.email}
          title="Scale by adding mailboxes, not risk"
          body="Every connected mailbox joins one shared pool. New leads are spread across it in turn, and a lead stays with the mailbox that first wrote to them, so follow-ups thread naturally."
          bullets={["Campaigns share mailboxes round-robin", "Follow-ups always come from the same address", "Due follow-ups are queued before new leads"]}
          visual={<SceneStage channel="email" index={2} accent={ACCENT.email} label="Leads from two campaigns assigned across three mailboxes. An illustration with sample data." />}
        />
        <FeatureSplit
          reverse
          eyebrow="Clean lists"
          accent={ACCENT.email}
          title="Bounces and opt-outs handle themselves"
          body="Delivery failures are read straight from your mailbox and suppressed. One-click unsubscribe works in Gmail and Outlook. Do Not Contact is checked again right before every send."
          bullets={["Hard bounces suppressed; soft delays are not", "List-Unsubscribe header on every email", "A suppressed address is never mailed again"]}
          visual={<SceneStage channel="email" index={3} accent={ACCENT.email} label="Bounced and unsubscribed leads leaving the sequence. An illustration with sample data." />}
        />
      </Section>

      <Section tone="grey">
        <StatBand
          items={[
            { value: 30, label: "emails a day per mailbox, by default" },
            { value: 18, suffix: "–24 min", label: "random gap between sends from one mailbox" },
            { value: 1, label: "send per step per lead — a step never goes twice" },
            { value: 0, prefix: "$", label: "per seat, per contact or per mailbox" },
          ]}
        />
      </Section>

      <Section id="details" eyebrow="The details" title="Everything a sequence needs" lede="The small things that decide whether a campaign gets replies or gets flagged.">
        <FeatureGrid
          items={[
            { icon: RiReplyLine, title: "Same-thread follow-ups", body: "Leave the subject blank and the step goes out as a reply in the original thread." },
            { icon: RiShuffleLine, title: "Spin text", body: "{A|B|C} picks one option per email, so copy varies from lead to lead." },
            { icon: RiBracesLine, title: "Custom merge fields", body: "Any imported column, matched case-insensitively. Empty values resolve to nothing." },
            { icon: RiSignalWifiErrorLine, title: "Bounce detection", body: "Delivery failure reports are parsed and the address is suppressed automatically." },
            { icon: RiForbidLine, title: "Do Not Contact everywhere", body: "One flag stops email, LinkedIn and WhatsApp, re-checked before each send." },
            { icon: RiChatForwardLine, title: "Cross-channel reply stop", body: "A reply on any channel ends the lead's email sequence immediately." },
            { icon: RiMailUnreadLine, title: "Reply detection", body: "Gmail push notifications bring replies in within seconds, not on a poll." },
            { icon: RiEyeLine, title: "Preview before launch", body: "See each step rendered for a real lead, from a real mailbox, with its signature." },
            { icon: RiMailFill, title: "Per-mailbox signatures", body: "%signature% inserts the sending mailbox's own signature, or it is appended." },
          ]}
        />
      </Section>

      <Section tone="grey" id="get-started" eyebrow="Get started" title="From mailbox to first reply">
        <Steps
          items={[
            { title: "Connect Google Workspace", body: "One service account with domain-wide delegation, then add mailboxes by address." },
            { title: "Add your leads", body: "Pick people from your lead database or upload a CSV or XLSX and map its columns." },
            { title: "Write the sequence", body: "An initial email and timed follow-ups, with merge fields, spin text and previews." },
            { title: "Launch and answer", body: "Replies arrive classified in Action required, with an AI draft ready to send." },
          ]}
        />
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/product/linkedin", "/product/ai-crm", "/product/lead-database", "/guides/cold-email-google-workspace", "/compare/instantly", "/compare/lemlist"]} />

      <ClosingCta title="Send from mailboxes you own" lede="Clone the repo, connect Google Workspace and launch your first sequence today. No seats, no per-contact pricing, no one else holding your list." />
    </>
  );
}
