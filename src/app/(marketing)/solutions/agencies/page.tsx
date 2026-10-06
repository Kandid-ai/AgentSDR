import { RiBuilding2Line, RiCheckLine } from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section, Steps } from "@/components/marketing/blocks";
import { ACCENT } from "@/components/marketing/catalog";
import { SceneStage, StatBand } from "@/components/marketing/live";
import { OrgSwitcher } from "@/components/marketing/pages/solutions/OrgSwitcher";
import { marketingMetadata } from "@/lib/marketing/seo";

const PATH = "/solutions/agencies";

export const metadata = marketingMetadata({
  path: PATH,
  title: "Outbound tool for lead generation agencies",
  ogTitle: "Multi-client cold outreach for agencies",
  eyebrow: "Agencies",
  description: "Multi-client cold outreach on one deployment: a separate organization per client with its own leads, inboxes, accounts and rules. Open source.",
});

const FAQ = [
  {
    q: "Can one AgentSDR deployment run outreach for several clients?",
    a: "Yes. A deployment holds any number of organizations and each one is fully separate: its own leads, campaigns, conversations, connected mailboxes and LinkedIn and WhatsApp accounts, AI settings and sending rules. A second organization sees, changes and counts nothing of the first.",
  },
  {
    q: "Can my client log in and see only their own workspace?",
    a: "Yes. Invite them by email to that client's organization with a role. They see the organizations they belong to and nothing else. Everyone in an organization sees the same data, so give each client their own organization rather than a team inside yours.",
  },
  {
    q: "What do the roles allow?",
    a: "Owners and admins connect integrations, change AI and sending rules, invite people and manage teams. Members use leads, campaigns, the CRM and Analytics. Only owners can promote someone to owner. Roles change what a person can change, never what they can see.",
  },
  {
    q: "Who is allowed to create new organizations?",
    a: "It depends on the AUTH_SIGNUP setting on your deployment. With the default invite-only, only owners and admins of the first organization can create new ones, and new accounts need an invitation. With open, anyone who can reach the instance can sign up and create an organization.",
  },
  {
    q: "Do clients share sending limits?",
    a: "No. Sending rules are set per organization, so each client's emails a day, send gaps, sending hours, LinkedIn invitations and WhatsApp new chats are paced on their own. A LinkedIn account or WhatsApp number can also carry its own limit that overrides its organization's rule, and each mailbox has its own sending hours.",
  },
  {
    q: "Is there a per-client or per-seat fee?",
    a: "No. AgentSDR is open source under the AGPL-3.0 and you host it yourself, so there are no seats, tiers or per-client fees. You pay for your server, the accounts you connect and the AI usage on each organization's OpenRouter key.",
  },
];

const SEPARATE = [
  { what: "Leads, people and companies", detail: "One lead database per client. Imports, custom fields and Do Not Contact stay inside the organization." },
  { what: "Mailboxes, LinkedIn and WhatsApp accounts", detail: "Google Workspace, Unipile and R2 are connected per organization, from each channel's Connection page." },
  { what: "Campaigns, CRM and conversations", detail: "Each client has its own pipeline, Action required queue, sequences and knowledge base." },
  { what: "Sending rules", detail: "Emails a day, gaps, sending hours, LinkedIn and WhatsApp limits, set per client." },
  { what: "AI provider", detail: "OpenRouter keys, allowed providers and models are chosen per organization." },
  { what: "People and roles", detail: "Owners, admins and members belong to one organization and are invited to it." },
];

const ROLES = [
  { ability: "Use leads, campaigns, the CRM and Analytics", owner: true, admin: true, member: true },
  { ability: "Connect integrations and change AI settings", owner: true, admin: true, member: false },
  { ability: "Change sending rules", owner: true, admin: true, member: false },
  { ability: "Invite people, change roles, manage teams", owner: true, admin: true, member: false },
  { ability: "Promote or remove an owner", owner: true, admin: false, member: false },
];

function Mark({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#335cff] text-white">
      <RiCheckLine className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Yes</span>
    </span>
  ) : (
    <span className="text-[#a0a0a0]">
      <span aria-hidden="true">&ndash;</span>
      <span className="sr-only">No</span>
    </span>
  );
}

