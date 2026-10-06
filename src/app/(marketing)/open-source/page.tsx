import type { ReactNode } from "react";
import { RiBug2Line, RiCodeSSlashLine, RiGitPullRequestLine, RiKey2Line, RiLockPasswordLine, RiScales3Line, RiServerLine, RiShieldCheckLine, RiGitBranchLine } from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureGrid, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section } from "@/components/marketing/blocks";
import { ACCENT } from "@/components/marketing/catalog";
import { JsonLd } from "@/components/marketing/JsonLd";
import { StatBand } from "@/components/marketing/live";
import { DataMap } from "@/components/marketing/pages/solutions/DataMap";
import { RepoTree } from "@/components/marketing/pages/solutions/RepoTree";
import { GetRunning, HeroTerminal } from "@/components/marketing/pages/solutions/Terminal";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";

const PATH = "/open-source";
const DESCRIPTION = "AgentSDR is an open-source AI SDR and self-hosted sales automation platform: AGPL-3.0, Docker and Postgres, your own AI key, and your data on your server.";
const REPO = "https://github.com/Kandid-ai/AgentSDR";
const blob = (file: string) => `${REPO}/blob/main/${file}`;

export const metadata = marketingMetadata({
  path: PATH,
  title: "Open-source AI SDR you can self-host",
  ogTitle: "An open-source AI SDR you host yourself",
  eyebrow: "Open source",
  description: DESCRIPTION,
});

const FAQ = [
  {
    q: "What license is AgentSDR under?",
    a: "The GNU Affero General Public License v3.0 (AGPL-3.0-only). You may use, copy, modify, self-host and distribute it, including commercially and as a hosted service. If you modify it and let others use your version over a network, you must make your modified source available to those users under the same license. The LICENSE file in the repository is the binding text.",
  },
  {
    q: "What do I need to self-host AgentSDR?",
    a: "PostgreSQL 16 or newer and either Docker with Compose or Bun 1.2+ (Node.js 20.9+ also works) to run from source. The repository's docker-compose.yml starts PostgreSQL 18, a one-shot schema setup, the app and a cron sidecar. You also want a public HTTPS origin for webhooks and a Resend account for sign-in and invitation email in production.",
  },
  {
    q: "Where is my data stored?",
    a: "In your PostgreSQL database, which holds leads, conversations, settings and your encrypted integration credentials, and in your own Cloudflare R2 bucket for call recordings. AgentSDR has no shared cloud behind it, and every service you connect uses your own accounts.",
  },
  {
    q: "How does the AI work without a shared key?",
    a: "Every AI feature runs through OpenRouter on your organization's own keys. You choose the providers and models allowed, and AgentSDR pins each request to the model's provider with fallbacks off and refuses to send until you confirm shared capacity is off. If that provider fails, the request fails instead of moving elsewhere.",
  },
  {
    q: "How are my credentials protected?",
    a: "Credentials for Unipile, Google Workspace, Cloudflare R2, OpenRouter and enrichment providers are connected from Settings, not from environment variables, and stored encrypted with AES-256-GCM using INTEGRATION_CREDENTIALS_KEY. Keep a copy of that key outside the database: without it the stored credentials cannot be decrypted.",
  },
  {
    q: "Can I run more than one instance?",
    a: "Run the app as a single instance. The outreach sender loop has no distributed lock, so two instances would each send. The enrichment and CRM workers are safe to overlap, but the email scheduler is not.",
  },
  {
    q: "How do I upgrade and contribute?",
    a: "To upgrade, back up the database, pull the new version, run any new migration scripts listed in the release notes and rebuild. To contribute, read CONTRIBUTING.md: pull requests need a green CI check and one maintainer approval, and changes to architecture or the data model are discussed in an issue first.",
  },
];

const STACK = ["Next.js 16", "React 19", "TypeScript", "PostgreSQL", "Drizzle", "Better Auth", "Tailwind 4", "Bun", "Docker"];

const CONNECT = [
  { name: "Google Workspace", role: "Mailboxes for email sequences", where: "Settings, Email" },
  { name: "Unipile", role: "LinkedIn and WhatsApp accounts", where: "Settings, LinkedIn and WhatsApp" },
  { name: "OpenRouter", role: "Your model key, for every AI step", where: "Settings, AI provider" },
  { name: "Cloudflare R2", role: "Storage for call recordings", where: "Settings, WhatsApp" },
  { name: "Enrichment providers", role: "Apollo and others, connected per table", where: "Tables" },
];

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-[#335cff] underline decoration-[#335cff]/30 underline-offset-4 hover:decoration-[#335cff]">
      {children}
    </a>
  );
}

