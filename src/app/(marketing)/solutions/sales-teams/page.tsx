import { RiBarChartBoxLine, RiContactsBook3Line, RiForbidLine, RiGroupLine, RiInbox2Line, RiKey2Line, RiShieldUserLine, RiTeamLine, RiUserSettingsLine } from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureGrid, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section, Steps } from "@/components/marketing/blocks";
import { ACCENT } from "@/components/marketing/catalog";
import { ProductShot, SceneStage } from "@/components/marketing/live";
import { LimitStack } from "@/components/marketing/pages/solutions/LimitStack";
import { TeamBoard } from "@/components/marketing/pages/solutions/TeamBoard";
import { marketingMetadata } from "@/lib/marketing/seo";

const PATH = "/solutions/sales-teams";

export const metadata = marketingMetadata({
  path: PATH,
  title: "Open-source sales engagement platform for teams",
  ogTitle: "A sales engagement platform for teams",
  eyebrow: "Sales teams",
  description: "Open-source sales engagement platform for teams: per-rep mailboxes, LinkedIn and WhatsApp accounts, one shared pipeline and reply queue, roles and limits.",
});

const FAQ = [
  {
    q: "Can each rep use their own mailbox, LinkedIn and WhatsApp account?",
    a: "Yes. Mailboxes are added by address, LinkedIn and WhatsApp accounts are linked in Unipile and synced in, and each account has its own status and limits. Campaigns send from whichever accounts you choose, and replies show which account they came through.",
  },
  {
    q: "What can members, admins and owners do?",
    a: "Everyone can use leads, campaigns, the CRM and Analytics. Owners and admins also connect integrations, change AI settings and sending rules, invite people and manage teams. Only owners can promote someone to owner or change an owner.",
  },
  {
    q: "Do teams limit what a rep can see?",
    a: "No. Teams group people, for example Outbound or Account executives, but everyone in an organization sees the same leads, campaigns and conversations. If two groups must not see each other's data, run them as separate organizations.",
  },
  {
    q: "How do per-account limits work with the organization's sending rules?",
    a: "A limit resolves in order: the account's own override, then the organization's rule, then the built-in default. Overrides exist for a LinkedIn account's daily invitations and a WhatsApp number's new chats a day. A mailbox takes its daily limit from the organization rule when it is added, and has its own sending hours. Only owners and admins can change rules.",
  },
  {
    q: "Is there a shared pipeline and reply queue?",
    a: "Yes. The organization has one default CRM pipeline, and Action required lists every reply, AI draft, follow-up and error waiting on a person, across email, LinkedIn and WhatsApp. Replies are classified by the AI, and nothing is sent until someone approves it.",
  },
  {
    q: "How much does it cost per seat?",
    a: "Nothing. AgentSDR is open source under the AGPL-3.0 and you host it yourself, so there are no per-seat or per-contact fees. You pay for your server, the accounts you connect and your own AI usage.",
  },
];

const ROLES = [
  { role: "Owner", tone: "#335cff", items: ["Everything an admin can do", "Promote someone to owner", "Change or remove an owner", "The last owner cannot be demoted or removed"] },
  { role: "Admin", tone: "#7d52f4", items: ["Connect and edit integrations", "Change AI settings and sending rules", "Invite people and change roles", "Create and manage teams"] },
  { role: "Member", tone: "#0b8a7a", items: ["Use leads, campaigns and the CRM", "Work Action required and Analytics", "See the same data as everyone else", "See sending rules and settings, read-only"] },
];

