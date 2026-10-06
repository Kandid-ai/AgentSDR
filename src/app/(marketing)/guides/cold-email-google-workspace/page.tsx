import Link from "next/link";
import { GuideLayout, GUIDE_PUBLISHED } from "@/components/marketing/pages/resources/GuideLayout";
import { Callout, DataTable, H2 } from "@/components/marketing/pages/resources/Prose";
import { marketingMetadata } from "@/lib/marketing/seo";

const PATH = "/guides/cold-email-google-workspace";
const DESCRIPTION =
  "How to send cold email from Google Workspace without burning your domain: mailbox setup, SPF, DKIM and DMARC, safe daily volumes, send gaps, bounces and list hygiene.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "Cold email from Google Workspace: a safe setup",
  ogTitle: "Cold email from Google Workspace",
  eyebrow: "Guide",
  description: DESCRIPTION,
  type: "article",
  publishedTime: GUIDE_PUBLISHED,
});

const TOC = [
  { id: "overview", label: "The short version" },
  { id: "domains-and-mailboxes", label: "Domains and mailboxes" },
  { id: "authentication", label: "SPF, DKIM and DMARC" },
  { id: "volume", label: "Daily volume and gaps" },
  { id: "warm-sending", label: "Warm sending patterns" },
  { id: "copy-and-lists", label: "Copy and list hygiene" },
  { id: "bounces-unsubscribes", label: "Bounces and unsubscribes" },
  { id: "the-law", label: "Rules to follow" },
  { id: "in-agentsdr", label: "How AgentSDR implements it" },
  { id: "checklist", label: "Launch checklist" },
];

const FAQ = [
  {
    q: "How many cold emails can I send a day from Google Workspace?",
    a: "Google documents an overall ceiling of 2,000 messages a day per paid Workspace user, but that is a platform limit, not a safe cold-email volume. Deliverability usually suffers long before it. AgentSDR defaults to 30 a day per mailbox and warns above about 50.",
  },
  {
    q: "Do I need SPF, DKIM and DMARC for cold email?",
    a: "Yes. Google requires SPF or DKIM for every sender to Gmail, and SPF, DKIM and DMARC for senders of 5,000 or more messages a day. Even below that threshold, all three are the baseline that receiving servers expect from a legitimate domain.",
  },
  {
    q: "Should I send cold email from my main company domain?",
    a: "Many teams use a separate, similar-looking domain so a deliverability problem cannot touch the mail their staff and customers rely on. It is a trade-off: a new domain has no reputation and needs a careful, slow start. Whichever you choose, authenticate it and keep volumes low.",
  },
  {
    q: "How long should I wait between cold emails from one mailbox?",
    a: "Spread sends out and randomise the gap rather than sending in bursts. AgentSDR waits a random 18 to 24 minutes between emails from the same mailbox by default and warns below 10 minutes.",
  },
  {
    q: "What happens when someone unsubscribes or an address bounces?",
    a: "The address should be suppressed so it is never mailed again. In AgentSDR, unsubscribes and hard bounces add the address to a suppression list that applies to every campaign in your organization, and a temporary delay notice does not suppress anyone.",
  },
  {
    q: "Does AgentSDR set up SPF, DKIM and DMARC for me?",
    a: "No. Those are DNS records on your domain, set up with your DNS host and Google Workspace admin. AgentSDR sends through your Workspace mailboxes, so they use whatever authentication your domain has.",
  },
];

