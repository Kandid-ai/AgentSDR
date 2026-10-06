import Link from "next/link";
import { GuideLayout, GUIDE_PUBLISHED } from "@/components/marketing/pages/resources/GuideLayout";
import { Callout, DataTable, H2 } from "@/components/marketing/pages/resources/Prose";
import { marketingMetadata } from "@/lib/marketing/seo";

const PATH = "/guides/linkedin-automation-limits";
const DESCRIPTION =
  "LinkedIn automation limits explained: how many connection requests and messages are safe, free vs Premium accounts, working hours, delays and what triggers restrictions.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "LinkedIn automation limits: what is safe",
  ogTitle: "LinkedIn automation limits",
  eyebrow: "Guide",
  description: DESCRIPTION,
  type: "article",
  publishedTime: GUIDE_PUBLISHED,
});

const TOC = [
  { id: "overview", label: "The short version" },
  { id: "the-rules", label: "What LinkedIn says" },
  { id: "invitations", label: "Invitations a day" },
  { id: "free-vs-premium", label: "Free vs Premium" },
  { id: "messages-and-searches", label: "Messages, profiles, searches" },
  { id: "timing", label: "Hours and delays" },
  { id: "triggers", label: "What triggers restrictions" },
  { id: "when-limited", label: "If an account is limited" },
  { id: "targeting", label: "Targeting and messaging" },
  { id: "in-agentsdr", label: "AgentSDR's defaults" },
  { id: "checklist", label: "Safe-pacing checklist" },
];

const FAQ = [
  {
    q: "Is LinkedIn automation allowed?",
    a: "No. LinkedIn's help centre says it does not permit third-party software, including bots, browser plug-ins and extensions, that automates activity, and that accounts using such tools risk being restricted or shut down. Any automation tool, AgentSDR included, carries that risk; careful pacing reduces it but cannot remove it.",
  },
  {
    q: "How many LinkedIn connection requests a day are safe?",
    a: "LinkedIn does not publish a safe number, and limits vary by account. Conservative practice is a few dozen a day at most for an established paid account and far fewer for a free one. AgentSDR defaults to 30 a day for Premium or Sales Navigator accounts and 5 a day for free accounts.",
  },
  {
    q: "Do free and Premium accounts have different limits?",
    a: "In practice yes. Free accounts have a much smaller invitation allowance, so AgentSDR keeps a separate, lower default for them (5 a day, warning above 10) and a higher one for Premium or Sales Navigator (30 a day, warning above 30).",
  },
  {
    q: "Should automation run outside working hours?",
    a: "It is safer not to. Activity around the clock is an automation signature. AgentSDR lets each account have its own working hours and does nothing for an account outside them.",
  },
  {
    q: "What does AgentSDR do when LinkedIn refuses an invitation?",
    a: "If LinkedIn or Unipile answers with a limit, quota or weekly-allowance error, AgentSDR stops that account for the day, marks it Limit reached, returns the lead to Pending, and resumes the account automatically after the daily reset.",
  },
  {
    q: "Does AgentSDR see my LinkedIn password?",
    a: "No. You sign in on Unipile's hosted page, including any captcha or verification code, and AgentSDR never sees your password. AgentSDR then works with the account through Unipile.",
  },
];

