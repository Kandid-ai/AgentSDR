import {
  RiBookOpenLine,
  RiBrainLine,
  RiContactsBook3Line,
  RiFlowChart,
  RiForbidLine,
  RiHistoryLine,
  RiKanbanView,
  RiListSettingsLine,
  RiSparkling2Fill,
  RiSwapBoxLine,
} from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureGrid, FeatureSplit, HeroFrame, PageHero, RelatedPages, Section, Steps } from "@/components/marketing/blocks";
import { Reveal } from "@/components/landing/Reveal";
import { ConfidenceGate } from "@/components/marketing/pages/crm";
import { ACCENT } from "@/components/marketing/catalog";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ProductShot, SceneStage, StatBand } from "@/components/marketing/live";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";

const PATH = "/product/ai-crm";
const DESCRIPTION =
  "Open-source AI CRM for outbound sales. It classifies every email, LinkedIn and WhatsApp reply, moves leads when confident and drafts answers for you to send.";

export const metadata = marketingMetadata({
  path: PATH,
  title: "AI CRM for outbound sales: classify every reply",
  ogTitle: "AI CRM for outbound sales",
  eyebrow: "AI CRM",
  description: DESCRIPTION,
});

const FAQ = [
  {
    q: "What is an AI CRM for outbound sales?",
    a: "A CRM that starts when a prospect replies. AgentSDR reads each reply from email, LinkedIn or WhatsApp, sorts the lead into your categories and funnel stages, and writes a draft answer from your knowledge base. A person reviews and sends every message.",
  },
  {
    q: "Does the AI send replies on its own?",
    a: "No. Drafts wait in Action required until someone sends them, as written or edited. The AI can move a lead forward in the pipeline when it is confident. A backward move, a low-confidence call and every new Customer are held for a person.",
  },
  {
    q: "How does AI reply classification work?",
    a: "The classifier sees your lead categories and their descriptions, your classification instructions and your knowledge base. It returns a category, a subcategory, a confidence and a short reason you can read on the record. Fix the wording of a description and later replies improve.",
  },
  {
    q: "When does the AI move a lead and when does it wait?",
    a: "It applies a classification when confidence is at least the threshold (85% by default) and the move is forward or level on the funnel. It holds the change when confidence is lower, when the move is backward or to an unnumbered outcome, when the proposal is Other, and when it is Customer. A lead that is already a Customer is never moved out by the AI.",
  },
  {
    q: "Can I change the categories and stages?",
    a: "The four categories are fixed: Interested, Customer, Not interested and Other. The subcategories under them are yours. Add, rename and re-describe them, give each a funnel stage number, and attach a reply sequence to any of them.",
  },
  {
    q: "Which AI model does it use?",
    a: "Any model on OpenRouter, with your own key. Classification and drafting run through the same bring-your-own-key setup, pinned to the provider you choose. There is no AgentSDR-hosted model in the middle.",
  },
  {
    q: "What happens when someone asks to be removed?",
    a: "An explicit request to stop, such as \"unsubscribe me\", is applied at once. The person is marked Do Not Contact, no draft is written, and the flag blocks email, LinkedIn and WhatsApp sends everywhere in your organization.",
  },
];

const HOLD_RULES = [
  { when: "Confidence is at or above the threshold and the move is forward or level", result: "Applied", note: "The default threshold is 85%. Level means the same funnel stage number, such as Meeting Requested to Meeting No Show." },
  { when: "Confidence is below the threshold", result: "Held", note: "Shown as AI suggests, with Accept, in Action required under Confirm classification." },
  { when: "The lead is on a funnel stage and the proposal is lower, or has no stage number", result: "Held", note: "Going back a step is a judgement about the deal, not about one message. Meeting Done to Out of Office waits for you." },
  { when: "The proposal is Customer", result: "Held", note: "Every new Customer is reviewed. A lead that is already a Customer is protected from AI changes." },
  { when: "The proposal is Other", result: "Held", note: "Reviewed by default, since Other is where misreads hide." },
  { when: "The reply asks to stop, or is classified Do Not Contact", result: "Applied at once", note: "Suppression never waits in a queue. No draft is written and every channel is blocked." },
];

