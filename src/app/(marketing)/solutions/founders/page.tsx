import { RiCheckLine, RiCloseLine, RiContactsBook3Line, RiForbidLine, RiInbox2Line, RiLinkedinBoxFill, RiMailFill, RiRocket2Line, RiWhatsappFill } from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureGrid, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section, Steps } from "@/components/marketing/blocks";
import { ACCENT } from "@/components/marketing/catalog";
import { ProductShot, SceneStage, StatBand } from "@/components/marketing/live";
import { FounderDay } from "@/components/marketing/pages/solutions/FounderDay";
import { marketingMetadata } from "@/lib/marketing/seo";

const PATH = "/solutions/founders";

export const metadata = marketingMetadata({
  path: PATH,
  title: "AI SDR for founders: founder-led outbound",
  ogTitle: "An AI SDR for founder-led outbound",
  eyebrow: "Founders",
  description: "Run founder-led outbound alone: email, LinkedIn and WhatsApp in one workspace, AI triage for every reply, and free open-source software you host yourself.",
});

const FAQ = [
  {
    q: "Can one person really run outbound with AgentSDR?",
    a: "That is the case it is built for. Sequences send on their own inside sending hours, replies from every channel land in one Action required queue, and the AI classifies each one and drafts an answer. Your job is to review drafts and send them, not to chase tabs.",
  },
  {
    q: "What does an AI SDR for founders cost?",
    a: "The software is free: it is open source under the AGPL-3.0 and you host it yourself, so there are no seats, tiers or per-contact fees. You pay for your own server, the accounts you connect (Google Workspace mailboxes, Unipile for LinkedIn and WhatsApp) and your own AI usage on OpenRouter. A Resend account is needed to email sign-in and invitation messages in production.",
  },
  {
    q: "Will the AI send messages without my approval?",
    a: "No. The AI classifies replies and drafts answers, but nothing is sent until a person approves it. It applies a classification on its own only when it is confident (85% by default), and holds anything else as a proposal for you to accept or change.",
  },
  {
    q: "Do I need a team or a developer to set it up?",
    a: "You need to run one app and one PostgreSQL database, which the repository's Docker Compose file starts for you. After that, every service is connected from the Settings pages with guided setup: Google Workspace, Unipile, OpenRouter and Cloudflare R2. See the open-source page for the exact steps.",
  },
  {
    q: "Is it safe to run LinkedIn and email from my own accounts?",
    a: "No tool can promise an account is never restricted, but the defaults are conservative: 30 emails a day per mailbox with an 18 to 24 minute gap, 30 LinkedIn invitations a day on Premium accounts and 5 on free ones, and sending only inside working hours. All of it is adjustable in Sending rules, with a warning when you pass the safe edge.",
  },
  {
    q: "What happens when a lead replies on a different channel?",
    a: "A person is one record across channels. A reply on email, LinkedIn or WhatsApp marks their campaign enrollments as replied, so you stop writing to someone who has answered, and the reply reaches Action required.",
  },
];

const BEFORE = ["A sequencer for email, a separate tool for LinkedIn, another for WhatsApp", "Replies in three inboxes, found when you remember to look", "A spreadsheet that is the only record of who was contacted where", "A per-seat bill for a team of one, plus per-contact limits"];
const AFTER = ["One workspace for email, LinkedIn and WhatsApp campaigns", "One Action required queue, every reply classified with a draft attached", "One lead record per person, whichever channel they answer on", "Free software; you pay your server, your accounts and your AI usage"];

const PAY = [
  { item: "Your server and PostgreSQL", note: "One app process and one database; Docker Compose starts both." },
  { item: "Google Workspace mailboxes", note: "The mailboxes you already own, for cold email." },
  { item: "Unipile", note: "The LinkedIn and WhatsApp accounts you link." },
  { item: "OpenRouter usage", note: "Your own key, for every AI step. Billed to you, by the model provider." },
  { item: "Resend", note: "Sign-in, password-reset and invitation emails (required in production)." },
];