export default function Page() {
  return (
    <GuideLayout
      path={PATH}
      headline="LinkedIn automation limits: what is safe"
      description={DESCRIPTION}
      title="LinkedIn automation limits"
      lede="How many invitations and messages are sensible, how free and Premium accounts differ, when to send, and which behaviours get accounts restricted."
      readMinutes={10}
      toc={TOC}
      takeaways={[
        "LinkedIn does not permit automation tools. Pacing reduces the risk of a restricted account; nothing removes it.",
        "LinkedIn publishes no safe numbers. Go small, keep volume steady and let a free account send far less than a paid one.",
        "Look human: working hours only, small bursts, random delays and long rests between runs.",
        "Heavy searching and profile viewing get accounts limited as often as invitations do.",
        "AgentSDR defaults to 30 invitations a day for Premium and 5 for free accounts, in runs of 3 to 4, 30 to 60 seconds apart, and stops an account for the day when LinkedIn pushes back.",
      ]}
      faq={FAQ}
      related={["/product/linkedin", "/compare/heyreach", "/guides/cold-email-google-workspace", "/guides/whatsapp-b2b-outreach", "/solutions/sales-teams", "/solutions/agencies"]}
      closing={{ title: "Keep LinkedIn outreach modest and steady.", lede: "AgentSDR is open source, and its LinkedIn pacing is a set of Sending rules you can read, change and audit." }}
    >
      <H2 id="overview">The short version</H2>
      <p>
        LinkedIn is the channel where over-eager automation is punished most visibly: an account that gets restricted loses access to its network and its conversations, not just a campaign. The people who run LinkedIn outreach for a living converge on the same habits: small daily numbers, activity inside working hours, small bursts with real pauses, and a steady rhythm rather than spikes.
      </p>
      <p>
        There is one honest caveat to put first. LinkedIn does not allow automation, and no safe volume makes that untrue. This guide explains how to keep activity modest and what we know about what triggers restrictions, and it ends with how <Link href="/product/linkedin">AgentSDR&rsquo;s LinkedIn campaigns</Link> pace themselves. It is not a way to guarantee an account is safe, because nobody can.
      </p>

      <H2 id="the-rules">What LinkedIn says</H2>
      <p>
        LinkedIn&rsquo;s help centre states that it does not permit the use of third-party software, including crawlers, bots, browser plug-ins or browser extensions, that scrapes, modifies the appearance of, or automates activity on the platform. It lists using bots or other unauthorised automated methods to add or download contacts or to send or redirect messages as a violation, and says members who use these tools risk having their accounts restricted or shut down. Read it for yourself on LinkedIn&rsquo;s page,{" "}
        <a href="https://www.linkedin.com/help/linkedin/answer/a1341387" rel="noopener noreferrer" target="_blank">
          Prohibited software and extensions
        </a>
        .
      </p>
      <Callout tone="warn" title="The decision is yours">
        <p>Using any automation on LinkedIn is a risk you take on with your own account. Use an account you can afford to have restricted, never one that your whole pipeline depends on, and read AgentSDR&rsquo;s own responsible use page before connecting one.</p>
      </Callout>
      <p>
        LinkedIn does not publish the thresholds its systems use, and they change over time. Treat every number you see online, including numbers in this guide, as a conservative starting point to be tested against your own account, not as a guaranteed allowance.
      </p>

      <H2 id="invitations">Invitations a day</H2>
      <p>
        Connection requests are the activity LinkedIn watches most closely, because they are what spammers do. Three habits keep that activity looking ordinary:
      </p>
      <ul>
        <li>
          <strong>A low daily ceiling.</strong> Think in tens, not hundreds. A person working through their own prospect list by hand might send a few dozen requests on a busy day.
        </li>
        <li>
          <strong>Relevance.</strong> Requests that are ignored or marked &ldquo;I don&rsquo;t know this person&rdquo; hurt an account more than the raw count does. Target tightly.
        </li>
        <li>
          <strong>A short or empty note.</strong> A connection note is capped at 300 characters. Many people send the request with no note and put the pitch in the first message after acceptance.
        </li>
      </ul>
      <p>
        An <strong>acceptance rate</strong> that stays healthy is the best sign you are targeting well. If it falls and you keep sending, you are teaching the platform that your requests are unwelcome.
      </p>

      <H2 id="free-vs-premium">Free vs Premium</H2>
      <p>
        Free accounts get a considerably smaller invitation allowance than paid ones, and LinkedIn may count it weekly rather than daily. Premium and Sales Navigator accounts have more room, but more room is not a licence to fill it. The practical advice is to size daily volume to the account type and never copy a number meant for one onto the other.
      </p>
      <DataTable caption="Pacing by account type, general practice">
        <thead>
          <tr>
            <th>Account</th>
            <th>Sensible approach</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Free</td>
            <td>Very few invitations a day; the weekly allowance runs out fast. Spread them out.</td>
          </tr>
          <tr>
            <td>Premium or Sales Navigator</td>
            <td>A few dozen a day at most, in small runs, with the pacing below.</td>
          </tr>
          <tr>
            <td>Brand new or recently restored account</td>
            <td>Start lower than you would for an established one and raise it slowly.</td>
          </tr>
        </tbody>
      </DataTable>

      <H2 id="messages-and-searches">Messages, profile views and searches</H2>
      <p>
        Invitations get the attention, but the other actions count too.
      </p>
      <h3 id="messages">Follow-up messages</h3>
      <p>
        Messages to people who accepted look more natural than invitations, but a burst of identical messages sent within seconds does not. Send them in small groups, vary the wording, and keep sequences short: an acceptance message and two or three spaced follow-ups is plenty. Stop the moment someone replies.
      </p>
      <h3 id="profile-views">Profile views</h3>
      <p>
        Opening a profile is how a tool finds the person behind a lead, and viewing many profiles quickly is a known way to trip limits. Keep lookups to a handful per run.
      </p>
      <h3 id="searches">Searches</h3>
      <p>
        Pulling leads from LinkedIn search results is the other activity that gets accounts limited, and heavy searching is one of the faster ways to have an account restricted. Cap how many leads you pull a day and consider building lists elsewhere and importing them.
      </p>

      <H2 id="timing">Hours and delays</H2>
      <h3 id="working-hours">Working hours</h3>
      <p>
        A real member is active in the daytime of their own time zone. An account that sends invitations at 3 a.m. or on every day of the week looks different. Restrict automation to the account owner&rsquo;s working hours and working days.
      </p>
      <h3 id="delays">Randomised delays</h3>
      <p>
        Fixed intervals are a signature. Use a random wait between invitations, measured in tens of seconds, and a longer random rest between small runs. The pattern you are imitating is a person who sits down, sends a few requests, and goes back to other work.
      </p>
      <h3 id="runs">Runs, not floods</h3>
      <p>
        Dividing a day&rsquo;s volume into many small runs spreads activity through the day. Three or four invitations per run with half an hour or more between runs sends the same total as one big burst without looking like one.
      </p>

      <H2 id="triggers">What triggers restrictions</H2>
      <p>No one outside LinkedIn knows the exact rules, but these behaviours are consistently reported to put accounts at risk:</p>
      <ul>
        <li>Sending far more invitations than the account normally does, or suddenly changing volume.</li>
        <li>Many invitations ignored, withdrawn, or reported as unknown.</li>
        <li>Large bursts of actions in a few minutes, or actions at perfectly even intervals.</li>
        <li>Activity at all hours and on all days.</li>
        <li>Heavy searching and profile viewing.</li>
        <li>Identical messages sent to many people.</li>
        <li>Running the account from several tools or locations at once, which can force sign-outs and verification prompts.</li>
      </ul>

      <H2 id="when-limited">If an account is limited</H2>
      <p>
        LinkedIn usually warns before it restricts: a message that you have reached a limit, a verification prompt, or a temporary block. Stop outreach immediately, do not try to push past the warning, and resume at a lower volume after a break. A formal restriction can require identity verification or an appeal, and a permanent ban cannot always be reversed.
      </p>

      <H2 id="targeting">Targeting and messaging matter as much as volume</H2>
      <p>
        Volume limits are only half of account safety. LinkedIn&rsquo;s systems, and the people you contact, react to how welcome your activity is. Two accounts can send the same number of invitations and have very different outcomes, because one wrote to people who wanted to hear from it and the other did not.
      </p>
      <h3 id="targeting-tight">Target narrowly</h3>
      <p>
        A tight list, with a clear reason you are writing to each person, produces more acceptances and fewer reports. Before importing, ask what you would say if the person asked how you chose them. If you have no answer, remove them.
      </p>
      <h3 id="first-message">Make the first message earn a reply</h3>
      <p>
        The first message after acceptance should be short and specific: one sentence on why you connected and one easy question. Avoid pitching the product in the connection note. Pasting a long sales pitch to a stranger is the quickest way to get a request marked as unwanted.
      </p>
      <h3 id="several-accounts">Several accounts, not one overworked one</h3>
      <p>
        Agencies and teams often spread volume across several accounts, each belonging to a real person who is the sender. That keeps each account&rsquo;s numbers modest. It does not make borrowed or fake profiles acceptable: use accounts that belong to the people they represent, with their consent, and never create fake identities.
      </p>
      <h3 id="measure">Measure the right things</h3>
      <p>
        Track acceptance rate, reply rate and the number of warnings an account has received, not just invitations sent. When acceptance falls, fix targeting before raising volume.
      </p>

      <H2 id="in-agentsdr">AgentSDR&rsquo;s defaults</H2>
      <p>
        AgentSDR connects LinkedIn accounts through Unipile: you sign in on Unipile&rsquo;s hosted page, so AgentSDR never sees your password. Pacing is a set of organization-wide <strong>Sending rules</strong>, declared once in the code with a default, hard limits and a &ldquo;safe edge&rdquo; past which the settings page shows a warning but still saves.
      </p>
      <DataTable caption="AgentSDR LinkedIn sending rules">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Default</th>
            <th>Allowed range</th>
            <th>Warns</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Invitations a day, Premium or Sales Navigator</td>
            <td>30</td>
            <td>1 to 100</td>
            <td>Above 30</td>
          </tr>
          <tr>
            <td>Invitations a day, free</td>
            <td>5</td>
            <td>1 to 50</td>
            <td>Above 10</td>
          </tr>
          <tr>
            <td>Invitations per run</td>
            <td>3 to 4</td>
            <td>1 to 20</td>
            <td>Above 8</td>
          </tr>
          <tr>
            <td>Delay between invitations</td>
            <td>30 to 60 seconds</td>
            <td>5 to 600 seconds</td>
            <td>Below 20 seconds</td>
          </tr>
          <tr>
            <td>Rest between runs</td>
            <td>30 to 60 minutes</td>
            <td>10 to 720 minutes</td>
            <td>Below 20 minutes</td>
          </tr>
          <tr>
            <td>Follow-up messages per run</td>
            <td>3 to 6</td>
            <td>1 to 30</td>
            <td>Above 10</td>
          </tr>
          <tr>
            <td>Profile lookups per run</td>
            <td>4 to 8</td>
            <td>1 to 40</td>
            <td>Above 15</td>
          </tr>
          <tr>
            <td>Search leads a day, per account</td>
            <td>400</td>
            <td>10 to 2,500</td>
            <td>Above 1,000</td>
          </tr>
        </tbody>
      </DataTable>
      <p>
        Each account can override its daily invitation limit and set its own working hours (timezone, start, end and days); an account&rsquo;s own hours always win over the organization rule, and the engine does nothing for an account outside them. With no hours set, accounts work whenever campaigns are due.
      </p>
      <h3 id="how-the-engine-runs">How a run works</h3>
      <ol>
        <li>Look up profiles for imported leads, a few at a time.</li>
        <li>Send a small batch of connection requests, within the account&rsquo;s daily limit.</li>
        <li>Send acceptance messages and due follow-ups, a few at a time.</li>
        <li>Rest a random time before the next pass.</li>
      </ol>
      <p>
        A sequence has up to five messages, all optional: a connection request of up to 300 characters, an acceptance message sent when the acceptance is detected, then follow-ups one, two and three days apart. A request whose merged text exceeds 300 characters is marked Failed, not truncated, and Preview warns when a rendered invitation is too long. A reply on any channel stops automated messages to that lead.
      </p>
      <h3 id="guard-rails">Guard rails</h3>
      <ul>
        <li>Each request or message is claimed in the database before it is sent, so a step is never sent twice to the same lead.</li>
        <li>A person already contacted by an account is not invited again by it.</li>
        <li>Do Not Contact leads are skipped, and this is checked again right before sending.</li>
        <li>If a connection request fails for a reason other than a limit, AgentSDR does not retry automatically, because LinkedIn may have accepted it and a retry could send a duplicate.</li>
      </ul>
      <Callout tone="agentsdr" title="When LinkedIn pushes back">
        <p>If LinkedIn or Unipile refuses an invitation with a limit, quota or weekly-allowance error, AgentSDR stops that account for the day. Its status becomes Limit reached, the lead returns to Pending so another account or the next day can send it, and the daily reset clears the flag. If it happens often, lower the daily limit.</p>
      </Callout>
      <p>
        These defaults reduce risk; they do not remove it. AgentSDR&rsquo;s responsible use page says so plainly, and so do we.
      </p>

      <H2 id="checklist">Safe-pacing checklist</H2>
      <ol>
        <li>Use an account whose loss you can absorb, and keep its profile complete and honest.</li>
        <li>Set the daily invitation limit by account type, and start lower than the maximum.</li>
        <li>Restrict activity to the owner&rsquo;s working hours and days.</li>
        <li>Keep runs small, delays random and rests long.</li>
        <li>Cap searches and profile lookups.</li>
        <li>Target tightly and keep an eye on the acceptance rate.</li>
        <li>Stop at the first warning from LinkedIn and resume lower.</li>
        <li>Do not run the same account from several tools at once.</li>
      </ol>
    </GuideLayout>
  );
}
