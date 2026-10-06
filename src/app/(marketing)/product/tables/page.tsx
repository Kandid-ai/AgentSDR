import {
  RiCursorLine,
  RiFlashlightLine,
  RiFolderLine,
  RiFunctionLine,
  RiKey2Line,
  RiLayoutGridFill,
  RiPlayCircleLine,
  RiSearchEyeLine,
  RiUserSharedLine,
} from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureGrid, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section, Steps } from "@/components/marketing/blocks";
import { ACCENT } from "@/components/marketing/catalog";
import { JsonLd } from "@/components/marketing/JsonLd";
import { StatBand } from "@/components/marketing/live";
import { CellStatus } from "@/components/marketing/pages/data/CellStatus";
import { ColumnTypes } from "@/components/marketing/pages/data/ColumnTypes";
import { FillingGrid } from "@/components/marketing/pages/data/FillingGrid";
import { RowsToCampaign } from "@/components/marketing/pages/data/RowsToCampaign";
import { Card, TablesVignette } from "@/components/landing/Features";
import { Reveal } from "@/components/landing/Reveal";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";

const PATH = "/product/tables";
const DESCRIPTION =
  "Open-source AI enrichment tables: add AI columns, HTTP API, formula and Apollo enrichment columns to a grid of leads, then turn the chosen rows into a campaign.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "AI enrichment tables: API, formula and AI columns",
  ogTitle: "AI enrichment tables for your lead lists",
  eyebrow: "Enrichment tables",
  description: DESCRIPTION,
});

const PROVIDERS: Array<{ group: string; note: string; names: string[] }> = [
  {
    group: "Email and person lookup",
    note: "Find work emails and phones, enrich a profile, search people.",
    names: ["Apollo.io", "Hunter", "Snov.io", "Findymail", "FullEnrich", "LeadMagic", "ContactOut", "RocketReach", "Icypeas", "Cleanlist", "Lusha"],
  },
  {
    group: "Email verification",
    note: "Check an address before you send to it.",
    names: ["MillionVerifier", "ZeroBounce"],
  },
  {
    group: "Company and traffic data",
    note: "Traffic, rank, technologies and search competitors for a domain.",
    names: ["Similarweb", "Semrush"],
  },
];

const FAQ = [
  {
    q: "What are AI enrichment tables?",
    a: "A spreadsheet-style workspace for building a prospect list before you send anything. You import or paste rows, then add columns that fetch data: enrichment providers, an AI prompt, an HTTP call or a formula. When the list looks right you create a campaign from the rows you pick.",
  },
  {
    q: "What is an AI column?",
    a: "A column that sends a prompt to a language model for every row, using values from your other columns as {{column}} tokens. You choose a use case (web research, image generation, or creating and modifying content), a model, the output fields you want, and optional examples. Each output field becomes its own column. It runs on your organization's own OpenRouter key, so AgentSDR adds no markup and you pay your model provider directly.",
  },
  {
    q: "Which enrichment providers are supported?",
    a: "Fifteen: Apollo.io, Hunter, Snov.io, Findymail, FullEnrich, LeadMagic, ContactOut, RocketReach, Icypeas, Cleanlist and Lusha for emails, phones and profiles; MillionVerifier and ZeroBounce for email verification; Similarweb and Semrush for company and traffic data. You connect your own account with each, and credentials are verified with a live call and stored encrypted.",
  },
  {
    q: "Is there a waterfall between providers?",
    a: "Not yet. A column uses the account you chose and does not fall back to another provider. Waterfall columns appear in the menu but are disabled today. FullEnrich runs a provider waterfall on its own side, and you can chain columns yourself by adding a second column that reads the first one's result.",
  },
  {
    q: "Can a column call my own API?",
    a: "Yes. The HTTP API column sends GET, POST, PUT or PATCH requests with {{column}} tokens in the URL, headers and body, and stores the whole response or a dot path into it such as data.employees. Secrets are not pasted into headers: you name a server environment variable and it is sent as a Bearer token. A 4xx response other than 429 is treated as a configuration mistake and is not retried.",
  },
  {
    q: "Are formulas safe to run?",
    a: "Formula columns evaluate one expression per row in a QuickJS sandbox compiled to WebAssembly, with no network, filesystem or process access, a one second limit per evaluation and a memory cap. They support JavaScript, FormulaJS, lodash and moment, plus LOOKUP to read from another table.",
  },
  {
    q: "What does enrichment cost?",
    a: "AgentSDR is free and open source. Providers and your model charge you on your own accounts, and AgentSDR does not convert credits to money or show a per-run cost. Cells with a blank required input are skipped before they reach the provider, and Save and run 10 rows lets you test a column before running the whole table.",
  },
];

