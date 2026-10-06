import Link from "next/link";
import { GuideLayout, GUIDE_PUBLISHED } from "@/components/marketing/pages/resources/GuideLayout";
import { Callout, DataTable, H2 } from "@/components/marketing/pages/resources/Prose";
import { marketingMetadata } from "@/lib/marketing/seo";

const PATH = "/guides/whatsapp-b2b-outreach";
const DESCRIPTION =
  "WhatsApp for B2B outreach: consent and etiquette, warming up a new number, how many new chats a day are safe, calls versus messages, and recording consent.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "WhatsApp for B2B outreach: a practical guide",
  ogTitle: "WhatsApp for B2B outreach",
  eyebrow: "Guide",
  description: DESCRIPTION,
  type: "article",
  publishedTime: GUIDE_PUBLISHED,
});

const TOC = [
  { id: "overview", label: "The short version" },
  { id: "consent", label: "Consent and etiquette" },
  { id: "numbers", label: "Numbers and warm-up" },
  { id: "volume", label: "New chats a day" },
  { id: "messages", label: "Writing the messages" },
  { id: "calls-vs-messages", label: "Calls or messages" },
  { id: "recording", label: "Recording and consent" },
  { id: "in-agentsdr", label: "AgentSDR's guardrails" },
  { id: "calls-in-agentsdr", label: "Calling in AgentSDR" },
  { id: "checklist", label: "Checklist" },
];

const FAQ = [
  {
    q: "Is it okay to cold message people on WhatsApp for B2B?",
    a: "WhatsApp's terms and Business policies forbid unsolicited bulk messaging, and numbers that people report get banned. Messaging someone who has a real reason to expect it, such as an inbound enquiry or a warm introduction, is a very different thing from messaging a purchased list. This is not legal advice; check the rules where you and the recipient are.",
  },
  {
    q: "How many new WhatsApp chats a day are safe?",
    a: "There is no published safe number. Conservative practice is a few dozen at most per number, fewer for a new one. AgentSDR defaults to 25 new chats a day per number in a rolling 24 hours and warns above 25. Replies to people who wrote first are not counted.",
  },
  {
    q: "How long should I wait before using a new number for outreach?",
    a: "Let it behave like a normal number first. AgentSDR starts no new chats from a newly linked number for 24 hours by default, though it answers existing chats immediately, and warns if you set the warm-up shorter. Keep the defaults for the first weeks.",
  },
  {
    q: "Can I record WhatsApp calls?",
    a: "Technically yes, with a tool built for it; legally it depends on where you and the other person are. Many places require everyone on a call to consent and some require an announcement. Tell people when you record. AgentSDR's Call Recorder extension only records calls placed from AgentSDR.",
  },
  {
    q: "What happens if a WhatsApp number gets banned?",
    a: "The number is gone for outreach, and in AgentSDR a banned number also loses its calling. That is why AgentSDR enforces its guards on the server for every send, not only in the interface.",
  },
  {
    q: "Does a reply on another channel stop my WhatsApp sequence?",
    a: "In AgentSDR, yes. When a lead replies by email, LinkedIn or WhatsApp, their enrolments on all three stop and the reply goes to Action required in the CRM. AgentSDR also checks the chat just before each send.",
  },
];

