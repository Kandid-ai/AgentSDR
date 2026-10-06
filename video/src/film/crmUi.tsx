import type { CSSProperties, ReactNode } from "react";
import { ChatComposer, ComposerDraftBanner } from "@/components/inbox/shell/Conversation";
import { RiCheckDoubleLine, RiDraftLine, RiErrorWarningLine, RiInboxLine, RiTimeLine } from "@remixicon/react";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { ActionCard, ActionRows, STAGE_META, StageIcon, type PipelineStage } from "@/components/crm/CrmActionsClient";
import { HoverPreviewProvider } from "@/components/crm/ActionRowTools";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { CATEGORIES } from "@/components/landing/data/crm";
import { Img, staticFile } from "remotion";
import { tw } from "../kit/motion";

/**
 * The CRM in the app's own UI, driven by the frame: the real Action required
 * page (PageHeader, KpiStrip, the Queue frame and ActionRows) and the real
 * Pipeline board (stage frames of ActionCards), fed rows whose state is a
 * function of the frame — replies arriving, classifications landing, drafts
 * being written, sends, cards changing stage.
 */

type Data = Record<string, unknown>;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
// One fixed "now" so every frame renders the same relative times.
const NOW = Date.UTC(2026, 9, 1, 15, 0);

export type Lead = {
  id: string;
  name: string;
  company: string;
  domain: string;
  channel: "email" | "linkedin" | "whatsapp";
  reply: string;
  subject?: string;
  category: string;
  subcategoryId: string;
  subcategory: string;
  draft?: string;
  sequence?: string;
  step?: string;
  dueState: string;
  dueInDays?: number;
  dnc?: boolean;
};

export const CRM_LEADS: Lead[] = [
  { id: "maya", name: "Maya Chen", company: "Northwind Labs", domain: "northwindlabs.io", channel: "email", subject: "Quick idea for Northwind Labs", reply: "Sure — what would that look like for us? Thursday afternoon works.", category: "interested", subcategoryId: "s-meet", subcategory: "Meeting Requested", draft: "Hi Maya — Thursday works. 2:00 or 3:30 PM PT? I'll send a 20-minute invite and walk you through it.", sequence: "Meeting Requested", step: "Immediate reply", dueState: "immediate_reply" },
  { id: "daniel", name: "Daniel Okafor", company: "Brightloop", domain: "brightloop.com", channel: "linkedin", reply: "Interesting — can you send a short deck?", category: "interested", subcategoryId: "s-info", subcategory: "Information Requested", draft: "Happy to, Daniel — here's a short deck on how teams run every channel from one place.", sequence: "Information Requested", step: "Share information", dueState: "immediate_reply" },
  { id: "priya", name: "Priya Raman", company: "Ledgerly", domain: "ledgerly.co", channel: "whatsapp", reply: "Can we do Thursday instead?", category: "interested", subcategoryId: "s-meet", subcategory: "Meeting Requested", draft: "Thursday is perfect, Priya — 10:00 your time? I'll send the invite now.", sequence: "Meeting Requested", step: "Immediate reply", dueState: "immediate_reply" },
  { id: "lucas", name: "Lucas Meyer", company: "Parcelly", domain: "parcelly.io", channel: "linkedin", reply: "Not this quarter — try me in January.", category: "not_interested", subcategoryId: "s-later", subcategory: "Not Required Right Now", sequence: "Not Required Right Now", step: "Check back in January", dueState: "follow_up", dueInDays: 97 },
  { id: "sofia", name: "Sofia Alvarez", company: "Kestrel Health", domain: "kestrelhealth.com", channel: "email", subject: "Quick idea for Kestrel Health", reply: "Please stop emailing me.", category: "not_interested", subcategoryId: "s-dnc", subcategory: "Do Not Contact", dueState: "none", dnc: true },
];

