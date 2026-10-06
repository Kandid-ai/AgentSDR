import Link from "next/link";
import { RiArrowRightLine, RiGroupLine, RiLinkedinBoxFill, RiMailSendLine, RiScalesLine, RiTableLine } from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureGrid, HeroFrame, PageHero, RelatedPages, Section } from "@/components/marketing/blocks";
import { JsonLd } from "@/components/marketing/JsonLd";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";
import { ComparisonTable } from "@/components/marketing/pages/compare/ComparisonTable";
import { COMPETITORS, DISCLAIMER_MONTH, MATRIX, MATRIX_COLUMNS } from "@/components/marketing/pages/compare/data";
import { StackCollapse } from "@/components/marketing/pages/compare/StackCollapse";
import { cn } from "@/utils/cn";

const PATH = "/compare";
const DESCRIPTION =
  "Compare AgentSDR, the open-source AI SDR, with Clay, lemlist, HeyReach, Instantly and Apollo: what it replaces, what it does not, and where each tool is the better choice.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "AgentSDR vs Clay, lemlist, HeyReach, Instantly, Apollo",
  ogTitle: "Open-source alternatives to your outbound stack",
  eyebrow: "Compare",
  description: DESCRIPTION,
});

const FAQ = [
  { q: "What is the best open-source alternative to Clay, lemlist, Instantly or Apollo?", a: "AgentSDR is an open-source (AGPL-3.0), self-hosted AI SDR with enrichment tables, email, LinkedIn and WhatsApp campaigns, a shared inbox and an AI CRM. It replaces the workflow of those tools. It does not include a contact database, so you bring lists or connect data providers with your own keys." },
  { q: "Does AgentSDR replace Apollo or Clay for data?", a: "No. AgentSDR has no built-in contact database or data marketplace. It connects 15 enrichment providers, including Apollo, with your own accounts, so you can keep paying a data vendor and drop the rest of the stack." },
  { q: "Where are the other tools better than AgentSDR?", a: "Built-in contact data (lemlist, Instantly and Apollo), hosted convenience and support, email warm-up and inbox placement tools (lemlist, Instantly), waterfall enrichment and CRM syncing (Clay), and white-label agency plans (HeyReach). Each comparison page lists them." },
  { q: "Is AgentSDR cheaper?", a: "AgentSDR charges no seat, sender or contact fees. You still pay for your server and for every service you connect, such as Google Workspace, Unipile, your AI model and any data provider, so total cost depends on your setup." },
  { q: "How are these comparisons sourced?", a: `Statements about other tools come only from their own websites and documentation, checked in ${DISCLAIMER_MONTH}. We state no competitor prices. Where we could not confirm something, the tables say "Not compared".` },
  { q: "What does AgentSDR not do yet?", a: "It sends email only from Google Workspace mailboxes, has no waterfall enrichment, no email warm-up, no HubSpot or Salesforce sync, and each campaign covers one channel rather than mixing email and LinkedIn steps." },
];

const REPLACES = [
  { icon: RiTableLine, title: "Enrichment and list building", body: "Tables with enrichment, AI, HTTP and formula columns, fed by 15 providers you connect with your own keys." },
  { icon: RiMailSendLine, title: "Email sequencing", body: "Multi-step sequences from your Google Workspace mailboxes, with per-mailbox limits, bounce handling and unsubscribes." },
  { icon: RiLinkedinBoxFill, title: "LinkedIn and WhatsApp outreach", body: "Invitations, follow-ups, message campaigns and recorded calls through Unipile, paced to limits you set." },
  { icon: RiGroupLine, title: "The inbox and CRM", body: "Replies from every channel classified, drafted and tracked in one pipeline, with one record per person." },
];

export default function ComparePage() {
  return (
    <>
      <JsonLd data={softwareLd(DESCRIPTION, PATH)} />
      <PageHero
        path={PATH}
        crumb="All comparisons"
        eyebrow="Compare"
        eyebrowIcon={RiScalesLine}
        title="Open-source alternatives to your outbound stack"
        lede="Most outbound setups stitch a data tool, a sequencer, a LinkedIn tool and a CRM together. AgentSDR is one self-hosted app for the workflow. Here is what it replaces, what it does not, and where each tool is the better pick."
      >
        <HeroFrame>
          <StackCollapse
            tools={[
              { label: "Enrichment tool", note: "tables, AI columns" },
              { label: "Email sequencer", note: "mailboxes, limits" },
              { label: "LinkedIn tool", note: "invites, follow-ups" },
              { label: "WhatsApp messaging", note: "campaigns, calls" },
              { label: "Shared inbox and CRM", note: "replies, pipeline" },
            ]}
            result="AgentSDR"
            resultNote="One lead record per person. Self-hosted, AGPL-3.0, with no seat or contact fees from us."
          />
        </HeroFrame>
      </PageHero>

      <Section id="replaces" eyebrow="What it replaces" title="The workflow, not the database" lede="AgentSDR takes over the steps between having a list and closing a reply. Contact data stays with whichever provider you trust.">
        <FeatureGrid columns={2} items={REPLACES} />
      </Section>

      <Section id="comparisons" tone="grey" eyebrow="Pick a comparison" title="Five tools, five different angles">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMPETITORS.map((c) => (
            <li key={c.slug}>
              <Link href={`/compare/${c.slug}`} className="group flex h-full flex-col rounded-3xl bg-white p-6 ring-1 ring-black/[0.07] transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgb(10_20_60/0.35)] focus-visible:outline-2 focus-visible:outline-[#335cff] sm:p-7">
                <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-[#335cff]">{c.eyebrow}</span>
                <span className="mt-3 text-[20px] font-medium leading-[1.25] tracking-[-0.01em] text-[#141414]">{c.h1}</span>
                <span className="mt-3 text-[14px] leading-[22px] text-[#656565]">
                  {c.name} is {c.whatItIs.charAt(0).toLowerCase()}
                  {c.whatItIs.slice(1)}
                </span>
                <span className="mt-auto flex items-center gap-1.5 pt-5 text-[14px] font-medium text-[#141414]">
                  Compare with {c.name}
                  <RiArrowRightLine className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="matrix" eyebrow="At a glance" title="Every tool, side by side" lede="Marks come with words, so you can read the table without relying on colour. Scroll sideways on a small screen.">
        <ComparisonTable
          compact
          caption="AgentSDR compared with Clay, lemlist, HeyReach, Instantly and Apollo"
          columns={MATRIX_COLUMNS.map((name, i) => ({ name, highlight: i === 0 }))}
          rows={MATRIX.map((r) => ({ feature: r.feature, cells: r.cells }))}
        />
        <p className={cn("mt-4 max-w-[52rem] text-[13px] leading-5 text-[#6b6b6b]")}>
          &ldquo;Not compared&rdquo; means we could not confirm it from that company&rsquo;s own site, so we claim nothing either way. Clay, lemlist, HeyReach, Instantly and Apollo are trademarks of their owners. Comparison based on publicly available information as of {DISCLAIMER_MONTH}.
        </p>
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/open-source", "/product/tables", "/product/ai-crm", "/solutions/founders", "/solutions/agencies", "/guides"]} />

      <ClosingCta title="Run your outbound on your own server" lede="Clone the repo, connect your accounts and compare for yourself. No seats, no per-contact pricing, and your data stays in your database." />
    </>
  );
}
