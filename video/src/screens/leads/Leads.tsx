import LeadsClient from "@/components/leads/LeadsClient";
import type { Campaign, PersonRow } from "@/components/leads/leadTypes";
import { AppScreen } from "../Shell";
import { mockRoutes } from "../mock";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const US: Campaign = { id: "c-us", name: "Heads of Sales · US SaaS", channel: "email", status: "active" };
const US_LI: Campaign = { id: "c-us-li", name: "Heads of Sales · LinkedIn", channel: "linkedin", status: "active" };
const EU: Campaign = { id: "c-eu", name: "Agencies · Founders (EU)", channel: "email", status: "active" };
const WEB: Campaign = { id: "c-web", name: "Webinar follow-up", channel: "email", status: "paused" };

type Crm = NonNullable<PersonRow["crm"]>;
const crm = (id: string, categoryKey: string | null, subcategory: string | null, workflowState: string, extra: Partial<Crm> = {}): Crm => ({
  recordId: id, categoryKey, subcategory, workflowState, activeChannel: "email", activeSequence: null, currentStep: null,
  lastInboundAt: null, lastOutboundAt: ago(2), lastInteractionAt: ago(1), nextActionAt: null, unacknowledgedAiChange: false, ...extra,
});

function person(i: number, name: string, title: string, company: string | null, domain: string, opts: { email?: boolean; li?: boolean; phone?: boolean; campaigns: Campaign[]; crm: Crm | null }): PersonRow {
  const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").split(" ");
  return {
    person: {
      id: `p${i}`, fullName: name, title, source: "csv",
      email: opts.email === false ? null : `${slug[0]}@${domain}`,
      linkedinUrl: opts.li === false ? null : `https://www.linkedin.com/in/${slug.join("-")}`,
      phone: opts.phone ? "+1 415 555 0142" : null, updatedAt: ago(i),
    },
    company: { name: company, domain },
    campaigns: opts.campaigns,
    crm: opts.crm,
  };
}

const ROWS: PersonRow[] = [
  person(1, "Maya Chen", "VP Sales", "Northwind Labs", "northwindlabs.io", { phone: true, campaigns: [US, US_LI], crm: crm("r1", "interested", "Meeting requested", "action_required", { lastInboundAt: ago(0.2), unacknowledgedAiChange: true }) }),
  person(2, "Daniel Okafor", "Head of Sales", "Brightloop", "brightloop.com", { campaigns: [US], crm: crm("r2", "interested", "Asked for pricing", "action_required", { lastInboundAt: ago(0.5) }) }),
  person(3, "Priya Raman", "VP Revenue", "Ledgerly", "ledgerly.co", { phone: true, campaigns: [US, US_LI], crm: crm("r3", "interested", "Meeting requested", "waiting", { unacknowledgedAiChange: true, nextActionAt: ahead(2) }) }),
  person(4, "Lucas Meyer", "Head of Growth", "Parcelly", "parcelly.io", { campaigns: [EU], crm: crm("r4", "other", "Out of office", "waiting", { nextActionAt: ahead(5) }) }),
  person(5, "Sofia Alvarez", "CRO", "Kestrel Health", "kestrelhealth.com", { campaigns: [US, WEB], crm: crm("r5", "interested", "Referred a colleague", "action_required", { lastInboundAt: ago(1) }) }),
  person(6, "Ethan Brooks", "VP Sales", "Oakridge Cloud", "oakridge.cloud", { li: false, campaigns: [US], crm: crm("r6", "not_interested", "Not now", "idle") }),
  person(7, "Aiko Tanaka", "Head of Sales", "Lumen Freight", "lumenfreight.com", { phone: true, campaigns: [US_LI], crm: crm("r7", "interested", "Positive reply", "waiting", { lastInboundAt: ago(1.5), nextActionAt: ahead(1) }) }),
  person(8, "Grace Kim", "VP Sales", "Atlas Pay", "atlaspay.io", { campaigns: [US], crm: crm("r8", "customer", "Active customer", "idle") }),
  person(9, "Omar Haddad", "Head of Revenue", "Stackwise", "stackwise.dev", { campaigns: [US], crm: crm("r9", null, null, "classifying", { lastInboundAt: ago(0.1) }) }),
  person(10, "Hannah Weiss", "VP Growth", "Copperline", "copperline.co", { campaigns: [EU], crm: crm("r10", "other", "Bounced", "error") }),
  person(11, "Leo Rossi", "Sales Director", "Brightwave", "brightwave.ai", { email: true, li: false, campaigns: [EU, WEB], crm: crm("r11", "interested", "Meeting requested", "waiting", { nextActionAt: ahead(3), unacknowledgedAiChange: true }) }),
  person(12, "Chloé Martin", "Head of Sales", "Atelier Nord", "ateliernord.com", { campaigns: [EU], crm: crm("r12", "interested", "Asked for a demo", "action_required", { lastInboundAt: ago(0.8) }) }),
  person(13, "Samir Haddad", "COO", "Parcelly", "parcelly.io", { phone: true, campaigns: [], crm: null }),
  person(14, "Rafael Costa", "VP Sales", "Brightloop", "brightloop.com", { campaigns: [US], crm: crm("r14", "not_interested", "Wrong person", "idle") }),
];

mockRoutes([
  { match: "/api/crm/categories", respond: () => ({ categories: [] }) },
  { match: "/api/leads/people", respond: () => ({ people: ROWS, total: 1240 }) },
]);

/** /leads — the real LeadsClient, People tab, on sample leads. */
export function Leads() {
  return (
    <AppScreen path="/leads" active="/leads">
      <LeadsClient initialTab="people" initialRows={ROWS} initialTotal={1240} />
    </AppScreen>
  );
}