/** The Members page's invite form, drawn plain. Static: the product shot is the animated one. */
function InviteCard() {
  return (
    <div className="rounded-[24px] bg-[#f7f7f8] p-5 ring-1 ring-black/[0.05] sm:p-8">
      <div className="rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_16px_40px_-20px_rgb(0_0_0/0.2)]">
        <p className="font-[family-name:var(--font-landing-mono)] text-[11px] uppercase tracking-[0.06em] text-[#8a8a8a]">Settings &middot; Members &middot; Invite someone</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_130px]">
          <div className="rounded-xl bg-[#f7f7f8] px-3.5 py-2.5 text-[14px] text-[#141414] ring-1 ring-black/[0.06]">jo@harborpine.example</div>
          <div className="rounded-xl bg-[#f7f7f8] px-3.5 py-2.5 text-[14px] text-[#141414] ring-1 ring-black/[0.06]">Member</div>
        </div>
        <div className="mt-3 inline-flex rounded-lg bg-[#141414] px-3.5 py-2 text-[13px] font-medium text-white">Send invite</div>
      </div>
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.05)]">
        <p className="font-[family-name:var(--font-landing-mono)] text-[11px] uppercase tracking-[0.06em] text-[#8a8a8a]">Pending invitations</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[14px]">
          <span className="min-w-0 flex-1 truncate text-[#141414]">jo@harborpine.example</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[12px] text-[#525866] ring-1 ring-black/[0.08]">Member</span>
          <span className="text-[13px] text-[#656565]">Copy invite link</span>
          <span className="text-[13px] text-[#656565]">Cancel</span>
        </div>
        <p className="mt-3 text-[13px] leading-5 text-[#8a8a8a]">The invitation is emailed and expires after 7 days. Copy the link and send it yourself if the instance has no email service. An illustration with sample data.</p>
      </div>
    </div>
  );
}