export default function AiCrmPage() {
  return (
    <>
      <JsonLd data={softwareLd(DESCRIPTION, PATH)} />
      <PageHero
        eyebrow="AI CRM"
        eyebrowIcon={RiSparkling2Fill}
        title="An AI CRM for outbound sales, built around replies"
        lede="Every reply on email, LinkedIn and WhatsApp is read, filed under your own lead categories and answered with a draft grounded in your knowledge base. The AI proposes. You press send."
      >
        <HeroFrame>
          <ProductShot screen="actions" />
        </HeroFrame>
      </PageHero>

      <Section id="how-it-works" eyebrow="From reply to draft" title="Sorted, scored and answered before you open it" lede="The CRM starts when someone replies. By the time a reply reaches you it is classified, the lead is in the right stage and a draft is waiting.">
        <FeatureSplit
          eyebrow="AI reply classification"
          accent={ACCENT.ai}
          title="Every reply filed under your categories"
          body="The AI reads the reply with the thread behind it, then picks one of four categories and usually a subcategory such as Meeting Requested. It records a confidence and a short reason you can read on the record."
          bullets={["Interested, Customer, Not interested or Other", "Subcategories, descriptions and funnel stages are yours", "Email, LinkedIn and WhatsApp replies on one record per lead"]}
          visual={<SceneStage channel="crm" index={0} accent={ACCENT.ai} label="A LinkedIn reply being classified as Interested, Meeting Requested. An illustration with sample data." />}
        />
        <FeatureSplit
          reverse
          eyebrow="Confidence rules"
          accent={ACCENT.ai}
          title="Moves forward when sure, waits for you when not"
          body="A confident, forward move is applied. Everything riskier becomes a proposal you accept or reject: a low-confidence call, a step backward on the funnel, a new Customer. Do Not Contact is the one exception, applied the moment someone asks to stop."
          bullets={["85% confidence by default, as a threshold you can read", "Backward and unnumbered moves are held", "Every new Customer is reviewed"]}
          visual={<ConfidenceGate />}
        />
        <FeatureSplit
          eyebrow="Grounded drafts"
          accent={ACCENT.ai}
          title="Drafts that quote your own facts"
          body="Pricing, scheduling and objection answers come from the knowledge base you wrote, not from the model's memory. Under each draft, Knowledge used lists the excerpts it relied on, so you can see where a claim came from."
          bullets={["Documents by kind: pricing, FAQ, scheduling, objections", "Standing instructions for tone, length and sign-off", "Approve & send, edit, regenerate with a note, or discard"]}
          visual={<SceneStage channel="crm" index={1} accent={ACCENT.ai} label="A draft reply built from knowledge base excerpts. An illustration with sample data." />}
        />
        <FeatureSplit
          reverse
          eyebrow="Reply sequences"
          accent={ACCENT.ai}
          title="Follow-ups that start when a lead answers"
          body="Attach a sequence to a subcategory and a reply starts a run: an immediate reply, then timed follow-ups if the conversation goes quiet. You write a goal for each step, the AI drafts it from the conversation, and you approve each message."
          bullets={["Up to 30 steps, with waits in minutes, hours or days", "A new reply from the lead cancels pending follow-ups", "Skip a step, pause or snooze a single lead"]}
          visual={<SceneStage channel="crm" index={2} accent={ACCENT.ai} label="A reply sequence drafting its next step. An illustration with sample data." />}
        />
      </Section>

      <Section tone="grey" id="rules" eyebrow="The rulebook" title="Exactly when the AI acts and when it holds" lede="The rules are deterministic and written down. The AI never decides whether to ask you, the policy does.">
        <Reveal>
          <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.06]">
            <table className="w-full text-left text-[14px]">
              <caption className="sr-only">When the AI applies a classification and when it holds it for a person</caption>
              <thead>
                <tr className="bg-[#f7f7f8] text-[12px] uppercase tracking-[0.06em] text-[#6b6b6b]">
                  <th scope="col" className="px-5 py-3 font-medium sm:px-6">If</th>
                  <th scope="col" className="px-3 py-3 font-medium">The AI</th>
                  <th scope="col" className="hidden px-5 py-3 font-medium md:table-cell">Why</th>
                </tr>
              </thead>
              <tbody>
                {HOLD_RULES.map((r) => (
                  <tr key={r.when} className="border-t border-black/[0.06] align-top">
                    <td className="px-5 py-4 text-[#141414] sm:px-6">
                      {r.when}
                      <p className="mt-1.5 text-[13px] leading-5 text-[#6b6b6b] md:hidden">{r.note}</p>
                    </td>
                    <td className="px-3 py-4">
                      <span className={r.result === "Held" ? "inline-flex whitespace-nowrap rounded-full bg-[#e5930a]/14 px-2.5 py-0.5 text-[12px] font-medium text-[#9a6206]" : "inline-flex whitespace-nowrap rounded-full bg-[#1fc16b]/12 px-2.5 py-0.5 text-[12px] font-medium text-[#178c4e]"}>{r.result}</span>
                    </td>
                    <td className="hidden px-5 py-4 text-[#656565] md:table-cell">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <div className="mt-12">
          <StatBand
            items={[
              { value: 4, label: "fixed categories, with subcategories you define" },
              { value: 85, suffix: "%", label: "default confidence needed to apply a move" },
              { value: 30, label: "steps in a reply sequence, at most" },
              { value: 0, label: "messages sent until a person presses send" },
            ]}
          />
        </div>
      </Section>

      <Section id="features" eyebrow="Inside the CRM" title="A pipeline, a knowledge base and a paper trail" lede="Everything that happens after a reply, in the same workspace as your channels and your lead database.">
        <FeatureGrid
          items={[
            { icon: RiKanbanView, title: "Pipeline board and list", body: "Every open lead by who has to act next: Needs action, Waiting on them, Follow-ups exhausted. Filter by category and channel." },
            { icon: RiContactsBook3Line, title: "One record per lead", body: "A reply on email and a later one on WhatsApp land on the same record, with one shared timeline." },
            { icon: RiBookOpenLine, title: "Knowledge base", body: "Documents of any kind, versioned on every edit. Mark short ones as always included in draft context." },
            { icon: RiListSettingsLine, title: "Instructions", body: "Standing guidance for drafting and for classification, such as tone, sign-off and edge cases the classifier keeps missing." },
            { icon: RiSwapBoxLine, title: "Move stage by hand", body: "Record a call or a meeting that happened outside the thread, and choose whether to schedule follow-ups or draft the next message." },
            { icon: RiForbidLine, title: "Do Not Contact", body: "One flag stops email, LinkedIn and WhatsApp. Sending is refused until a person clears it on the record." },
            { icon: RiFlowChart, title: "Reply stops other channels", body: "A reply cancels the lead's pending email, LinkedIn and WhatsApp campaign steps and any draft that is now out of date." },
            { icon: RiBrainLine, title: "Your model, your key", body: "Classification and drafts run on any OpenRouter model with your own key, pinned to the provider you choose." },
            { icon: RiHistoryLine, title: "Activity history", body: "An audit trail of decisions, drafts and delivery on every record, including why a classification was held." },
          ]}
        />
      </Section>

      <Section tone="grey" id="get-started" eyebrow="Get started" title="What happens to a reply">
        <Steps
          items={[
            { title: "Classify", body: "The AI picks a category and subcategory, with a confidence and a reason." },
            { title: "Apply or hold", body: "A confident forward move is applied. Anything else waits as a proposal." },
            { title: "Draft", body: "A reply is written from the conversation, the sequence step's goal and your knowledge." },
            { title: "You decide", body: "Send as written, edit, regenerate or discard, from Action required." },
            { title: "Follow up", body: "After you send a step, the next one is scheduled and drafted when it is due." },
          ]}
        />
      </Section>

      <FaqSection items={FAQ} />

      <RelatedPages paths={["/product/inbox", "/product/analytics", "/product/email", "/product/lead-database", "/solutions/sales-teams", "/compare/instantly"]} />

      <ClosingCta title="Answer every reply, fast and in your own words" lede="Clone the repo, bring your own OpenRouter key and let the AI do the sorting while you keep the send button. No seats, no per-contact pricing." />
    </>
  );
}