/** A lead as the actions API returns it, at a point in its life. */
export function actionOf(lead: Lead, state: { classified: boolean; draft?: string; stage?: PipelineStage; sent?: boolean }): Data {
  const repliedAt = new Date(NOW - 4 * MIN).toISOString();
  const classified = state.classified;
  return {
    id: lead.id,
    name: lead.name,
    channel: lead.channel,
    stage: state.stage ?? "needs_action",
    category: classified ? lead.category : "unclassified",
    dueState: classified ? lead.dueState : "immediate_reply",
    dueAt: lead.dueInDays ? new Date(NOW + lead.dueInDays * DAY).toISOString() : null,
    actionType: !classified ? "Classification review" : lead.draft ? "Reply review" : lead.dnc ? "Human review" : "Follow-up review",
    latestInboundExcerpt: lead.reply,
    record: {
      categoryKey: classified ? lead.category : null,
      subcategoryId: classified ? lead.subcategoryId : null,
      contextVersion: 3,
      lastInboundAt: repliedAt,
      lastOutboundAt: new Date(state.sent ? NOW - MIN : NOW - 3 * DAY).toISOString(),
    },
    // The contact's portrait (public/faces, fictional people — tools/faces.ts).
    person: { profilePictureUrl: staticFile(`faces/${lead.id}.jpg`) },
    company: { name: lead.company, domain: "" },
    subcategory: classified ? { name: lead.subcategory } : {},
    latestInbound: { bodyText: lead.reply, subject: lead.subject ?? "", sentAt: repliedAt },
    classification: classified ? { status: "auto_applied", category: lead.category } : { status: "pending" },
    draft: state.draft ? { id: `d-${lead.id}`, status: "awaiting_review", aiBodyText: state.draft, revision: 1, expectedContextVersion: 3, subject: lead.subject ? `Re: ${lead.subject}` : "" } : {},
    activeRun: classified && lead.sequence ? { run: { id: `r-${lead.id}` }, sequence: { name: lead.sequence }, step: { name: lead.step ?? "Immediate reply" } } : {},
    contactPolicy: classified && lead.dnc ? { doNotContact: true } : {},
  };
}

const noop = () => {};

/* ------------------------------------------------------------ Action required */

/**
 * `rows` are the actions on screen, in order; `rowStyle` lets the scene light,
 * fade or lift a row by its index in that list (CSS on the real table rows).
 */
export function ActionRequiredPage({ rows, kpis, rowStyles, tools, overlay }: { rows: Data[]; kpis: { queue: number; drafts: number; followUps: number }; rowStyles: string; tools: number[]; overlay?: ReactNode }) {
  // The row's Edit / Send tools appear on hover in the app; here the scene
  // shows them on the rows it is about to send, by index.
  const toolsCss = tools.map((i) => `.crm-q tbody tr:nth-child(${i + 1}) div[data-row-tools].absolute { opacity: 1 !important; }`).join("\n");
  return (
    <HoverPreviewProvider>
      <div className="crm-q relative h-full bg-bg-white-0 px-6 py-6">
        <style>{toolsCss + "\n" + rowStyles}</style>
        <PageHeader title="Action required" description="Every reply the AI has classified, with the answer it drafted. Approve, edit or reclassify." />
        <KpiStrip className="mt-5" columns={4}>
          <KpiCell icon={RiInboxLine} label="In the queue" value={String(kpis.queue)} context="replies and follow-ups due" />
          <KpiCell icon={RiDraftLine} label="Drafts to review" value={String(kpis.drafts)} context="written by your model" />
          <KpiCell icon={RiTimeLine} label="Follow-ups due" value={String(kpis.followUps)} context="scheduled for you" />
          <KpiCell icon={RiErrorWarningLine} label="Errors" value="0" context="nothing failed today" />
        </KpiStrip>
        <Frame className="mt-5">
          <FrameHeader title="Queue" description="Newest reply first. Hover a reply or a draft to read it whole." />
          <FramePanel className="p-0 sm:p-0">
            <ActionRows actions={rows} categories={CATEGORIES} onActionsChange={noop} empty={{ icon: RiInboxLine, title: "All clear", detail: "Nothing needs you right now." }} />
          </FramePanel>
        </Frame>
        {overlay}
      </div>
    </HoverPreviewProvider>
  );
}