export default function TablesPage() {
  return (
    <>
      <JsonLd data={softwareLd(DESCRIPTION, PATH)} />
      <PageHero
        eyebrow="Enrichment tables"
        eyebrowIcon={RiLayoutGridFill}
        title="AI enrichment tables for your lead lists"
        lede="Build a prospect list in a grid. Columns call an API, run a formula, ask your own model or pull from Apollo and 14 other providers, then the rows you pick become a campaign."
      >
        <HeroFrame>
          <FillingGrid />
        </HeroFrame>
      </PageHero>

      <Section id="columns" eyebrow="Column types" title="AI columns, APIs, formulas and providers in one grid" lede="Four kinds of column fill in data for you. Each can read the others, so a chain runs on its own: find an email, then use it.">
        <ColumnTypes />
      </Section>

      <Section tone="grey" id="providers" eyebrow="Enrichment providers" title="Fifteen providers, on your own accounts" lede="Connect a provider once from inside the table, map its inputs to your columns and tick the outputs you want.">
        <Reveal>
          <ul className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
            {PROVIDERS.map((p) => (
              <li key={p.group} className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.06] sm:p-7">
                <h3 className="text-[16px] font-medium text-[#141414]">{p.group}</h3>
                <p className="mt-1 text-[14px] leading-[22px] text-[#656565]">{p.note}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {p.names.map((n) => (
                    <li key={n} className="rounded-lg bg-[#f7f7f8] px-3 py-1.5 text-[13px] font-medium text-[#2b2b2b] ring-1 ring-inset ring-black/[0.05]">
                      {n}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={80}>
          <p className="mx-auto mt-8 max-w-[44rem] text-center text-[14px] leading-[22px] text-[#656565]">
            Apollo alone offers 15 actions, from finding a work email to enriching a company or adding a contact to an Apollo sequence. You can add several accounts per provider, one per client for example, and each column keeps its own choice. A column does not fall back to another provider: waterfall columns are not available yet.
          </p>
        </Reveal>
      </Section>

      <Section id="runs" eyebrow="Runs" title="Fills in while you keep working">
        <FeatureSplit
          eyebrow="Background runs"
          accent={ACCENT.data}
          title="Auto-run, statuses and retries"
          body="Cells are filled by a background worker. With Auto-run on, a column starts for a row once every column it reads has a value, which is how a chain works without you pressing anything."
          bullets={["Save and run 10 rows to test before the whole table", "Not run, Queued, Running, Waiting for provider, Completed or an error you can read", "Up to 3 attempts per cell, 2 then 8 seconds apart; bad URLs and 4xx are not retried"]}
          visual={<CellStatus />}
        />
      </Section>

      <Section tone="grey" id="start" eyebrow="Start from a list" title="Import, paste or type your rows">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Reveal>
            <Card title="Columns that fetch the data you are missing" body="An enrichment table fills in cells as a list moves from names and domains to emails, company size and a pitch angle.">
              <TablesVignette />
            </Card>
          </Reveal>
          <Reveal delay={80}>
            <div className="flex h-full flex-col justify-center rounded-3xl bg-white px-6 py-9 ring-1 ring-black/[0.06] sm:px-10">
              <h3 className="font-[family-name:var(--font-brand-display)] text-[28px] leading-[1.15] tracking-[-0.03em] text-[#141414]">Three ways to add rows</h3>
              <dl className="mt-6 grid gap-5 text-[14px] leading-[22px]">
                {[
                  ["Import", "CSV, TSV, TXT, XLSX or XLS, up to 50,000 rows. A mapping screen lets you skip columns, and types such as email, URL, checkbox, number and date are guessed for you."],
                  ["Paste", "Paste straight into the grid, up to 1,000 rows and 100 new columns at a time."],
                  ["Type", "Edit any cell directly, or start from a blank workbook."],
                ].map(([k, v]) => (
                  <div key={k} className="grid gap-1 sm:grid-cols-[80px_1fr] sm:gap-4">
                    <dt className="font-medium text-[#141414]">{k}</dt>
                    <dd className="text-[#656565]">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-[13px] leading-5 text-[#8a8a8a]">Workbooks hold several tables, live in folders and belong to your organization.</p>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section id="campaign" eyebrow="Then send" title="Turn the rows you pick into a campaign">
        <FeatureSplit
          reverse
          eyebrow="Table to campaign"
          accent={ACCENT.data}
          title="Select rows, map columns, launch"
          body="Choose Create campaign on the selected rows, pick Email or LinkedIn, and map campaign fields to your columns. People are created only after you confirm, and only the selected rows are enrolled."
          bullets={["Up to 5,000 rows into a campaign at a time", "Unmapped columns are kept and become merge fields", "On email campaigns, suppressed addresses are skipped and reported"]}
          visual={<RowsToCampaign />}
        />
      </Section>

      <Section tone="grey">
        <StatBand
          items={[
            { value: 15, label: "enrichment providers you can connect" },
            { value: 50000, label: "rows in one table import" },
            { value: 3, label: "attempts per failed cell before it shows an error" },
            { value: 0, prefix: "$", label: "per row, per credit or per seat from AgentSDR" },
          ]}
        />
      </Section>

      <Section id="details" eyebrow="The details" title="What a table does for you" lede="The parts that make a grid safe to run against real lists and real accounts.">
        <FeatureGrid
          items={[
            { icon: RiPlayCircleLine, title: "Run what you choose", body: "Run selected rows, the first 10 on a page, all rows, or one cell from its play button." },
            { icon: RiFlashlightLine, title: "Skips blank inputs", body: "A row missing a required input is not queued and never reaches the provider." },
            { icon: RiFunctionLine, title: "Lookups across tables", body: "LOOKUP reads a value from another table by a matching column." },
            { icon: RiKey2Line, title: "Secrets stay on the server", body: "Provider keys are encrypted. HTTP columns name an environment variable instead of holding a key." },
            { icon: RiUserSharedLine, title: "Several accounts per provider", body: "Each enrichment column keeps its own account, so a client's key stays with the client's table." },
            { icon: RiSearchEyeLine, title: "Cell details", body: "Click a cell to see its provider, outcome, latency, run time and error." },
            { icon: RiFolderLine, title: "Workbooks and folders", body: "Several tables per workbook, filed in folders, scoped to your organization." },
            { icon: RiCursorLine, title: "Pick the columns that matter", body: "An action runs once per row however many outputs you tick, and each output is its own column." },
            { icon: RiLayoutGridFill, title: "Export", body: "Export selected rows as CSV, or delete them from the same menu." },
          ]}
        />
      </Section>

      <Section tone="grey" id="get-started" eyebrow="Get started" title="From a bare list to a campaign">
        <Steps
          items={[
            { title: "Add rows", body: "Import a CSV or XLSX, paste into the grid or start blank." },
            { title: "Add columns", body: "Choose Add enrichment, Use AI, HTTP API or Formula and map their inputs." },
            { title: "Test on 10 rows", body: "Save and run 10 rows, check the cells, then run the rest." },
            { title: "Create the campaign", body: "Select the rows, map your columns and enrol them." },
          ]}
        />
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/product/lead-database", "/compare/clay", "/product/email", "/product/ai-crm", "/compare/apollo", "/solutions/founders"]} />

      <ClosingCta title="Enrich on your own keys" lede="Clone the repo, connect the providers and models you already pay for, and build your first table. No credits to resell and no per-row pricing." />
    </>
  );
}
