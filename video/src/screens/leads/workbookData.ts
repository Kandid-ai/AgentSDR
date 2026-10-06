import type { SheetPayload } from "@/components/grid/WorkbookClient";
import type { GridColumn, GridRow, GridTable, GridWorkbook } from "@/lib/grid/schema";
import type { CellMeta } from "@/lib/grid/types";

/**
 * One sample People table behind every workbook screen (the full table, the raw
 * and enriched pair, the enrichment dialog, the Add column menu). The raw and
 * enriched sheets share these columns and rows, so a still of one lines up
 * pixel for pixel with a still of the other.
 */

const DAY = 86_400_000;
const at = (d: number) => new Date(Date.now() - d * DAY);
const runAt = new Date(Date.now() - 3_600_000).toISOString();

export const workbook: GridWorkbook = { organizationId: "org_northstar", id: "w1", name: "Q4 · Heads of Sales, US SaaS", description: null, folderId: null, createdAt: at(20), updatedAt: at(0) };
const mkTable = (id: string, name: string, position: number): GridTable =>
  ({ organizationId: "org_northstar", id, workbookId: "w1", name, position, description: null, autoRun: true, view: {}, createdAt: at(20), updatedAt: at(0) });
const people = mkTable("t-people", "People", 1);
export const tables = [people, mkTable("t-companies", "Companies", 2)];

const col = (key: string, name: string, type: GridColumn["type"], position: number, config: GridColumn["config"] = {}): GridColumn =>
  ({ id: `c-${key}`, tableId: people.id, key, name, type, config, dependsOn: [], position, autoRun: true, createdAt: at(20), updatedAt: at(0) });

const APOLLO = { integrationKey: "apollo", actionKey: "find-work-email" };

export const columns: GridColumn[] = [
  col("name", "Name", "text", 1),
  col("title", "Title", "text", 2),
  col("company", "Company", "text", 3),
  col("linkedin", "LinkedIn", "url", 4),
  col("emailFind", "Find work email", "enrichment", 5, {
    ...APOLLO, handlerKey: "apollo.find-work-email",
    inputs: { fullName: { source: "column", columnKey: "name" }, companyDomain: { source: "column", columnKey: "website" } },
    outputs: { email: "workEmail" }, connectionId: "conn-apollo",
  }),
  col("workEmail", "Work email", "integration_output", 6, { ...APOLLO, sourceColumnKey: "emailFind", outputKey: "email", valueType: "email" }),
  col("verified", "Email verified", "integration_output", 7, { integrationKey: "millionverifier", actionKey: "verify-email", sourceColumnKey: "emailVerify", outputKey: "verified", valueType: "boolean" }),
  col("emailVerify", "Verify email", "enrichment", 8, {
    integrationKey: "millionverifier", actionKey: "verify-email", handlerKey: "millionverifier.verify-email",
    inputs: { email: { source: "column", columnKey: "workEmail" } }, outputs: { verified: "verified" }, connectionId: "conn-mv",
  }),
  col("opener", "AI opener", "ai_output", 9, { sourceColumnKey: "aiOpener", outputKey: "opener", valueType: "text" }),
  col("aiOpener", "Write opener", "ai", 10, {
    useCase: "content", providerKey: "openrouter", modelKey: "claude", connectionId: "conn-3",
    prompt: "Write a one-line opener for {{name}}, {{title}} at {{company}}.", outputFormat: "fields",
    outputs: [{ key: "opener", name: "AI opener", type: "text" }], outputColumns: { opener: "opener" },
  }),
  // Never shown: gives the enrichment dialog a URL column to map "Company domain" to.
  col("website", "Website", "url", 11),
];

const HIDDEN = ["emailFind", "emailVerify", "aiOpener", "opener", "website"];

