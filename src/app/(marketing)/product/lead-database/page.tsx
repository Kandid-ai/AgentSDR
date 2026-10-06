import {
  RiBuilding2Line,
  RiCheckboxMultipleLine,
  RiContactsBook3Fill,
  RiFilter3Line,
  RiForbidLine,
  RiMailForbidLine,
  RiSearchLine,
  RiShieldUserLine,
  RiSendPlaneLine,
} from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureGrid, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section, Steps } from "@/components/marketing/blocks";
import { ACCENT } from "@/components/marketing/catalog";
import { JsonLd } from "@/components/marketing/JsonLd";
import { StatBand } from "@/components/marketing/live";
import { CustomFields } from "@/components/marketing/pages/data/CustomFields";
import { DoNotContact } from "@/components/marketing/pages/data/DoNotContact";
import { ImportMapping } from "@/components/marketing/pages/data/ImportMapping";
import { MatchRows } from "@/components/marketing/pages/data/MatchRows";
import { PersonRecord } from "@/components/marketing/pages/data/PersonRecord";
import { Card, LeadsVignette } from "@/components/landing/Features";
import { Reveal } from "@/components/landing/Reveal";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";

const PATH = "/product/lead-database";
const DESCRIPTION =
  "An open-source B2B lead database: import leads from CSV or XLSX, add custom lead fields, match duplicates, and run email, LinkedIn and WhatsApp from one list.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "B2B lead database for every outbound channel",
  ogTitle: "A B2B lead database every channel shares",
  eyebrow: "Lead database",
  description: DESCRIPTION,
});

const HEADERS: Array<[string, string]> = [
  ["Email", "email, email address"],
  ["LinkedIn URL", "linkedin, linkedin url, linkedin profile"],
  ["Full name", "name, full name"],
  ["First name / Last name", "first name, last name"],
  ["Job title", "title, job title, headline"],
  ["Company name", "company, company name"],
  ["Company domain", "domain, company domain, website, company website, company url"],
  ["Phone", "phone, phone number, mobile, mobile phone, mobile number, whatsapp, whatsapp number, work phone"],
  ["Notes", "notes"],
];

const FAQ = [
  {
    q: "What is a B2B lead database in AgentSDR?",
    a: "One list of people and companies for your whole organization. A person exists once, no matter how many email, LinkedIn or WhatsApp campaigns they are in, and a company is identified by its domain. The Leads page shows who you can reach, which campaign they are in and their CRM state.",
  },
  {
    q: "How do I import leads from a CSV or Excel file?",
    a: "On the Leads page, open Import people and choose an .xlsx, .xls or .csv file. The first sheet is read and the first row must be the headers. Every row needs an email or a LinkedIn URL. Imports take up to 5,000 rows per file, and the summary lists processed, created, updated and failed rows, with the reason for each failure.",
  },
  {
    q: "Can I map my own column names?",
    a: "Yes, in a campaign import. A mapping screen shows each column with a sample value and a Platform field dropdown, pre-selected where the header looks familiar. A column can map to one field only. Choose Keep as variable for any column you want to use in messages, so Job Title becomes {{jobTitle}}.",
  },
  {
    q: "How are duplicate leads handled?",
    a: "Each row is matched to an existing person by email, ignoring case, then by LinkedIn profile. A match is updated and no match creates a new person, so importing the same list twice does not duplicate anyone. A blank cell never erases stored data. If a row's email and LinkedIn profile belong to two different people, that row fails and asks you to merge them first. In an email campaign, an address already in the campaign is counted as a duplicate and not enrolled twice.",
  },
  {
    q: "What are custom lead fields?",
    a: "Fields you add to people or companies beyond the built-in ones, such as plan tier or renewal date. They are defined per organization, typed (Text, Number, Currency, Checkbox, Date, URL, Email, Image from URL, Select, Multi-select or JSON), and keep a permanent key that starts with x_. You can rename a field, change its type where the values convert, remove it and restore it, or delete it permanently.",
  },
  {
    q: "Can I stop contacting a lead on every channel at once?",
    a: "Yes. Mark a person Do Not Contact from their CRM record and sending is refused on every channel: email sequences, LinkedIn replies, WhatsApp and CRM sends. Separately, a suppression list of unsubscribed, bounced, manual and complaint addresses is checked before every email, and email imports skip suppressed addresses.",
  },
  {
    q: "Can different clients or teams keep separate lead lists?",
    a: "Leads belong to an organization. Someone in another organization never sees them and you never see theirs, which is how an agency keeps one deployment with a separate organization per client.",
  },
];

