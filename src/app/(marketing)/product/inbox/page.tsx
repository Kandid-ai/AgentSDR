import { RiInbox2Fill, RiKeyboardBoxLine, RiLinkedinBoxFill, RiMailFill, RiMailCheckLine, RiSparkling2Line, RiWhatsappFill } from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section } from "@/components/marketing/blocks";
import { Reveal } from "@/components/landing/Reveal";
import { ACCENT } from "@/components/marketing/catalog";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ProductShot, SceneStage } from "@/components/marketing/live";
import { KeyboardDeck, QueueMerge } from "@/components/marketing/pages/crm";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";

const PATH = "/product/inbox";
const DESCRIPTION =
  "A unified sales inbox for email, LinkedIn and WhatsApp replies in one queue, each with an AI draft ready. Keyboard-first, and nothing sends until you approve.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "Unified sales inbox for email, LinkedIn, WhatsApp",
  ogTitle: "A unified sales inbox",
  eyebrow: "Inbox",
  description: DESCRIPTION,
});

const FAQ = [
  {
    q: "What is a unified sales inbox?",
    a: "One queue for the replies to your outreach, whichever channel they arrive on. In AgentSDR that queue is Action required: email, LinkedIn and WhatsApp replies, each classified and with an AI draft ready to review.",
  },
  {
    q: "Which channels does the inbox cover?",
    a: "Email from your connected Google Workspace mailboxes, LinkedIn conversations from accounts connected through Unipile, and WhatsApp chats on numbers linked through Unipile. A lead who replies on two channels still has one record.",
  },
  {
    q: "Does the AI send drafts automatically?",
    a: "No. A draft stays a draft until a person clicks Approve & send, or Save & send after editing it. A newer reply from the lead marks an unsent draft Out of date, so a stale answer is not sent by mistake.",
  },
  {
    q: "Are there keyboard shortcuts?",
    a: "Yes. J and K move down and up the conversation list, Enter opens the focused conversation, Escape returns to the list, Command or Ctrl plus K opens the command palette, and Command or Ctrl plus Enter sends from the email composer.",
  },
  {
    q: "What happens to my other sequences when a lead replies?",
    a: "They stop. A reply on any channel cancels the lead's pending email, LinkedIn and WhatsApp campaign steps, marks them Replied and makes any draft waiting for them out of date, because the conversation has changed.",
  },
  {
    q: "Do messages from people I never contacted show up in the CRM?",
    a: "They are stored in the channel's inbox so you can read them, but they create no CRM record and no work in Action required. Only people you enrolled in outreach create CRM work.",
  },
];

const CHANNELS = [
  {
    icon: RiMailFill,
    color: ACCENT.email,
    name: "Email",
    title: "Master Inbox",
    points: ["Folders for Inbox, Replies and To approve, plus Important, Out of office, Sent and Scheduled", "Search and filter by lead, campaign, mailbox, status and time", "Delivery failure reports are suppressed, not shown as replies"],
  },
  {
    icon: RiLinkedinBoxFill,
    color: ACCENT.linkedin,
    name: "LinkedIn",
    title: "Messages",
    points: ["Replied, Needs reply and All, with who is waiting on you first", "Filter by campaign, sender, last activity and CRM category", "The AI draft sits above the reply box, marked on the list"],
  },
  {
    icon: RiWhatsappFill,
    color: ACCENT.whatsapp,
    name: "WhatsApp",
    title: "Messages",
    points: ["Chats on every linked number, each message tagged lead, AgentSDR or phone", "What you type on your phone counts as answering the lead", "Replies from leads known by phone land on their CRM record"],
  },
];