export default function AgenciesPage() {
  return (
    <>
      <PageHero
        eyebrow="For agencies"
        eyebrowIcon={RiBuilding2Line}
        title="The outbound tool for lead generation agencies"
        lede="Multi-client cold outreach on one deployment. Each client gets an organization of their own, with their own leads, inboxes, connected accounts and sending rules, and you switch between them from the sidebar."
      >
        <HeroFrame>
          <OrgSwitcher />
        </HeroFrame>
      </PageHero>

      <Section id="separation" eyebrow="Separate by construction" title="Clients never share a database row" lede="Every piece of business data in AgentSDR belongs to exactly one organization, and every query is scoped to it. Fetching another organization's record is a 404, not a permission setting you remember to tick.">
        <div className="overflow-hidden rounded-3xl ring-1 ring-black/[0.07]">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">What is separate in each client organization</caption>
            <thead className="bg-[#f7f7f8] text-[12px] uppercase tracking-[0.06em] text-[#8a8a8a]">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium sm:px-8">Per client organization</th>
                <th scope="col" className="hidden px-5 py-3 font-medium sm:table-cell sm:px-8">What stays inside it</th>
              </tr>
            </thead>
            <tbody>
              {SEPARATE.map((row) => (
                <tr key={row.what} className="border-t border-black/[0.06] align-top">
                  <th scope="row" className="px-5 py-4 text-[15px] font-medium text-[#141414] sm:px-8">
                    {row.what}
                    <span className="mt-1 block text-[14px] font-normal leading-[22px] text-[#656565] sm:hidden">{row.detail}</span>
                  </th>
                  <td className="hidden px-5 py-4 leading-[22px] text-[#656565] sm:table-cell sm:px-8">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5 max-w-[46rem] text-[14px] leading-[22px] text-[#656565]">
          What you share is the server and the PostgreSQL database. Provider identities, such as a Unipile account or a Gmail mailbox, are unique across the deployment because inbound webhooks find their organization through them, so one account belongs to one client.
        </p>
      </Section>

      <Section id="clients" tone="grey" eyebrow="Working with clients" title="Invite client teammates, with the right role" lede="Teams group people but do not split data, so the organization is the boundary. Invite a client into theirs and they see their work and nothing of your other clients.">
        <FeatureSplit
          eyebrow="Invitations"
          accent={ACCENT.ai}
          title="They join one workspace, not your agency"
          body="Enter an email, pick owner, admin or member and send. The invitation works only for that address. People who belong to several organizations switch between them from the account menu, and the page reloads so nothing from the last one stays on screen."
          bullets={["Invitation emailed, valid for 7 days, or copy the link", "Admins can invite members and admins; only owners add owners", "The last owner cannot be demoted or removed"]}
          visual={<InviteCard />}
        />
        <div className="mt-8 overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.07]">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">What each role can do</caption>
            <thead className="bg-[#fafafa] text-[12px] uppercase tracking-[0.06em] text-[#8a8a8a]">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium sm:px-8">Ability</th>
                <th scope="col" className="px-3 py-3 text-center font-medium">Owner</th>
                <th scope="col" className="px-3 py-3 text-center font-medium">Admin</th>
                <th scope="col" className="px-3 py-3 text-center font-medium">Member</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.ability} className="border-t border-black/[0.06]">
                  <th scope="row" className="px-5 py-3.5 font-normal text-[#2b2b2b] sm:px-8">{r.ability}</th>
                  <td className="px-3 py-3.5 text-center"><Mark on={r.owner} /></td>
                  <td className="px-3 py-3.5 text-center"><Mark on={r.admin} /></td>
                  <td className="px-3 py-3.5 text-center"><Mark on={r.member} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="pacing" eyebrow="Per-client pacing" title="Each client&rsquo;s accounts, paced on their own" lede="A busy client cannot burn another client&rsquo;s mailboxes, because nothing is shared: not the limits, not the accounts, not the queue.">
        <FeatureSplit
          eyebrow="Sending rules"
          accent={ACCENT.email}
          title="Set the limits per client"
          body="Emails a day, gaps between sends, sending hours, LinkedIn invitations and WhatsApp warm-up are Sending rules for the organization. A LinkedIn account or WhatsApp number can override its organization's rule, and each mailbox has its own sending hours."
          bullets={["30 emails a day per mailbox by default, adjustable per client", "Hard limits and a warning past the safe edge", "LinkedIn and WhatsApp: account override, then rule, then default"]}
          visual={<SceneStage channel="email" index={1} accent={ACCENT.email} label="Mailbox sending limits and gaps. An illustration with sample data." />}
        />
        <FeatureSplit
          reverse
          eyebrow="One queue per client"
          accent={ACCENT.ai}
          title="Replies land in the client&rsquo;s own Action required"
          body="Each client&rsquo;s replies are classified and drafted by their own AI settings and knowledge base, and wait in their own queue. You work one client at a time, or let their team answer."
          bullets={["Classification categories and sequences per organization", "Knowledge base and instructions per client", "Do Not Contact scoped to the client’s organization"]}
          visual={<SceneStage channel="crm" index={1} accent={ACCENT.ai} label="An AI draft prepared for a reply. An illustration with sample data." />}
        />
      </Section>

      <Section tone="grey">
        <StatBand
          items={[
            { value: 1, label: "deployment for every client you run" },
            { value: 3, label: "roles: owner, admin and member" },
            { value: 7, suffix: " days", label: "an invitation stays valid" },
            { value: 0, prefix: "$", label: "per seat or per client; the software is free" },
          ]}
        />
      </Section>

      <Section id="onboard" eyebrow="Onboarding a client" title="From new client to first campaign" lede="The same four moves every time, each inside the client's own organization.">
        <Steps
          items={[
            { title: "Create the organization", body: "Account menu, Create organization. Give it a name and a URL name; you become its owner." },
            { title: "Connect their accounts", body: "Google Workspace mailboxes, Unipile for LinkedIn and WhatsApp, and an OpenRouter key, from the Settings pages." },
            { title: "Set their rules and invite them", body: "Adjust Sending rules for the client, then invite their team with owner, admin or member roles." },
            { title: "Import leads and launch", body: "Upload a list, write the sequences and start. Replies arrive in the client's own queue." },
          ]}
        />
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/solutions/sales-teams", "/product/email", "/product/lead-database", "/product/linkedin", "/open-source", "/compare/instantly"]} />

      <ClosingCta title="One deployment, every client in their own space" lede="Self-host AgentSDR, create an organization per client and keep their leads, inboxes and limits apart from day one." />
    </>
  );
}