const Mono = ({ children }: { children: ReactNode }) => <code className="rounded-md bg-black/[0.05] px-1.5 py-0.5 font-[family-name:var(--font-landing-mono)] text-[0.88em] text-[#141414]">{children}</code>;

export default function OpenSourcePage() {
  return (
    <>
      <JsonLd data={softwareLd(DESCRIPTION, PATH)} />
      <PageHero
        path={PATH}
        crumb="Open source"
        eyebrow="Open source and self-hosted"
        eyebrowIcon={RiCodeSSlashLine}
        title="The open-source AI SDR you host yourself"
        lede="Self-hosted sales automation under the AGPL-3.0: one app, one PostgreSQL database, your own AI key. Email, LinkedIn and WhatsApp outreach with an AI CRM, and no one else holding your data."
        primary={{ href: REPO, label: "View the source", external: true }}
        secondary={{ href: blob("docs/self-hosting.md"), label: "Read the self-hosting guide", external: true }}
      >
        <HeroFrame>
          <div className="mx-auto max-w-[820px]">
            <HeroTerminal />
          </div>
        </HeroFrame>
      </PageHero>

      <Section id="license" eyebrow="The license" title="AGPL-3.0: use it, change it, host it" lede="The code is public and so are the terms. This is the short version from the README; the LICENSE file is the binding text.">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { icon: RiScales3Line, title: "You may", body: "Use, copy, modify, self-host and distribute AgentSDR, including for commercial purposes and as a hosted service." },
            { icon: RiGitBranchLine, title: "If you modify it", body: "And let others use your version over a network, such as a hosted service, you must make your modified source available to those users under the same license." },
            { icon: RiShieldCheckLine, title: "Always", body: "Keep the license and copyright notices. The container image carries the AGPL-3.0-only license label." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl bg-[#f7f7f8] p-6 ring-1 ring-black/[0.05] sm:p-8">
              <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl bg-[#335cff]/[0.07] text-[#335cff] ring-1 ring-inset ring-[#335cff]/[0.14]">
                <Icon className="size-5" />
              </span>
              <p className="mt-5 text-[16px] font-medium text-[#141414]">{title}</p>
              <p className="mt-1.5 text-[14px] leading-[22px] text-[#656565]">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[14px] leading-[22px] text-[#656565]">
          Read the <Ext href={blob("LICENSE")}>LICENSE</Ext>, how decisions are made in <Ext href={blob("GOVERNANCE.md")}>GOVERNANCE.md</Ext> and the <Ext href={blob("docs/responsible-use.md")}>responsible use guide</Ext> before you send anything.
        </p>
      </Section>

      <Section id="get-running" tone="grey" eyebrow="Get running" title="Two commands from a clone to a login screen" lede="Docker Compose is the shortest path. The same commands are in the repository's docs/self-hosting.md.">
        <FeatureSplit
          eyebrow="Self-hosting"
          accent={ACCENT.linkedin}
          title="One app, one database, no queue server"
          body={
            <>
              AgentSDR is one Next.js application backed by one PostgreSQL database. There is no Redis and no separate worker: background work runs inside the app process, and the Compose <Mono>cron</Mono> sidecar calls the scheduled endpoints.
            </>
          }
          bullets={["PostgreSQL 16 or newer; Compose starts 18 for you", "Docker with Compose, or Bun 1.2+ to run from source", "Run a single app instance: the email sender has no distributed lock", "Sign up first, then connect services inside the app"]}
          visual={<GetRunning />}
        />
      </Section>

      <Section id="your-data" eyebrow="Your data, your keys" title="Nothing leaves except through accounts you own" lede="Every service is connected per organization, with your own credentials. There are no shared API keys and no environment fallback.">
        <DataMap />
        <div className="mt-10">
          <FeatureGrid
            columns={4}
            items={[
              { icon: RiKey2Line, title: "Bring your own AI key", body: "OpenRouter, on your keys, for classification, drafts, AI columns and call transcripts." },
              { icon: RiServerLine, title: "Provider pinned", body: "Requests go to the one provider of the model you chose, fallbacks off. A failure fails; it never reroutes." },
              { icon: RiLockPasswordLine, title: "Encrypted at rest", body: "Saved credentials are encrypted with AES-256-GCM before they reach the database." },
              { icon: RiShieldCheckLine, title: "Per-organization isolation", body: "Every query is scoped to an organization, and isolation is tested end to end." },
            ]}
          />
        </div>
      </Section>

      <Section id="connect" tone="grey" eyebrow="What you connect" title="Five services, all from Settings" lede="Env keeps only what is needed before the database can be read: the database URL, auth secrets, the credentials key, public URLs and cron secrets.">
        <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.07]">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">Services you connect inside AgentSDR and where</caption>
            <thead className="bg-[#fafafa] text-[12px] uppercase tracking-[0.06em] text-[#8a8a8a]">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium sm:px-8">Service</th>
                <th scope="col" className="px-5 py-3 font-medium sm:px-8">What it powers</th>
                <th scope="col" className="hidden px-5 py-3 font-medium sm:table-cell sm:px-8">Where you connect it</th>
              </tr>
            </thead>
            <tbody>
              {CONNECT.map((c) => (
                <tr key={c.name} className="border-t border-black/[0.06]">
                  <th scope="row" className="px-5 py-4 text-[15px] font-medium text-[#141414] sm:px-8">{c.name}</th>
                  <td className="px-5 py-4 text-[#656565] sm:px-8">{c.role}</td>
                  <td className="hidden px-5 py-4 text-[#656565] sm:table-cell sm:px-8">{c.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="codebase" eyebrow="The codebase" title="A TypeScript codebase, laid out by area" lede="One repository holds the app, the sending engine, the schema, the docs and the Chrome extension. Everything is TypeScript.">
        <RepoTree />
        <ul className="mt-8 flex flex-wrap justify-center gap-2" aria-label="The stack">
          {STACK.map((s) => (
            <li key={s} className="rounded-full bg-[#f7f7f8] px-4 py-1.5 font-[family-name:var(--font-landing-mono)] text-[12px] text-[#525866] ring-1 ring-black/[0.06]">
              {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="grey">
        <StatBand
          items={[
            { value: 16, suffix: "+", label: "minimum PostgreSQL major version" },
            { value: 4, label: "Docker Compose services: db, setup, app, cron" },
            { value: 0, label: "queue servers or separate workers to run" },
            { value: 0, prefix: "$", label: "per seat, per contact or per mailbox" },
          ]}
        />
      </Section>

      <Section id="contribute" eyebrow="Contributing" title="Built in the open, merged on a green check" lede="Anyone can report a bug, suggest a feature, fix an issue or improve the docs. The rules for changing the code are written down.">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { icon: RiGitPullRequestLine, title: "Open a pull request", body: "Fork, branch from main, run the checks CI runs, and open a PR. One issue per pull request, kept small.", href: blob("CONTRIBUTING.md"), cta: "CONTRIBUTING.md" },
            { icon: RiScales3Line, title: "How decisions are made", body: "Day-to-day changes need one maintainer approval and a green CI check. Architecture, data model and licensing changes need two maintainers.", href: blob("GOVERNANCE.md"), cta: "GOVERNANCE.md" },
            { icon: RiBug2Line, title: "Report a problem", body: "Bugs go in issues. Security problems are reported privately through GitHub, never in a public issue.", href: blob("SECURITY.md"), cta: "SECURITY.md" },
          ].map(({ icon: Icon, title, body, href, cta }) => (
            <div key={title} className="flex flex-col rounded-3xl bg-[#f7f7f8] p-6 ring-1 ring-black/[0.05] sm:p-8">
              <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl bg-[#335cff]/[0.07] text-[#335cff] ring-1 ring-inset ring-[#335cff]/[0.14]">
                <Icon className="size-5" />
              </span>
              <p className="mt-5 text-[16px] font-medium text-[#141414]">{title}</p>
              <p className="mt-1.5 flex-1 text-[14px] leading-[22px] text-[#656565]">{body}</p>
              <p className="mt-5 text-[14px]">
                <Ext href={href}>{cta}</Ext>
              </p>
            </div>
          ))}
        </div>
        <pre className="mt-6 overflow-x-auto rounded-2xl bg-[#0d0f1a] p-5 font-[family-name:var(--font-landing-mono)] text-[13px] leading-[24px] text-white/90 sm:p-6">
          <code>
            <span className="block text-white/40"># the checks CI runs before a merge</span>
            {["bun run typecheck", "bun run lint", "bun run test", "bun run build"].map((c) => (
              <span key={c} className="block">
                <span className="select-none text-[#97baff]">$ </span>
                {c}
              </span>
            ))}
          </code>
        </pre>
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/product/ai-crm", "/solutions/founders", "/solutions/agencies", "/solutions/sales-teams", "/compare", "/guides"]} />

      <ClosingCta
        title="Read it, run it, change it"
        lede="Clone the repository, start it with Docker Compose and connect your own accounts. The code, the data and the keys stay with you."
        primary={{ href: REPO, label: "Star on GitHub", external: true }}
        secondary={{ href: blob("docs/self-hosting.md"), label: "Self-hosting guide", external: true }}
      />
    </>
  );
}