/** The draft, open in the app's own composer: the AI-draft banner, the text, Approve & send. */
export function DraftComposer({ text, pressed }: { text: string; pressed: boolean }) {
  return (
    <div className="rounded-2xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200" style={{ boxShadow: "0 24px 48px -20px rgb(14 18 27 / 0.35)" }}>
      <div style={{ transform: pressed ? "scale(0.99)" : undefined }}>
        <ChatComposer
          value={text}
          onChange={noop}
          onSubmit={noop}
          tone="draft"
          minRows={3}
          banner={<ComposerDraftBanner onClear={noop} note="Drafted from your knowledge base — approve to send." />}
          meta={<span>Meeting Requested · Immediate reply</span>}
          submitLabel="Approve & send"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Pipeline */

const STAGES = Object.keys(STAGE_META) as PipelineStage[];

export type BoardCard = { action: Data; style?: CSSProperties };

export function PipelineBoard({ columns, counts, clear }: { columns: Record<PipelineStage, BoardCard[]>; counts: Record<PipelineStage, number>; clear: number }) {
  return (
    <HoverPreviewProvider>
      <div className="h-full bg-bg-white-0 px-6 py-6">
        <PageHeader title="Pipeline" description="Every open lead, by where it stands: waiting on you, waiting on them, or out of follow-ups." />
        <div className="mt-5 grid grid-cols-3 items-start gap-4">
          {STAGES.map((stage) => {
            const meta = STAGE_META[stage];
            const cards = columns[stage];
            return (
              <Frame key={stage} className="min-w-0">
                <header className="flex items-center gap-3 px-3 pb-3 pt-2.5">
                  <StageIcon stage={stage} className="size-9 rounded-xl" iconClassName="size-[18px]" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-label-md text-text-strong-950">{meta.label}</h2>
                    <p className="truncate text-paragraph-xs text-text-sub-600">{meta.detail}</p>
                  </div>
                  <span className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded-lg bg-bg-white-0 px-2 text-label-sm tabular-nums text-text-strong-950 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200">{counts[stage]}</span>
                </header>
                {stage === "needs_action" && clear > 0 && !cards.length ? (
                  <FramePanel className="p-0 sm:p-0" style={{ opacity: clear }}>
                    <EmptyState compact icon={RiCheckDoubleLine} title="Nothing needs attention" description="Every reply has been answered." />
                  </FramePanel>
                ) : (
                  <div className="space-y-2">
                    {cards.map(({ action, style }) => (
                      <div key={String(action.id)} style={style}>
                        <ActionCard action={action} categories={CATEGORIES} now={NOW} busy={false} onOpen={noop} onMutate={async () => true} onClassify={async () => {}} pipeline />
                      </div>
                    ))}
                  </div>
                )}
              </Frame>
            );
          })}
        </div>
      </div>
    </HoverPreviewProvider>
  );
}

export const OMAR: Lead = { id: "omar", name: "Omar Haddad", company: "Stackwise", domain: "stackwise.dev", channel: "email", reply: "Maybe later.", category: "interested", subcategoryId: "s-info", subcategory: "Information Requested", sequence: "Information Requested", step: "Follow-up 3", dueState: "none" };

export { tw };

/** Loads every portrait through Remotion's Img (which holds the frame until it has loaded), so the real avatars never capture blank. */
export function PreloadFaces() {
  return (
    <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }} aria-hidden="true">
      {[...CRM_LEADS, OMAR].map((l) => (
        <Img key={l.id} src={staticFile(`faces/${l.id}.jpg`)} />
      ))}
    </div>
  );
}