export default function InboxPage() {
  return (
    <>
      <JsonLd data={softwareLd(DESCRIPTION, PATH)} />
      <PageHero
        eyebrow="Unified inbox"
        eyebrowIcon={RiInbox2Fill}
        title="A unified sales inbox for email, LinkedIn and WhatsApp"
        lede="Replies from every channel land in one queue, already classified, with an AI draft ready. Work it from the keyboard, send what you approve and nothing else."
      >
        <HeroFrame>
          <div className="mx-auto max-w-[760px]">
            <QueueMerge />
          </div>
        </HeroFrame>
      </PageHero>

      <Section id="queue" eyebrow="Action required" title="One queue instead of three tabs" lede="Stop checking Gmail, LinkedIn and WhatsApp in turn. Anything that needs a person is in Action required, with a count in the sidebar.">
        <Reveal>
          <ProductShot screen="actions" height="h-[480px] sm:h-[600px]" />
        </Reveal>
        <ul className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-3">
          {[
            { t: "What a row says", b: "Each row names what it needs: an immediate reply, a follow-up due, a classification to confirm, a next step or an error." },
            { t: "Filter by what matters", b: "Action type, category, channel and due time (Overdue, Due today, Upcoming), plus subcategory, sequence and errors only." },
            { t: "Draft inline", b: "Open a row's draft in place, see the message it answers and send as written, edit, regenerate with a note or discard." },
          ].map((x) => (
            <li key={x.t}>
              <p className="text-[16px] font-medium text-[#141414]">{x.t}</p>
              <p className="mt-1.5 text-[14px] leading-[22px] text-[#656565]">{x.b}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="grey" id="keyboard" eyebrow="Keyboard-first" title="Clear the queue without touching the mouse" lede="Triage is a few keys: move, open, read the draft, send. Moving focus never opens a conversation, so nothing is marked read by accident.">
        <FeatureSplit
          eyebrow="Triage"
          accent={ACCENT.ai}
          title="J, K, Enter, then the command palette"
          body="Walk the list with J and K, open a thread with Enter and jump anywhere with Command or Ctrl plus K. The same keys work in the Master Inbox, so muscle memory carries across channels."
          bullets={["J and K from anywhere outside a text field", "Enter opens the thread, Escape returns to the list", "Command or Ctrl plus K for pages and actions"]}
          visual={<SceneStage channel="crm" index={3} accent={ACCENT.ai} label="Moving through replies with J and K, opening one and the command palette. An illustration with sample data." />}
        />
        <div className="mt-10 sm:mt-14">
          <KeyboardDeck />
        </div>
      </Section>

      <Section id="drafts" eyebrow="You stay in control" title="A draft is a proposal, never a send" lede="The AI reads, classifies and writes. A person sends. There is no auto-reply mode to turn on by accident.">
        <FeatureSplit
          eyebrow="Review"
          accent={ACCENT.ai}
          title="Approve, edit, regenerate or discard"
          body="The lead's message is quoted next to the draft. Pick the account it goes out through, change a word and send, or tell the AI what should change and regenerate. A badge says Ready to send, Out of date or Draft failed."
          bullets={["Approve & send sends the draft exactly as written", "Knowledge used shows the excerpts behind a claim", "Do Not Contact blocks sending until a person clears it"]}
          visual={<SceneStage channel="crm" index={1} accent={ACCENT.ai} label="A draft reply grounded in the knowledge base, waiting for approval. An illustration with sample data." />}
        />
        <FeatureSplit
          reverse
          eyebrow="Cross-channel"
          accent={ACCENT.ai}
          title="A reply on one channel quiets the others"
          body="When a lead answers on LinkedIn, their pending email follow-ups and WhatsApp steps are cancelled, and they are marked Replied. You never email someone who just wrote to you on another channel."
          bullets={["Pending steps on every channel are cancelled", "Drafts made before the reply are marked Out of date", "The new reply is classified from scratch"]}
          visual={
            <div className="rounded-3xl bg-[#f7f7f8] p-6 ring-1 ring-black/[0.05]">
              <p className="flex items-center gap-2 text-[13px] font-medium text-[#141414]">
                <RiMailCheckLine className="size-4 text-[#7d52f4]" aria-hidden="true" />
                What a reply sets in motion
              </p>
              <ol className="mt-4 grid gap-3 text-[14px] text-[#525866]">
                {["The reply is stored on the lead's one CRM record", "The AI classifies it and writes a draft", "Email, LinkedIn and WhatsApp campaign steps stop", "It appears in Action required for you"].map((x, i) => (
                  <li key={x} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-black/[0.04]">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#7d52f4]/12 text-[12px] font-medium text-[#5b36c9]">{i + 1}</span>
                    {x}
                  </li>
                ))}
              </ol>
            </div>
          }
        />
      </Section>

      <Section tone="grey" id="channels" eyebrow="Per-channel inboxes" title="And each channel keeps its own inbox" lede="The queue is for deciding. When you want the whole thread, or mail from people outside your campaigns, each channel has its own view.">
        <Reveal>
          <ul className="grid gap-4 lg:grid-cols-3">
            {CHANNELS.map((c) => {
              const Icon = c.icon;
              return (
                <li key={c.name} className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.06]">
                  <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${c.color} 12%, white)`, color: c.color }}>
                    <Icon className="size-5" />
                  </span>
                  <p className="mt-4 text-[18px] font-medium text-[#141414]">
                    {c.name} <span className="text-[#8a8a8a]">· {c.title}</span>
                  </p>
                  <ul className="mt-3 grid gap-2.5">
                    {c.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-[14px] leading-[22px] text-[#656565]">
                        <RiSparkling2Line className="mt-1 size-3.5 shrink-0" style={{ color: c.color }} aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Reveal>
        <div className="mt-12">
          <ProductShot screen="inbox" height="h-[460px] sm:h-[560px]" />
        </div>
      </Section>

      <Section id="fit" eyebrow="Why it works" title="Built for people who answer replies all day">
        <ul className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: RiInbox2Fill, t: "One record per lead", b: "Replies on three channels, one timeline, one classification." },
            { icon: RiSparkling2Line, t: "Drafts ready on arrival", b: "Classification and a grounded draft are done before you open the row." },
            { icon: RiKeyboardBoxLine, t: "Fast to clear", b: "Move, open, approve and send without leaving the keyboard." },
          ].map(({ icon: Icon, t, b }) => (
            <li key={t} className="rounded-3xl bg-[#f7f7f8] p-6 ring-1 ring-black/[0.04]">
              <Icon className="size-5 text-[#7d52f4]" aria-hidden="true" />
              <p className="mt-4 text-[16px] font-medium text-[#141414]">{t}</p>
              <p className="mt-1.5 text-[14px] leading-[22px] text-[#656565]">{b}</p>
            </li>
          ))}
        </ul>
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/product/ai-crm", "/product/email", "/product/linkedin", "/product/whatsapp", "/solutions/sales-teams", "/compare/lemlist"]} />

      <ClosingCta title="Every reply, one queue, your call" lede="Connect your channels, bring your own AI key and answer replies from one place. Open source, self-hosted, no seats." />
    </>
  );
}