export default function SalesTeamsPage() {
  return (
    <>
      <PageHero
        path={PATH}
        crumb="Sales teams"
        eyebrow="For sales teams"
        eyebrowIcon={RiTeamLine}
        title="The open-source sales engagement platform for teams"
        lede="Every rep sends from their own mailbox, LinkedIn account and WhatsApp number. Every reply lands in one shared queue, in one pipeline, with limits that protect each account separately."
      >
        <HeroFrame>
          <TeamBoard />
        </HeroFrame>
      </PageHero>

      <Section id="team" eyebrow="How a team works" title="Individual accounts, shared work" lede="Reps keep their own sender identity. The leads, the pipeline and the queue belong to the whole organization.">
        <FeatureGrid
          items={[
            { icon: RiUserSettingsLine, title: "Owner, admin and member roles", body: "Roles control what a person can change: integrations, AI, rules, people. Everyone can use the product." },
            { icon: RiGroupLine, title: "Teams to group reps", body: "Outbound, Account executives or any grouping you like. Teams organise people; they do not split the data." },
            { icon: RiKey2Line, title: "Per-rep accounts", body: "Mailboxes, LinkedIn accounts and WhatsApp numbers, each with its own status and working hours, and its own daily limit on LinkedIn and WhatsApp." },
            { icon: RiContactsBook3Line, title: "One lead database", body: "A person is one record across channels, so two reps never write to the same lead from different tools." },
            { icon: RiInbox2Line, title: "One Action required queue", body: "Replies from every rep's accounts, classified and drafted, in a single list you can filter by channel." },
            { icon: RiForbidLine, title: "Do Not Contact for everyone", body: "One flag stops email, LinkedIn and WhatsApp, and it is re-checked before each send." },
          ]}
        />
      </Section>

      <Section id="accounts" tone="grey" eyebrow="Per-rep accounts" title="Pace every account on its own" lede="One rep&rsquo;s LinkedIn limit is not another rep&rsquo;s. Limits live on the account, with organization rules behind them.">
        <FeatureSplit
          eyebrow="Account limits"
          accent={ACCENT.linkedin}
          title="Account limit, then organization rule, then default"
          body="Set the Sending rules once for the organization. When one account needs less, or more, give it its own limit and it replaces the rule for that account only."
          bullets={["A mailbox's own sending hours", "A LinkedIn account's own daily invitations", "A WhatsApp number's own new chats a day"]}
          visual={<LimitStack />}
        />
        <FeatureSplit
          reverse
          eyebrow="LinkedIn"
          accent={ACCENT.linkedin}
          title="Runs, gaps and rests, per account"
          body="Each LinkedIn account sends in short runs with random delays between invitations and a rest between runs, inside its own working hours. Premium and free accounts get different daily defaults."
          bullets={["30 invitations a day on Premium or Sales Navigator, 5 on free", "A random 30 to 60 second delay between invitations", "Several accounts working one campaign"]}
          visual={<SceneStage channel="linkedin" index={1} accent={ACCENT.linkedin} label="A LinkedIn account sending invitations in paced runs. An illustration with sample data." />}
        />
      </Section>

      <Section id="roles" eyebrow="Roles" title="Who can change what" lede="Roles never change what a person can see, because everyone in an organization sees the same leads, campaigns and conversations. They decide who can connect services, change rules and manage people.">
        <div className="grid gap-4 lg:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.role} className="rounded-3xl bg-[#f7f7f8] p-6 ring-1 ring-black/[0.05] sm:p-7">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: r.tone }}>
                <RiShieldUserLine className="size-4" aria-hidden="true" />
                {r.role}
              </span>
              <ul className="mt-4 grid gap-2.5">
                {r.items.map((i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-[22px] text-[#2b2b2b]">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: r.tone }} />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id="pipeline" tone="grey" eyebrow="Shared pipeline" title="One queue, one pipeline, one scoreboard" lede="Whoever&rsquo;s account a lead answered on, the reply reaches the same Action required queue and moves the same pipeline.">
        <FeatureSplit
          eyebrow="Action required"
          accent={ACCENT.ai}
          title="Every rep&rsquo;s replies, classified and drafted"
          body="The AI puts each reply in a category, records its confidence and drafts an answer from your instructions and knowledge base. Anyone on the team can review and send; nothing goes out unapproved."
          bullets={["Filter by channel, category, due time or sequence", "Drafts go out from the account the conversation is on", "Reply sequences wait for a person's approval"]}
          visual={<SceneStage channel="crm" index={2} accent={ACCENT.ai} label="A CRM reply sequence assigned to a category. An illustration with sample data." />}
        />
        <div className="mt-8">
          <div className="mb-5 flex items-center gap-2 text-[14px] text-[#656565]">
            <RiBarChartBoxLine className="size-4 text-[#335cff]" aria-hidden="true" />
            Analytics shows replies, meetings and customers by channel, for the whole organization.
          </div>
          <ProductShot screen="analytics" height="h-[420px] sm:h-[500px]" />
        </div>
      </Section>

      <Section id="rollout" eyebrow="Rolling it out" title="From first admin to a working team">
        <Steps
          items={[
            { title: "Run it and create the organization", body: "The first account creates the organization and becomes its owner." },
            { title: "Invite reps", body: "Settings, Members: send an invitation with a role, valid for 7 days. Group reps into teams if it helps." },
            { title: "Connect accounts", body: "Each rep's mailbox, LinkedIn account and WhatsApp number, with its own LinkedIn or WhatsApp limit where it needs one." },
            { title: "Launch and share the queue", body: "Campaigns send from the accounts you choose, and every reply lands in the shared Action required." },
          ]}
        />
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/solutions/agencies", "/product/ai-crm", "/product/inbox", "/product/analytics", "/open-source", "/compare/heyreach"]} />

      <ClosingCta title="Give every rep an account, and the team one queue" lede="Self-host AgentSDR, invite your reps and keep each account inside its own limits. No seats, no per-contact fees." />
    </>
  );
}
