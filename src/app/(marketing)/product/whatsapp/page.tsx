import {
  RiCloudLine,
  RiFileTextLine,
  RiForbidLine,
  RiMic2Line,
  RiPhoneLine,
  RiRefreshLine,
  RiShieldKeyholeLine,
  RiTimerLine,
  RiWhatsappFill,
} from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureGrid, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section, Steps } from "@/components/marketing/blocks";
import { ACCENT } from "@/components/marketing/catalog";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ProductShot, SceneStage, StatBand } from "@/components/marketing/live";
import { CallStrip } from "@/components/marketing/pages/channels/CallStrip";
import { SendGuard } from "@/components/marketing/pages/channels/SendGuard";
import { SequenceRail } from "@/components/marketing/pages/channels/SequenceRail";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";

const PATH = "/product/whatsapp";
const DESCRIPTION =
  "Open-source WhatsApp outreach and calling for sales: record WhatsApp calls to your own R2 bucket, transcribe them, and run guarded message campaigns from your numbers.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "WhatsApp outreach and calling for sales",
  ogTitle: "WhatsApp outreach and calling for sales",
  eyebrow: "WhatsApp",
  description: DESCRIPTION,
});

const FAQ = [
  {
    q: "Can AgentSDR record WhatsApp calls?",
    a: "Yes, calls placed from AgentSDR's Call button. A Chrome extension dials the number in WhatsApp Web and records both sides from pickup to hang-up, then uploads the file to your own Cloudflare R2 bucket. Calls you place yourself in WhatsApp Web are never recorded.",
  },
  {
    q: "What do I need to make recorded calls?",
    a: "Chrome 116 or newer, a linked and connected WhatsApp number, Cloudflare R2 connected for storage, and WhatsApp Web in English. The extension finds WhatsApp's Voice call and End call controls by their English labels. For transcripts, also choose a transcription model that accepts audio.",
  },
  {
    q: "Where are recordings stored and who can hear them?",
    a: "In your own R2 bucket. Recordings are never public: every play uses a short-lived link, and the upload link is valid for 15 minutes. A recording can be up to 200 MB, about three hours. If an upload fails, the file is saved to your Downloads instead.",
  },
  {
    q: "How does call transcription work?",
    a: "If you choose a transcription model in Settings → AI provider, each recording is transcribed after it saves, usually in under a minute, on your own OpenRouter key. You get the language, a short English summary and the utterances. Speaker labels are inferred because the model receives the channels merged. With no model chosen, transcription is off.",
  },
  {
    q: "How many WhatsApp messages can I send a day?",
    a: "Each number can start 25 new chats in a rolling 24 hours by default, with 10 seconds between sends, and starts no new chats for 24 hours after it is linked. Answering existing chats is not limited that way. All three are Sending rules, and one number can override its own new chats limit. Keep the defaults for a new number.",
  },
  {
    q: "What does a WhatsApp campaign send?",
    a: "A first message and up to five follow-ups, each up to 4,096 characters, from the numbers you choose. A follow-up waits from 1 hour to 30 days after the previous message and defaults to 48 hours. A lead stays on the number that sent its first message, and a reply on any channel stops the sequence.",
  },
  {
    q: "Is recording WhatsApp calls legal?",
    a: "That depends on where you and the lead are. Many places require everyone on a call to consent before it is recorded, and some require you to announce it. You are responsible for following the law, so tell people when you record and read the Responsible use page.",
  },
];

const CAMPAIGN = [
  { title: "First message", when: "When the campaign launches", body: "Sent from one of your chosen numbers, one message per number per round, only inside any sending hours you set." },
  { title: "Follow-up 1", when: "48 hours later by default", body: "Wait anywhere from 1 hour to 30 days. Follow-ups go from the same number as the first message." },
  { title: "Follow-up 2 to 5", when: "Up to five follow-ups", body: "A step is claimed before it sends, so it cannot go twice, even after a deploy." },
  { title: "A reply, on any channel", when: "Sequence stops", body: "The lead becomes Replied and the answer lands in Action required in the CRM.", tone: "stop" as const },
];

const REPLY = [
  { title: "The lead replies on WhatsApp", when: "Unipile event", body: "The message is stored with its origin: lead, AgentSDR or phone." },
  { title: "The sequence stops", when: "Immediately", body: "The lead is Replied, and their email, LinkedIn and WhatsApp enrollments stop." },
  { title: "It reaches the CRM", when: "On a WhatsApp conversation", body: "Classified in Action required, next to email and LinkedIn replies." },
];