export default function Page() {
  return (
    <GuideLayout
      path={PATH}
      crumb="Cold email from Google Workspace"
      headline="Cold email from Google Workspace: a safe setup"
      description={DESCRIPTION}
      title="Cold email from Google Workspace"
      lede="A practical guide to sending outbound email from Workspace mailboxes: how to set them up, how much to send, what to authenticate, and how to keep a list clean."
      readMinutes={11}
      toc={TOC}
      takeaways={[
        "Cold email lives or dies on sender reputation. Send small volumes, spread through the working day, from authenticated mailboxes.",
        "Set up SPF, DKIM and DMARC before the first send. Google requires at least SPF or DKIM from everyone and all three from large senders.",
        "Start new mailboxes at a handful of emails a day and raise volume slowly while watching bounces and replies.",
        "Honour every unsubscribe and bounce immediately, across all campaigns. A clean list protects every mailbox you own.",
        "AgentSDR defaults to 30 emails a day per mailbox, 18 to 24 minutes apart, inside working hours, and stops a lead when they reply, bounce or unsubscribe.",
      ]}
      faq={FAQ}
      related={["/product/email", "/product/inbox", "/guides/linkedin-automation-limits", "/guides/whatsapp-b2b-outreach", "/solutions/founders", "/compare/instantly"]}
      closing={{ title: "Send like a careful human, at scale.", lede: "AgentSDR is open source and runs on your own Google Workspace mailboxes. Self-host it and keep the safe defaults." }}
    >
      <H2 id="overview">The short version</H2>
      <p>
        Cold email works when a real person at a real company receives a relevant, low-volume message from a mailbox that mail providers trust. It fails when a domain sends too much, too fast, to a list nobody checked. Almost every piece of advice in this guide comes down to one idea: protect the reputation of the domain and mailboxes you send from, because they are slow to build and quick to damage.
      </p>
      <p>
        Google Workspace is a good place to send from. You get real Gmail mailboxes, your own domain, admin controls and a sending infrastructure with a long track record. It does not make you immune to spam filtering. The same filters that judge any sender judge you, and they care about authentication, complaint rates, bounce rates and how your sending pattern looks over time.
      </p>
      <p>
        This guide covers general practice first and then, at the end, how <Link href="/product/email">AgentSDR&rsquo;s email sequences</Link> put it into defaults. Where we cite a provider rule, we link to the provider&rsquo;s own documentation. Where we describe common practice, we say so; nobody outside the providers publishes exact thresholds, and they change.
      </p>

      <H2 id="domains-and-mailboxes">Domains and mailboxes</H2>
      <h3 id="which-domain">Which domain to send from</h3>
      <p>
        Sending cold email from your primary company domain puts that domain&rsquo;s reputation at risk. If complaints pile up, the mail your team sends to customers can start landing in spam too. To avoid that, many outbound teams buy one or more secondary domains, close to the brand name, and send prospecting mail from those. The website on the secondary domain simply redirects to the main site.
      </p>
      <p>
        The cost is a cold start. A brand new domain has no sending history, so it needs a slow ramp (covered below). A domain that is a few months old and has sent small, well-received volumes is worth more than a fresh one. There is no universal right answer: a founder emailing 20 hand-picked prospects a day from their own address has a very different risk from a team emailing thousands a week.
      </p>
      <h3 id="how-many-mailboxes">How many mailboxes</h3>
      <p>
        Volume per mailbox should stay modest, so volume overall comes from having more mailboxes rather than pushing each one harder. Two or three mailboxes per sending domain, each with a real display name and a plausible role, is a common pattern. Each mailbox should be a genuine Workspace user with a profile picture and a signature, and ideally one that also sends and receives ordinary email.
      </p>
      <Callout tone="warn" title="Do not buy reputation shortcuts">
        <p>Mailbox resellers and &ldquo;unlimited&rdquo; sending plans move risk, they do not remove it. If a sender is cut off by a mail provider, every mailbox on the same domain suffers with it.</p>
      </Callout>

      <H2 id="authentication">SPF, DKIM and DMARC</H2>
      <p>These three DNS records tell receiving servers that your domain authorised the mail they are looking at. Set them up before the first send, not after the first bounce.</p>
      <ul>
        <li>
          <strong>SPF</strong> lists the servers allowed to send mail for your domain. For Google Workspace, the record includes Google&rsquo;s servers. You publish one SPF record per domain, as a TXT record.
        </li>
        <li>
          <strong>DKIM</strong> signs each message with a key so the receiver can check it was not altered and really came from your domain. You generate the key in the Google Admin console and publish its public half as a DNS record, then turn signing on.
        </li>
        <li>
          <strong>DMARC</strong> tells receivers what to do when SPF or DKIM fail for your domain, and where to send reports. A sensible start is a monitoring policy that reports without rejecting, tightened once the reports look clean.
        </li>
      </ul>
      <p>
        Google&rsquo;s sender guidelines make this concrete. From February 2024 every sender to Gmail must set up SPF or DKIM, keep spam rates reported in Postmaster Tools below 0.3%, and meet basic technical requirements such as TLS and valid forward and reverse DNS. Senders of 5,000 or more messages a day to Gmail addresses must also set up SPF, DKIM and DMARC, align the From domain with SPF or DKIM, and support one-click unsubscribe for marketing and subscribed mail. The full text is in Google&rsquo;s{" "}
        <a href="https://support.google.com/a/answer/81126" rel="noopener noreferrer" target="_blank">
          email sender guidelines
        </a>
        .
      </p>
      <p>
        A cold-email programme should sit well below 5,000 messages a day, but that is no reason to skip DMARC. Treat the bulk-sender list as the standard to meet, not the line to stay under. Check your setup with a test message to a Gmail address and look at <em>Show original</em>: it reports SPF, DKIM and DMARC as pass or fail.
      </p>
      <Callout tone="note" title="Postmaster Tools">
        <p>Register your sending domain in Google Postmaster Tools. It shows the spam rate Google measures for your domain and is the clearest early warning that something is wrong. Data only appears once a domain sends enough mail to Gmail users.</p>
      </Callout>

      <H2 id="volume">Daily volume and gaps</H2>
      <p>
        Google documents a hard ceiling for paid Workspace accounts of 2,000 messages a day per user, with lower caps for mail merge and trial accounts (see{" "}
        <a href="https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace" rel="noopener noreferrer" target="_blank">
          Gmail sending limits in Google Workspace
        </a>
        ). Hit a limit and the user cannot send for up to 24 hours. That ceiling is about abuse prevention. It says nothing about what is safe for cold email, where filters judge the pattern, not the count.
      </p>
      <p>
        There is no published safe number. Common practice among careful senders is a few dozen cold emails a day per mailbox once it is established, and far fewer for a new one. AgentSDR&rsquo;s own guidance is that deliverability usually drops above about 50 a day from one Workspace mailbox. Treat figures like these as conservative starting points and adjust to your own bounce and reply data.
      </p>
      <h3 id="gaps">Randomise the gap between sends</h3>
      <p>
        A human does not send an email every exactly 60 seconds. Sending in bursts, or on a fixed timer, is one of the clearest automation signatures. The better pattern is a random wait between emails from the same mailbox, measured in minutes, inside the recipient&rsquo;s working hours. If a mailbox sends 30 emails with 18 to 24 minutes between them, that is a bit over nine hours of spread-out activity.
      </p>
      <h3 id="hours">Send inside working hours</h3>
      <p>
        Mail that arrives at 3 a.m. looks automated and gets read later, if at all. Pick sending hours in the time zone of the mailbox, weekdays only unless your market differs, and let anything that comes due outside the window wait for the next open slot.
      </p>
      <DataTable caption="Typical safe-side pacing for cold email">
        <thead>
          <tr>
            <th>Setting</th>
            <th>Careful starting point</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Emails per day, new mailbox</td>
            <td>A handful, rising over weeks</td>
            <td>No history to judge you by yet</td>
          </tr>
          <tr>
            <td>Emails per day, established mailbox</td>
            <td>A few dozen at most</td>
            <td>Keeps complaint and bounce counts small</td>
          </tr>
          <tr>
            <td>Gap between emails</td>
            <td>Random, in minutes</td>
            <td>Avoids a fixed-interval pattern</td>
          </tr>
          <tr>
            <td>Sending window</td>
            <td>Weekday working hours</td>
            <td>Matches how real people send and read</td>
          </tr>
        </tbody>
      </DataTable>
      <p>This table is general practice, not a provider rule. Use it to pick a cautious start, then let your own results decide.</p>

      <H2 id="warm-sending">Warm sending patterns</H2>
      <p>
        A new mailbox on a new domain is an unknown. Receiving servers have no history to trust, so the first weeks set your reputation. The pattern that tends to work is gradual:
      </p>
      <ol>
        <li>Use the mailbox for ordinary email first: real conversations with colleagues and friendly contacts who will reply.</li>
        <li>Begin outbound with a tiny daily count, to the most relevant prospects on your list, with the best-targeted copy.</li>
        <li>Raise the daily count in small steps, only while bounces stay low and replies keep arriving.</li>
        <li>Stop raising it when results flatten. More mailboxes beat a bigger number on one.</li>
      </ol>
      <p>
        Be sceptical of anything that promises to &ldquo;warm up&rdquo; a mailbox by exchanging automated mail with a network of other accounts. Artificial engagement is exactly the sort of pattern providers look for, and it teaches you nothing about how real prospects respond. Real replies from real recipients are the signal that matters.
      </p>
      <p>
        Warm sending also means steady sending. A mailbox that sends 30 a day for a week, goes quiet, and then sends 150 in an afternoon looks irregular. Keep volume smooth, and pause rather than spike when you are not ready.
      </p>

      <H2 id="copy-and-lists">Copy and list hygiene</H2>
      <h3 id="list-hygiene">Start with a list worth sending to</h3>
      <p>
        The biggest lever on deliverability is not a setting, it is who you email. Every invalid address bounces, and a high bounce rate is a strong sign of a purchased or stale list. Before you send:
      </p>
      <ul>
        <li>Verify addresses, especially anything older than a few months or bought in bulk.</li>
        <li>Remove role addresses such as info@ and sales@ unless you have a reason to write to them.</li>
        <li>Deduplicate, so one person never receives the same step twice.</li>
        <li>Exclude existing customers, open opportunities and anyone who has asked not to be contacted.</li>
      </ul>
      <h3 id="copy">Write like one person to one person</h3>
      <p>
        Plain-text style messages, short and specific, tend to outperform formatted newsletters in cold outreach. Avoid heavy images, many links and tracking-heavy layouts. Personalise the opening with something true about the prospect and avoid identical copy across a whole list: varying phrasing means no two emails are byte-for-byte the same.
      </p>
      <p>
        Merge fields are the usual way to personalise at volume, and they carry one trap: an empty field produces awkward text such as &ldquo;Hi ,&rdquo;. Preview a few real leads before launch, including ones with missing data.
      </p>
      <h3 id="follow-ups">Follow-ups</h3>
      <p>
        Most replies to a cold sequence come after a follow-up, so a short sequence with sensible waits, typically a few days apart, is standard. Keep follow-ups in the same thread as the first email so they read as a continuing conversation, and stop the moment someone replies, whichever channel they use.
      </p>

      <H2 id="bounces-unsubscribes">Bounces and unsubscribes</H2>
      <p>
        Two categories of failure need different handling. A <strong>hard bounce</strong> means the address does not exist or refuses mail permanently. Suppress it at once and never send to it again. A <strong>soft bounce</strong> or delay notice means delivery was postponed, for example by a full inbox. Retrying later can succeed, so these should not suppress anyone on the first notice.
      </p>
      <p>
        Unsubscribes should be easy and honoured everywhere. Include a clear unsubscribe link in the body and the <code>List-Unsubscribe</code> headers that let Gmail and Outlook show their own unsubscribe button. For marketing and subscribed mail, Google&rsquo;s bulk-sender rules require one-click unsubscribe, and it is a good habit for cold email at any volume because an unsubscribe is far better for you than a spam report. Spam complaints, not unsubscribes, are what push the rate Google measures towards its 0.3% threshold.
      </p>
      <p>
        Keep one suppression list for the whole organization, not one per campaign. Someone who opted out of your Q3 campaign should not be in your Q4 import.
      </p>

      <H2 id="the-law">Rules to follow</H2>
      <p>
        Cold email is regulated differently by country. In the United States, CAN-SPAM requires truthful sender identification, a working opt-out, a physical address and prompt honouring of opt-outs. The European Union and United Kingdom apply GDPR and ePrivacy rules (PECR in the UK), which in many cases require a lawful basis and prior consent to email individuals. Canada&rsquo;s CASL generally requires consent for commercial email. Rules for business addresses differ from those for personal ones in some places. This is not legal advice: ask a lawyer who knows the countries you sell into. AgentSDR&rsquo;s{" "}
        <a href="https://github.com/Kandid-ai/AgentSDR/blob/main/docs/responsible-use.md" rel="noopener noreferrer" target="_blank">
          responsible use page
        </a>{" "}
        covers the same ground.
      </p>

      <H2 id="in-agentsdr">How AgentSDR implements it</H2>
      <p>
        <Link href="/product/email">AgentSDR&rsquo;s email sequences</Link> send through Google Workspace mailboxes you connect with a service account (domain-wide delegation). Each rule below is a default in the product, and the numbers are the organization&rsquo;s <strong>Sending rules</strong>.
      </p>
      <DataTable caption="AgentSDR email defaults">
        <thead>
          <tr>
            <th>Behaviour</th>
            <th>Default</th>
            <th>Where it is set</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Emails per day, per mailbox</td>
            <td>30 (allowed 1 to 200; warns above 50)</td>
            <td>Settings, Email, Sending rules</td>
          </tr>
          <tr>
            <td>Gap between emails, one mailbox</td>
            <td>Random 18 to 24 minutes (warns below 10)</td>
            <td>Sending rules</td>
          </tr>
          <tr>
            <td>Sending hours, new mailboxes</td>
            <td>Monday to Friday, 09:00 to 18:00, time zone Asia/Kolkata unless you change it</td>
            <td>Sending rules, then per mailbox</td>
          </tr>
          <tr>
            <td>Follow-up wait</td>
            <td>3 days by default, minimum 1</td>
            <td>Sequence editor</td>
          </tr>
        </tbody>
      </DataTable>
      <p>
        A mailbox&rsquo;s daily limit is copied from the organization rule when the mailbox is added, and its sending hours can be edited mailbox by mailbox. The default time zone is Asia/Kolkata, so change it in Sending rules if you sell elsewhere.
      </p>
      <h3 id="how-sending-runs">How sending runs</h3>
      <ul>
        <li>Connected mailboxes form one pool. New leads are shared across mailboxes in turn, and a lead then stays with the mailbox that sent its first email, so follow-ups come from the same address.</li>
        <li>A queue is built once a day for each mailbox: due follow-ups first, most overdue first, then new leads, up to the daily limit.</li>
        <li>About once a minute, each mailbox with queued leads sends one email, if it is past its random gap and inside its sending hours.</li>
        <li>A follow-up with a blank subject goes out as a reply in the same thread, with <code>Re:</code> added to the earlier subject.</li>
        <li>Merge fields come from any column in your CSV or XLSX, <code>{"{A|B|C}"}</code> spin text varies the copy, and Preview renders a step for a real lead and mailbox.</li>
      </ul>
      <h3 id="what-stops-a-lead">What stops a lead</h3>
      <ul>
        <li>A reply on any channel marks the lead Replied and removes their queued emails. Reply detection needs the optional Gmail Pub/Sub topic on the Google Workspace connection.</li>
        <li>AgentSDR reads delivery failure reports in your mailbox, marks the lead Bounced and suppresses the address. A temporary delay notice does not suppress anyone.</li>
        <li>Every email carries an unsubscribe link and a one-click unsubscribe header. Either way the address is suppressed and the lead becomes Suppressed.</li>
        <li>Do Not Contact anywhere in your workspace is checked again right before each send. A suppressed address is never mailed again from any campaign in your organization.</li>
        <li>Each step is sent at most once per lead. A failed send is marked Failed rather than retried automatically.</li>
      </ul>
      <Callout tone="agentsdr" title="What AgentSDR does not do">
        <p>
          It does not publish your SPF, DKIM or DMARC records, verify your list, or run a warm-up network. Those stay with you. To warm a new mailbox, lower the organization&rsquo;s daily limit before you connect it. Only Google Workspace mailboxes are supported today.
        </p>
      </Callout>
      <p>
        Replies, whatever the channel, land in one <Link href="/product/inbox">AI inbox</Link> with a classification and a drafted answer, so stopping a sequence and answering a lead are the same action.
      </p>

      <H2 id="checklist">Launch checklist</H2>
      <ol>
        <li>The sending domain has SPF, DKIM and DMARC, and a test message to Gmail shows all three passing.</li>
        <li>The domain is registered in Google Postmaster Tools.</li>
        <li>Each mailbox is a real Workspace user with a name, photo and signature.</li>
        <li>New mailboxes start at low daily counts, and you have a plan to raise them in steps.</li>
        <li>Sending hours and time zone match your prospects, with randomised gaps.</li>
        <li>The list is verified, deduplicated and cleared against your customers and opt-outs.</li>
        <li>Every step is previewed on several leads, including ones with missing fields.</li>
        <li>Unsubscribe works, bounces suppress, and replies stop the sequence.</li>
        <li>You know the rules for the countries you are emailing.</li>
      </ol>
    </GuideLayout>
  );
}