export default function LeadDatabasePage() {
  return (
    <>
      <JsonLd data={softwareLd(DESCRIPTION, PATH)} />
      <PageHero
        path={PATH}
        crumb="Lead database"
        eyebrow="Lead database"
        eyebrowIcon={RiContactsBook3Fill}
        title="A B2B lead database that every channel shares"
        lede="Import leads from a CSV or XLSX, keep every column, and run email, LinkedIn and WhatsApp from the same list. People and companies exist once, however many campaigns they are in."
      >
        <HeroFrame>
          <ImportMapping />
        </HeroFrame>
      </PageHero>

      <Section id="one-list" eyebrow="One list" title="Lead management for outbound, without copies" lede="Most stacks keep a list per tool, so the same person gets an email, an invite and a WhatsApp message from three systems that never compare notes.">
        <FeatureSplit
          eyebrow="Shared by every channel"
          accent={ACCENT.data}
          title="One person, however many campaigns"
          body="The Leads page is the single list of everyone you can reach. Each row shows which channels you have, the campaign they are in and, after a reply, their CRM stage."
          bullets={["A person is stored once across email, LinkedIn and WhatsApp", "Companies are created and matched by domain as people arrive", "A reply on any channel marks their enrollments replied and stops email follow-ups"]}
          visual={<PersonRecord />}
        />
      </Section>

      <Section tone="grey">
        <StatBand
          items={[
            { value: 5000, label: "rows per import file, on the Leads page or in a campaign" },
            { value: 11, label: "field types for custom lead fields" },
            { value: 3, label: "channels that share each person: email, LinkedIn, WhatsApp" },
            { value: 0, prefix: "$", label: "per contact, per seat or per list" },
          ]}
        />
      </Section>

      <Section id="import" eyebrow="Import" title="Import leads from CSV or XLSX" lede="Bring a list in from a spreadsheet, match it to who you already have, and keep the columns you care about.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
          <Reveal>
            <h3 className="font-[family-name:var(--font-brand-display)] text-[28px] leading-[1.15] tracking-[-0.03em] text-[#141414] sm:text-[34px]">Headers are recognised, not guessed at</h3>
            <p className="mt-4 text-[16px] leading-[1.65] text-[#5c5c5c]">
              Headers are matched ignoring case, spaces and punctuation, so Job Title, job_title and JOBTITLE are the same column. Every row needs an email or a LinkedIn URL. Rows with neither are dropped before the import starts.
            </p>
            <p className="mt-4 text-[16px] leading-[1.65] text-[#5c5c5c]">
              Phone numbers typed without a country code use your organization&apos;s default phone country. A malformed phone number is dropped and the rest of the row is imported.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div className="overflow-hidden rounded-2xl ring-1 ring-black/[0.08]">
              <table className="w-full text-left text-[13px]">
                <caption className="sr-only">Column headers the importer recognises</caption>
                <thead className="bg-[#f7f7f8] text-[12px] text-[#656565]">
                  <tr>
                    <th scope="col" className="w-[34%] px-4 py-2.5 font-medium">Lead field</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Accepted headers</th>
                  </tr>
                </thead>
                <tbody>
                  {HEADERS.map(([field, accepted]) => (
                    <tr key={field} className="border-t border-black/[0.06] align-top">
                      <th scope="row" className="px-4 py-2.5 font-medium text-[#141414]">{field}</th>
                      <td className="px-4 py-2.5 font-mono text-[12px] leading-5 text-[#5c5c5c]">{accepted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
        <FeatureSplit
          reverse
          eyebrow="Duplicates"
          accent={ACCENT.data}
          title="Match on email, then LinkedIn"
          body="Each row is looked up in your organization first. A match is updated, no match creates a person, and two people are never merged by accident."
          bullets={["Email is matched case-insensitively, then the LinkedIn profile", "Blank cells never erase stored data", "A row whose email and profile belong to two people fails with a clear reason"]}
          visual={<MatchRows />}
        />
      </Section>

      <Section tone="grey" id="custom-fields" eyebrow="Custom fields" title="Custom lead fields that stay yours" lede="Store a plan tier, a region or a renewal date on a person or company, typed, per organization, without touching the database.">
        <FeatureSplit
          eyebrow="Typed, per organization"
          accent={ACCENT.data}
          title="Rename freely. Change types carefully."
          body="Fields are added from Settings, Lead columns. Each gets a permanent key, so a rename never breaks anything that points at it, and a type change is checked against your stored values before it is made."
          bullets={["Text, Number, Currency, Checkbox, Date, URL, Email, Image from URL, Select, Multi-select and JSON", "Any type to Text, or Text to Number, Checkbox, Date or Multi-select", "Remove keeps the data and can be restored; delete is permanent and strips the values"]}
          visual={<CustomFields />}
        />
      </Section>

      <Section id="protect" eyebrow="Protect your list" title="Do Not Contact is one flag, enforced everywhere" lede="The people you must not message should be impossible to message by accident, from any tool.">
        <FeatureSplit
          eyebrow="Do Not Contact"
          accent={ACCENT.data}
          title="Mark it once, every channel refuses"
          body="Do Not Contact belongs to the person, not a campaign. Email sequences, LinkedIn replies, WhatsApp and CRM sends all check it on the server. A separate suppression list holds unsubscribed, bounced, manual and complaint addresses."
          bullets={["Global to the person, across email, LinkedIn and WhatsApp", "Suppressed addresses are skipped on email imports", "Clear the flag from the same menu to allow sending again"]}
          visual={<DoNotContact />}
        />
        <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-6 lg:grid-cols-2">
          <Reveal>
            <Card title="Rows land one at a time" body="Imported people appear on the Leads page with their company, job title and source, ready to add to a campaign.">
              <LeadsVignette />
            </Card>
          </Reveal>
          <Reveal delay={80}>
            <div className="flex h-full flex-col justify-center rounded-3xl bg-[#3737370b] px-6 py-9 sm:px-10">
              <h3 className="text-[16px] font-medium leading-[26px] text-[#141414]">Find the right people fast</h3>
              <p className="mt-2 text-[14px] leading-[22px] text-[#656565]">Search covers email, LinkedIn URL, name, title, company and domain, plus imported extra columns. Filters narrow People down further.</p>
              <ul className="mt-5 grid gap-2.5 text-[14px] text-[#2b2b2b]">
                {["Campaign: all, email, LinkedIn or not in a campaign", "CRM category and subcategory, and CRM state", "Has email, has LinkedIn", "Sort by last updated, date added, name, company, title or email"].map((x) => (
                  <li key={x} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[#0b8a7a]" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section tone="grey" id="details" eyebrow="The details" title="What the lead list does for you" lede="The small things that keep a list usable as it grows.">
        <FeatureGrid
          items={[
            { icon: RiSendPlaneLine, title: "Straight into campaigns", body: "Pick people from your lead database for a campaign, or import a file straight into an email, LinkedIn or WhatsApp campaign." },
            { icon: RiCheckboxMultipleLine, title: "Extra columns kept", body: "In a campaign import, unmapped columns are camelCased and stored on the person: Job Title becomes {{jobTitle}}." },
            { icon: RiBuilding2Line, title: "Companies by domain", body: "Companies are matched by domain. If a row has a company name but no domain, the domain comes from the email unless it is webmail." },
            { icon: RiFilter3Line, title: "Lead categories", body: "Replies sort people into CRM categories: Customer, Interested, Not interested and Other, each with its own stages." },
            { icon: RiSearchLine, title: "Reach at a glance", body: "Three icons per person show whether you have an email, a LinkedIn profile and a phone. Click to copy or open." },
            { icon: RiMailForbidLine, title: "Suppression list", body: "Unsubscribed, bounced, manual and complaint addresses are checked before every email." },
            { icon: RiShieldUserLine, title: "Per organization", body: "Leads, fields and uniques are scoped to an organization. Another organization never sees them." },
            { icon: RiForbidLine, title: "No silent merges", body: "Conflicting identities fail the row instead of overwriting a person." },
            { icon: RiContactsBook3Fill, title: "Import runs", body: "Each campaign import records the file, the campaign, whether you mapped columns and the counts." },
          ]}
        />
      </Section>

      <Section id="get-started" eyebrow="Get started" title="From spreadsheet to campaign">
        <Steps
          items={[
            { title: "Import your list", body: "On People, click Import people and choose a CSV or XLSX. Download the template first if you like." },
            { title: "Check the result", body: "See created, updated and failed rows, with the reason and row number for each failure." },
            { title: "Add your own fields", body: "Open Lead columns to add typed fields for people or companies." },
            { title: "Launch from the list", body: "Add people to a campaign, or import a file straight into one. Replies come back classified." },
          ]}
        />
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/product/tables", "/product/email", "/product/linkedin", "/product/ai-crm", "/solutions/agencies", "/compare/apollo"]} />

      <ClosingCta title="Keep your list, and your data" lede="Clone the repo, import a CSV and launch from one list. It runs in your own database, with no per-contact pricing and no one else holding your leads." />
    </>
  );
}