export default function Page() {
  return (
    <GuideLayout
      path={PATH}
      crumb="WhatsApp for B2B outreach"
      headline="WhatsApp for B2B outreach: a practical guide"
      description={DESCRIPTION}
      title="WhatsApp for B2B outreach"
      lede="When WhatsApp is the right channel for business prospecting, how to start a number safely, how much to send, and where calls and recordings need care."
      readMinutes={10}
      toc={TOC}
      takeaways={[
        "WhatsApp is a personal channel. Message people who have a reason to expect you, and make opting out effortless.",
        "A new number needs time. Let it answer chats before it starts them, and keep new-chat volume small and steady.",
        "WhatsApp bans numbers that start many chats with people who have not saved them. A banned number cannot be fixed with settings.",
        "Calls are warmer than messages but recording needs the consent of everyone on the line in many places. Tell people.",
        "AgentSDR holds a new number for 24 hours, allows 25 new chats a day per number, waits 10 seconds between sends, and never messages Do Not Contact.",
      ]}
      faq={FAQ}
      related={["/product/whatsapp", "/product/inbox", "/guides/cold-email-google-workspace", "/guides/linkedin-automation-limits", "/solutions/founders", "/solutions/sales-teams"]}
      closing={{ title: "Use WhatsApp where it fits, carefully.", lede: "AgentSDR is open source: messages, calls and replies for WhatsApp, with the guardrails enforced on the server." }}
    >
      <H2 id="overview">The short version</H2>
      <p>
        In many markets WhatsApp is how business gets done: quotes, scheduling, quick questions and follow-ups all happen there, and people read it far more reliably than email. That is also why it is guarded. People treat it as a personal space, WhatsApp polices it hard, and a number that annoys people does not just underperform, it disappears.
      </p>
      <p>
        So the right frame for B2B WhatsApp is closer to a warm follow-up than to a cold blast. This guide covers consent and etiquette, how to start a new number, how much to send, the difference between messages and calls, and what to think about before recording. It ends with how <Link href="/product/whatsapp">AgentSDR&rsquo;s WhatsApp messaging and calling</Link> enforce those habits in code. It is general guidance and not legal advice.
      </p>

      <H2 id="consent">Consent and etiquette</H2>
      <p>
        WhatsApp&rsquo;s{" "}
        <a href="https://www.whatsapp.com/legal/terms-of-service" rel="noopener noreferrer" target="_blank">
          Terms of Service
        </a>{" "}
        and its{" "}
        <a href="https://business.whatsapp.com/policy" rel="noopener noreferrer" target="_blank">
          Business policies
        </a>{" "}
        are the source of truth, and they are what a ban is decided against. Read them before you send anything. AgentSDR&rsquo;s own responsible use page summarises the position: WhatsApp forbids unsolicited bulk messaging, and numbers that people report get banned.
      </p>
      <p>Beyond the platform, the law also applies. Phone-based marketing is regulated in many countries, and the consent that is needed differs between business-to-business and consumer contact, between countries and between channels. Ask a lawyer who knows the countries you sell into.</p>
      <h3 id="good-reasons">Good reasons to message someone</h3>
      <ul>
        <li>They filled in a form or asked for a call, and gave a number.</li>
        <li>They were introduced to you by someone they know.</li>
        <li>You met at an event and exchanged numbers.</li>
        <li>An existing customer or active opportunity wants to continue there.</li>
        <li>They already replied to you on another channel and prefer WhatsApp.</li>
      </ul>
      <h3 id="poor-reasons">Poor reasons</h3>
      <ul>
        <li>The number came from a bought list or a scrape.</li>
        <li>You have the number, but the person has never heard of you.</li>
        <li>Email did not get a reply, so you try again somewhere more intrusive.</li>
      </ul>
      <h3 id="etiquette">Etiquette that protects the number</h3>
      <ul>
        <li>Introduce yourself in the first line: who you are, which company, how you have their number.</li>
        <li>Keep the first message short and give a clear, easy way to say no.</li>
        <li>Respect silence. One or two spaced follow-ups is enough.</li>
        <li>Stop immediately when asked, and remember it on every channel.</li>
        <li>Do not message at night or on weekends, unless the person&rsquo;s market works that way.</li>
      </ul>

      <H2 id="numbers">Numbers and warm-up</H2>
      <p>
        A WhatsApp number has a history. A number that was just registered, has no contacts, and immediately starts conversations with strangers is the profile of a spammer. The safer pattern is to give a new number a quiet start: use it for real conversations, let people save it, and delay anything proactive for a while.
      </p>
      <Callout tone="warn" title="One number, one reputation">
        <p>A reported or banned number takes its chat history and reach with it. Never run outreach from the number your team uses for existing customers. Use a dedicated number and expect that it may be lost.</p>
      </Callout>
      <p>
        There is no single published warm-up length. The common view is that the first day should not involve messaging strangers at all and the first weeks should stay well below your eventual volume. Treat that as practice, not a rule.
      </p>

      <H2 id="volume">New chats a day</H2>
      <p>
        What matters is how many <em>new</em> conversations a number starts, not how many messages it sends. Answering someone who wrote first, or continuing an existing chat, is ordinary use. Starting conversations with people who do not have the number saved is what gets reported.
      </p>
      <p>
        Because WhatsApp publishes no figure, careful operators keep new-chat numbers in the low dozens per number per day, even for a number with a long history, and add numbers rather than turning one up. Spread sending through the working day, leave seconds between messages instead of firing them in a burst, and watch for signals that something is wrong: messages not delivering, people replying that they did not ask to be contacted, or the number being asked to verify itself.
      </p>
      <DataTable caption="Pacing for WhatsApp, general practice">
        <thead>
          <tr>
            <th>Setting</th>
            <th>Careful approach</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>First day on a new number</td>
            <td>Answer chats; start none</td>
          </tr>
          <tr>
            <td>New chats a day</td>
            <td>Low dozens per number at most; less when new</td>
          </tr>
          <tr>
            <td>Gap between messages</td>
            <td>Seconds at least; longer is safer</td>
          </tr>
          <tr>
            <td>Follow-ups</td>
            <td>One or two, days apart</td>
          </tr>
        </tbody>
      </DataTable>

      <H2 id="messages">Writing the messages</H2>
      <p>
        A WhatsApp message is read on a phone, usually in a few seconds. It should read like a message from a colleague, not like a brochure: two or three sentences, one idea and one question.
      </p>
      <ul>
        <li>Open with who you are and why you are writing to them specifically.</li>
        <li>Skip attachments and long links in the first message; they invite suspicion.</li>
        <li>Personalise with real details, and preview with leads that have missing data, since an empty field can leave &ldquo;Hi ,&rdquo;.</li>
        <li>Vary the wording across a list. Identical text sent to many people is a common spam signal.</li>
        <li>Ask something easy to answer, such as whether they want details or a quick call.</li>
      </ul>
      <p>
        Sequences should be short: a first message and a few follow-ups, with waits that are measured in days, and a clear stop when the lead replies on any channel.
      </p>

      <H2 id="calls-vs-messages">Calls or messages</H2>
      <p>
        A message is asynchronous and easy to ignore. A call is richer and more personal, and for some buyers it is how a deal progresses. Neither is automatically better, and the choice depends on the relationship.
      </p>
      <ul>
        <li>
          <strong>Message first</strong> when the person does not know you. An unexpected call from an unknown number is more intrusive than a message, and it is easier for the person to say no to a message.
        </li>
        <li>
          <strong>Call</strong> when a person has asked for one, has replied positively, or has agreed a time. It is also useful for qualifying a warm lead quickly.
        </li>
        <li>
          <strong>Follow a call with a short message</strong>: a summary, the details you promised, or a link to book a time.
        </li>
      </ul>

      <H2 id="recording">Recording and consent</H2>
      <p>
        Recording a call is a separate decision from making it. Many places require everyone on a call to consent before it is recorded, and some require you to announce it. Others need only one party to consent. You are responsible for the law where you and the other person are, and the rules can differ if you are in different countries. The safe habit is to tell people at the start of the call that it is being recorded and why, and to stop if they object.
      </p>
      <p>Beyond consent, a recording and its transcript are personal data. Decide how long you will keep them, who can listen, and how you will delete them on request. Store recordings privately and give access through short-lived links rather than public files.</p>

      <H2 id="in-agentsdr">AgentSDR&rsquo;s guardrails</H2>
      <p>
        AgentSDR reads WhatsApp numbers that you link in Unipile and sends through them. Every WhatsApp send, whether a reply from Messages, a CRM reply, a campaign message or a call follow-up, passes the same server-side checks under a per-number lock, so two sends at the same instant cannot both slip through.
      </p>
      <DataTable caption="AgentSDR WhatsApp guards">
        <thead>
          <tr>
            <th>Guard</th>
            <th>Default</th>
            <th>Allowed</th>
            <th>What happens</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Warm-up after linking</td>
            <td>24 hours</td>
            <td>0 to 336 hours; warns below 24</td>
            <td>The number answers existing chats but starts no new ones</td>
          </tr>
          <tr>
            <td>New chats per day, per number</td>
            <td>25, in a rolling 24 hours</td>
            <td>1 to 200; warns above 25</td>
            <td>Further new chats are refused; existing chats can still be answered</td>
          </tr>
          <tr>
            <td>Seconds between sends</td>
            <td>10</td>
            <td>3 to 600; warns below 10</td>
            <td>A faster second message is refused with a wait time</td>
          </tr>
          <tr>
            <td>Do Not Contact</td>
            <td>Always on</td>
            <td>Not configurable</td>
            <td>The message is refused</td>
          </tr>
        </tbody>
      </DataTable>
      <p>
        A number AgentSDR has never seen connected cannot start new chats at all until you sync it. A &ldquo;new chat&rdquo; is a number the account has never messaged, so chats the lead started, or that you started from your phone, do not count against the limit. A message can be up to 4,096 characters, and a number&rsquo;s own &ldquo;New chats a day&rdquo; overrides the organization rule.
      </p>
      <h3 id="campaigns">Message campaigns</h3>
      <ul>
        <li>A sequence is a first message plus up to five follow-ups, waits from 1 hour to 30 days (48 hours by default).</li>
        <li>Importing leads needs only a phone number, takes up to 5,000 rows, and unmapped columns become merge fields.</li>
        <li>Each connected number sends at most one message per round, follow-ups before first messages, and a lead stays on the number that sent its first message.</li>
        <li>Optional sending hours for campaigns; with none set, campaigns send at any time.</li>
        <li>When a guard refuses a message AgentSDR reacts to the reason: it waits, holds first messages while still sending follow-ups, skips a disconnected number, or stops the lead if it is Do Not Contact.</li>
        <li>A claim is recorded before each send, so a step is never sent twice. If delivery is uncertain AgentSDR does not resend, and marks the lead Failed for you to check.</li>
        <li>A reply on any channel stops the sequence, and AgentSDR checks the chat again just before sending.</li>
      </ul>
      <Callout tone="agentsdr" title="A floor, not permission">
        <p>AgentSDR&rsquo;s responsible use page calls these guards a floor rather than permission. They slow a number down; they cannot make unsolicited messaging acceptable to WhatsApp.</p>
      </Callout>

      <H2 id="calls-in-agentsdr">Calling in AgentSDR</H2>
      <p>
        AgentSDR places WhatsApp calls through WhatsApp Web in your own Chrome (version 116 or newer). A small extension, the Call Recorder, presses Voice call, records the call and uploads it; AgentSDR then keeps the recording on the lead.
      </p>
      <ul>
        <li>Only calls placed from AgentSDR&rsquo;s Call button are recorded. Your own calls in WhatsApp Web are never touched.</li>
        <li>The recording is stereo, with your microphone on the left and the lead on the right, and it starts at pickup, not the first ring. A call nobody picks up is discarded.</li>
        <li>Recordings go to your own Cloudflare R2 bucket, are never public, and each play uses a short-lived link.</li>
        <li>With a transcription model chosen in Settings, AgentSDR transcribes each recording on your own OpenRouter key and adds a short English summary. Speaker labels are inferred.</li>
        <li>After a call you mark the outcome, such as No answer, Interested or Do not call. A lead who does not answer comes round again after 1, 2 and then 4 days, then is done.</li>
        <li>A number that WhatsApp bans loses its calling too.</li>
      </ul>
      <p>
        Consent is yours to handle: AgentSDR&rsquo;s documentation says to tell people when you record, and you are responsible for the law where you and the lead are.
      </p>

      <H2 id="checklist">Checklist</H2>
      <ol>
        <li>Everyone you message has a reason to expect you, and you know how you got their number.</li>
        <li>Outreach uses a dedicated number, not the one your customers use.</li>
        <li>A new number answers chats before it starts them.</li>
        <li>New chats per number stay low, and you add numbers rather than turning one up.</li>
        <li>Messages are short, specific and varied, with an easy way to say no.</li>
        <li>Any reply, on any channel, stops the sequence.</li>
        <li>You tell people when you record a call, and know the rules where you both are.</li>
        <li>Recordings and transcripts are stored privately, with a retention plan.</li>
      </ol>
    </GuideLayout>
  );
}