type P = [name: string, title: string, company: string, domain: string, provider: string | null, opener: string | null];
const P: P[] = [
  ["Maya Chen", "VP Sales", "Northwind Labs", "northwindlabs.io", "Apollo", "Saw Northwind just opened a London office. Congrats on the push into EMEA."],
  ["Daniel Okafor", "Head of Sales", "Brightloop", "brightloop.com", "Apollo", "Your team doubled SDR headcount this year. How are you keeping replies personal?"],
  ["Priya Raman", "VP Revenue", "Ledgerly", "ledgerly.co", "Apollo", "Loved your post on pricing experiments. Curious how outbound fits in."],
  ["Lucas Meyer", "Head of Growth", "Parcelly", "parcelly.io", "Apollo", "Parcelly's new carrier integrations caught my eye. Who owns outbound there?"],
  ["Sofia Alvarez", "CRO", "Kestrel Health", "kestrelhealth.com", "Apollo", "Congrats on the Series B. Hiring plans for sales must be busy."],
  ["Ethan Brooks", "VP Sales", "Oakridge Cloud", "oakridge.cloud", "Apollo", "Oakridge's SOC 2 launch is a strong hook for mid-market. Open to a quick idea?"],
  ["Aiko Tanaka", "Head of Sales", "Lumen Freight", "lumenfreight.com", "Apollo", "Lumen Freight is hiring AEs in Chicago. Is pipeline the bottleneck?"],
  ["Grace Kim", "VP Sales", "Atlas Pay", "atlaspay.io", "Apollo", "Atlas Pay's move upmarket means longer cycles. We help keep every thread alive."],
  ["Omar Haddad", "Head of Revenue", "Stackwise", "stackwise.dev", "Apollo", "Your docs are great. Developer-led deals usually need a nudge from sales."],
  ["Hannah Weiss", "VP Growth", "Copperline", "copperline.co", "Apollo", "Copperline's partner program looks fresh. Are you prospecting into agencies too?"],
  ["Leo Rossi", "Sales Director", "Brightwave", "brightwave.ai", "Apollo", "Saw Brightwave's launch week. Worth a note on how teams follow up after demos?"],
  ["Chloé Martin", "Head of Sales", "Atelier Nord", "ateliernord.com", "Apollo", "Atelier Nord is expanding across the Nordics. Want a hand with outbound?"],
  ["Samir Haddad", "COO", "Parcelly", "parcelly.io", null, null],
  ["Rafael Costa", "VP Sales", "Brightloop", "brightloop.com", null, null],
];

const ok = (provider: string): CellMeta => ({ status: "success", provider, costCents: 4, runAt });
const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export type Variant = {
  /** How many of the sample people. */
  count: number;
  /** Whether the enrichment output cells (work email, verified, opener) hold values. */
  filled: boolean;
  /** Table total shown in the footer. */
  total: number;
};

export const FULL: Variant = { count: 14, filled: true, total: 1240 };
export const RAW: Variant = { count: 10, filled: false, total: 10 };
export const ENRICHED: Variant = { count: 10, filled: true, total: 10 };

export function buildSheet({ count, filled, total }: Variant): SheetPayload {
  const rows: GridRow[] = P.slice(0, count).map(([name, title, company, domain, provider, opener], i) => {
    const first = plain(name.split(" ")[0]);
    const last = plain(name.split(" ")[1]);
    const found = filled && provider !== null;
    const cells: Record<string, unknown> = {
      name, title, company, linkedin: `https://linkedin.com/in/${first}-${last}`, website: `https://${domain}`,
      ...(found ? { emailFind: `Found · ${provider}`, workEmail: `${first}@${domain}`, emailVerify: "Verified", verified: i !== 5, opener } : {}),
    };
    const cellMeta: Record<string, CellMeta> = found
      ? { emailFind: ok(provider), emailVerify: ok("MillionVerifier"), aiOpener: ok("OpenRouter") }
      : {};
    return { id: `row-${i}`, tableId: people.id, position: i + 1, cells, cellMeta, version: i + 1, createdAt: at(1), updatedAt: at(0) };
  });
  const found = rows.filter((r) => r.cells.workEmail !== undefined).length;
  const pct = Math.round((found / Math.max(1, rows.length)) * 100);
  const coverage: Record<string, number> = {
    name: 100, title: 100, company: 100, linkedin: 100, website: 100,
    emailFind: pct, workEmail: pct, verified: pct, emailVerify: pct, opener: pct, aiOpener: pct,
  };
  return {
    table: { ...people, view: { hiddenColumns: HIDDEN } },
    columns, rows, total, unfilteredTotal: total, cursor: 99, coverage, activeJobs: 0,
    view: { hiddenColumns: HIDDEN },
  };
}