export default function FoundersPage() {
  return (
    <>
      <PageHero
        eyebrow="For founders"
        eyebrowIcon={RiRocket2Line}
        title="An AI SDR for founder-led outbound"
        lede="You are the SDR, the closer and the founder. AgentSDR runs email, LinkedIn and WhatsApp from one workspace, and the AI reads every reply so the queue you work each day is short and already drafted."
      >
        <HeroFrame>
          <ProductShot screen="actions" />
        </HeroFrame>
      </PageHero>

      <Section id="problem" eyebrow="The problem" title="Founder-led outbound breaks in the gaps" lede="Doing it yourself is the right call early. What hurts is the glue: tools that do not talk to each other and replies nobody sees in time.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-[#f7f7f8] p-6 ring-1 ring-black/[0.05] sm:p-8">
            <p className="font-[family-name:var(--font-landing-mono)] text-[12px] font-medium uppercase tracking-[0.06em] text-[#8a8a8a]">The patchwork</p>
            <ul className="mt-5 grid gap-4">
              {BEFORE.map((b) => (
                <li key={b} className="flex gap-3 text-[15px] leading-6 text-[#5c5c5c]">
                  <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-black/[0.07] text-[#6b6b6b]">
                    <RiCloseLine className="size-3.5" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-white p-6 ring-1 ring-[#335cff]/25 shadow-[0_20px_50px_-30px_rgb(51_92_255/0.45)] sm:p-8">
            <p className="font-[family-name:var(--font-landing-mono)] text-[12px] font-medium uppercase tracking-[0.06em] text-[#335cff]">One workspace</p>
            <ul className="mt-5 grid gap-4">
              {AFTER.map((a) => (
                <li key={a} className="flex gap-3 text-[15px] leading-6 text-[#2b2b2b]">
                  <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#335cff] text-white">
                    <RiCheckLine className="size-3.5" />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section id="day" tone="grey" eyebrow="A day in the workflow" title="Sequences run. You answer the replies." lede="This is what a day looks like once campaigns are live: a few hours of waiting, then a short queue with drafts already written.">
        <FounderDay />
      </Section>

      <Section id="workflow" eyebrow="The workflow" title="Triage that keeps replies from piling up" lede="The part of outbound that eats a founder’s week is not sending. It is reading, sorting and answering.">
        <FeatureSplit
          eyebrow="AI triage"
          accent={ACCENT.ai}
          title="Every reply classified, every answer drafted"
          body="The AI puts each reply in a category you control, records how sure it is and why, and writes a draft using your instructions and knowledge base. You see a ranked queue, not a pile of threads."
          bullets={["Interested, Customer, Not interested or Other, with subcategories", "Applied on its own only above 85% confidence by default", "Do Not Contact is honoured on every channel at once"]}
          visual={<SceneStage channel="crm" index={0} accent={ACCENT.ai} label="Replies being classified into categories. An illustration with sample data." />}
        />
        <FeatureSplit
          reverse
          eyebrow="Fast to clear"
          accent={ACCENT.ai}
          title="Clear the queue in one sitting"
          body="Open a row, read the lead’s message beside the draft, and approve it as written or edit it first. The reply goes out from the account the conversation is on."
          bullets={["Approve & send, or edit and send", "Switch channel and the reply is drafted separately", "Nothing is sent without a person approving it"]}
          visual={<SceneStage channel="crm" index={3} accent={ACCENT.ai} label="Working through replies from the keyboard. An illustration with sample data." />}
        />
      </Section>

      <Section tone="grey" id="channels" eyebrow="One workspace" title="Three channels, one lead record" lede="You do not run three outbound programmes. You run one, and pick the channel per step.">
        <FeatureGrid
          items={[
            { icon: RiMailFill, title: "Email from your own mailboxes", body: "Multi-step sequences from Google Workspace, 30 a day per mailbox by default, inside sending hours." },
            { icon: RiLinkedinBoxFill, title: "LinkedIn invites and follow-ups", body: "Paced runs with random gaps, per-account daily limits and working hours." },
            { icon: RiWhatsappFill, title: "WhatsApp messages and calls", body: "Message campaigns with a warm-up period, and recorded calls placed from your own number." },
            { icon: RiContactsBook3Line, title: "A lead database for all of it", body: "Import a CSV or enrich in a table. A person is one record whichever channel they answer on." },
            { icon: RiInbox2Line, title: "One inbox for replies", body: "Email, LinkedIn and WhatsApp conversations in a single list, with drafts ready." },
            { icon: RiForbidLine, title: "Stops when they answer", body: "A reply on any channel ends that lead’s other sequences, so nobody gets a follow-up after replying." },
          ]}
        />
      </Section>

      <Section id="cost" eyebrow="What it costs" title="Free software. You pay for what you connect." lede="AgentSDR is open source under the AGPL-3.0. There are no seats, tiers or per-contact fees, so a team of one pays the same as a team of ten: nothing for the software.">
        <StatBand
          items={[
            { value: 0, prefix: "$", label: "per seat, per contact or per mailbox" },
            { value: 3, label: "channels in one workspace: email, LinkedIn, WhatsApp" },
            { value: 1, label: "Action required queue for every reply" },
            { value: 4, label: "Docker Compose services: db, setup, app, cron" },
          ]}
        />
        <div className="mt-10 overflow-hidden rounded-3xl ring-1 ring-black/[0.07]">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">What you pay for when you self-host AgentSDR</caption>
            <thead className="bg-[#f7f7f8] text-[12px] uppercase tracking-[0.06em] text-[#8a8a8a]">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium sm:px-8">You pay for</th>
                <th scope="col" className="px-5 py-3 font-medium sm:px-8">What it is</th>
              </tr>
            </thead>
            <tbody>
              {PAY.map((row) => (
                <tr key={row.item} className="border-t border-black/[0.06]">
                  <th scope="row" className="px-5 py-4 text-[15px] font-medium text-[#141414] sm:px-8">{row.item}</th>
                  <td className="px-5 py-4 leading-[22px] text-[#656565] sm:px-8">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section tone="grey" id="get-started" eyebrow="Your first week" title="From clone to first reply">
        <Steps
          items={[
            { title: "Run it", body: "Start the app and PostgreSQL with Docker Compose, sign up and create your organization." },
            { title: "Connect your accounts", body: "Google Workspace, Unipile and your OpenRouter key, each from its own guided Settings page." },
            { title: "Add leads, write sequences", body: "Import a CSV or build a table, then write an email, LinkedIn or WhatsApp sequence with merge fields." },
            { title: "Work Action required", body: "Replies arrive classified with a draft. Approve, edit or change the category, and the lead moves on." },
          ]}
        />
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/product/ai-crm", "/product/email", "/product/linkedin", "/product/whatsapp", "/open-source", "/compare/lemlist"]} />

      <ClosingCta title="Be the whole SDR team, without the glue" lede="Self-host it, connect your accounts and let the AI keep your reply queue short. Free software, your data, your keys." />
    </>
  );
}