export default function WhatsappPage() {
  return (
    <>
      <JsonLd data={softwareLd(DESCRIPTION, PATH)} />
      <PageHero
        eyebrow="WhatsApp outreach and calling"
        eyebrowIcon={RiWhatsappFill}
        title="WhatsApp outreach and calling for sales, from your own number"
        lede="Place a call from a lead's record, have both sides recorded to your own storage and transcribed by the model you choose. Or send a guarded message sequence. Replies go straight into the CRM."
      >
        <HeroFrame>
          <ProductShot screen="calls" />
        </HeroFrame>
      </PageHero>

      <Section id="calling" eyebrow="WhatsApp calling" title="Call from the record, keep the recording" lede="The Call Recorder is a Chrome extension. It dials inside your own WhatsApp Web, so the call comes from your number and nothing is routed through a third party.">
        <FeatureSplit
          eyebrow="One-click calls"
          accent={ACCENT.whatsapp}
          title="Click Call, and WhatsApp Web does the dialling"
          body="AgentSDR hands the call to the extension, which opens the chat and presses Voice call. A live strip shows each stage, and recording starts when the lead picks up, so their first words are not lost."
          bullets={["Call from a People row or a CRM record header", "Calls that nobody answers are discarded, not stored", "If the extension cannot press Voice call, you press it and recording still starts"]}
          visual={<CallStrip accent={ACCENT.whatsapp} />}
        />
        <FeatureSplit
          reverse
          eyebrow="Recording"
          accent={ACCENT.whatsapp}
          title="Both sides, saved to your own R2 bucket"
          body="The recording is stereo: your microphone on one channel, the lead on the other. It uploads straight to the Cloudflare R2 bucket you connected and is only ever played through short-lived links."
          bullets={["Up to 200 MB, about three hours", "A failed upload falls back to your Downloads folder", "Self-hosters add their own AgentSDR address on the extension's Options page"]}
          visual={<SceneStage channel="whatsapp" index={1} accent={ACCENT.whatsapp} label="A stereo recording drawing two waveforms, one for you and one for the lead. An illustration with sample data." />}
        />
        <FeatureSplit
          eyebrow="Transcripts and retries"
          accent={ACCENT.whatsapp}
          title="A transcript from the model you pick"
          body="Choose a transcription model that accepts audio in Settings → AI provider and each recording is transcribed on your own OpenRouter key. Afterwards you mark the outcome, and a lead who did not pick up comes round again."
          bullets={["Language, a short summary and the utterances", "Outcomes such as No answer, Interested or Meeting booked", "No answer comes round again after 1, 2 and then 4 days"]}
          visual={<SceneStage channel="whatsapp" index={2} accent={ACCENT.whatsapp} label="Call attempts on days 0, 1, 3 and 7 when a lead does not pick up. An illustration with sample data." />}
        />
      </Section>

      <Section id="campaigns" tone="grey" eyebrow="WhatsApp campaigns" title="Message sequences with the brakes built in" lede="A first message and timed follow-ups from the numbers you choose. Every send passes the same server-side guards, whether it comes from a campaign, a reply or the CRM.">
        <FeatureSplit
          eyebrow="Sequence"
          accent={ACCENT.whatsapp}
          title="A first message, then follow-ups on your schedule"
          body="Import up to 5,000 rows with a phone column, or add people from your database. Write up to six messages with merge fields, preview them for a real lead and launch. Campaigns are saved paused until you do."
          bullets={["Each message up to 4,096 characters", "Merge fields from any imported column", "A step is never sent twice; an uncertain delivery is flagged, not resent"]}
          visual={<SequenceRail steps={CAMPAIGN} accent={ACCENT.whatsapp} label="A WhatsApp campaign: a first message, follow-ups and a reply that stops the sequence." />}
        />
        <FeatureSplit
          reverse
          eyebrow="Guardrails"
          accent={ACCENT.whatsapp}
          title="Warm-up, daily limits and a gap between sends"
          body="A number starts no new chats for 24 hours after it is linked, at most 25 a rolling day, with 10 seconds between messages, and never to Do Not Contact. A held first message does not stop that number's follow-ups."
          bullets={["Enforced on the server under a per-number lock", "Rules per organization, with a per-number override for new chats", "A banned number loses its calling too, which is why the limits are strict"]}
          visual={<SceneStage channel="whatsapp" index={3} accent={ACCENT.whatsapp} label="A 24 hour warm-up countdown, new chats sent 10 seconds apart and a Do Not Contact lead skipped. An illustration with sample data." />}
        />
        <FeatureSplit
          eyebrow="Refusals"
          accent={ACCENT.whatsapp}
          title="What happens to a send a guard refuses"
          body="A refused message is not lost or forced through. A gap or rate limit waits for the next round, a warm-up or new-chat limit holds first messages while follow-ups continue, and Do Not Contact stops the lead."
          bullets={["Not connected: that number is skipped", "WhatsApp rejects the number: the lead is Failed, with the error shown", "Unipile unreachable: retried after 10 minutes, Failed after 3 attempts"]}
          visual={<SendGuard accent={ACCENT.whatsapp} />}
        />
        <FeatureSplit
          reverse
          eyebrow="Replies"
          accent={ACCENT.whatsapp}
          title="Replies land in the CRM, whoever typed them"
          body="Replies from a known lead reach the CRM on a WhatsApp conversation. Messages carry an origin: lead, AgentSDR, or phone for something you typed in WhatsApp Web, and answering from your phone counts as answering the lead."
          bullets={["A reply on any channel marks the lead Replied", "AgentSDR checks the chat again just before each send", "Classified in Action required next to email and LinkedIn"]}
          visual={<SequenceRail steps={REPLY} accent={ACCENT.whatsapp} label="A WhatsApp reply stopping the sequence and reaching Action required in the CRM." />}
        />
      </Section>

      <Section tone="white">
        <StatBand
          items={[
            { value: 24, suffix: " h", label: "warm-up before a newly linked number starts new chats" },
            { value: 25, label: "new chats per number in a rolling 24 hours, by default" },
            { value: 10, suffix: " s", label: "minimum gap between messages from one number" },
            { value: 6, label: "messages in a campaign: one first message and five follow-ups" },
          ]}
        />
      </Section>

      <Section id="limits" tone="grey" eyebrow="Honest limits" title="What to know before you rely on it" lede="Calling works by driving WhatsApp Web, so it has the limits of that approach. We would rather you hear them here.">
        <FeatureGrid
          columns={2}
          items={[
            { icon: RiPhoneLine, title: "Only calls placed from AgentSDR", body: "Your own calls in WhatsApp Web are never recorded or touched." },
            { icon: RiWhatsappFill, title: "WhatsApp Web in English", body: "The extension finds Voice call and End call by their English labels." },
            { icon: RiShieldKeyholeLine, title: "Consent is yours to get", body: "Many places require everyone on a call to agree to recording. Tell people, and follow local law." },
            { icon: RiMic2Line, title: "Inferred speaker labels", body: "Transcription receives merged audio, so rep and lead are inferred rather than measured." },
          ]}
        />
      </Section>

      <Section id="details" eyebrow="The details" title="Everything between the dial and the CRM" lede="The pieces that make calling and messaging work as one workflow.">
        <FeatureGrid
          items={[
            { icon: RiCloudLine, title: "Your own storage", body: "Recordings live in the Cloudflare R2 bucket you connect, reached by presigned links only." },
            { icon: RiFileTextLine, title: "Transcripts", body: "Language, summary and utterances from the audio model you choose, on your own key." },
            { icon: RiRefreshLine, title: "Retries", body: "A failed transcription can be retried, and a lead who did not answer returns after 1, 2 and 4 days." },
            { icon: RiTimerLine, title: "Sending hours", body: "Optionally restrict campaigns to hours you set. They apply to campaigns, not to messages you send yourself." },
            { icon: RiForbidLine, title: "Do Not Contact", body: "A lead marked Do Not Contact is refused on every send and marked Stopped in a campaign." },
            { icon: RiWhatsappFill, title: "One lead, one number", body: "Later steps go from the number that sent the first message." },
          ]}
        />
      </Section>

      <Section tone="grey" id="get-started" eyebrow="Get started" title="From linked number to first recorded call">
        <Steps
          items={[
            { title: "Link a number", body: "Scan the QR code in Unipile, then Sync from Unipile in AgentSDR." },
            { title: "Connect R2 and pick a model", body: "Storage for recordings, and a transcription model that accepts audio." },
            { title: "Install the extension", body: "Download the Call Recorder from Settings, then load it unpacked in Chrome." },
            { title: "Call or campaign", body: "Click Call on a lead, or launch a message campaign once warm-up has passed." },
          ]}
        />
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/product/linkedin", "/product/email", "/product/ai-crm", "/product/inbox", "/guides/whatsapp-b2b-outreach", "/solutions/founders"]} />

      <ClosingCta title="Call and message from your own number" lede="Clone the repo, link a WhatsApp number and place your first recorded call. Recordings stay in your storage, and the limits are yours to set." />
    </>
  );
}
