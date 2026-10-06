"use client";

import { createElement, useState, type ComponentType } from "react";
import {
  RiCalendarLine,
  RiArrowDownSLine,
  RiDashboard3Line,
  RiDraftLine,
  RiCheckDoubleLine,
  RiErrorWarningLine,
  RiPhoneLine,
  RiInboxLine,
  RiRefreshLine,
  RiTimeLine,
  RiUserSearchLine,
  RiSparkling2Line,
} from "@remixicon/react";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { StatusDotBadge } from "@/components/analytics/kit/StatusDotBadge";
import { Avatar, CallStatusBadge, CampaignStatusBadge } from "@/components/calling/callingShared";
import type { ContactCallStatus } from "@/lib/calls/contract";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { CHANNEL_META } from "@/components/analytics/theme";
import { views, type ViewProps } from "@/components/analytics/views";
import { ActionRows } from "@/components/crm/CrmActionsClient";
import { Bubble, ChatComposer, ComposerDraftBanner, ComposerDock, DaySeparator, MessageCaption } from "@/components/inbox/shell/Conversation";
import { ContactDetails } from "@/components/inbox/shell/DetailsPanel";
import { CategoryChip, ConversationRow, DraftChip, HeaderAction, InboxAvatar, ListPane, ListSearch, ReadingPane, ThreadHeader, TriageTabs } from "@/components/inbox/shell/InboxShell";
import CampaignListClient from "@/components/outreach/CampaignListClient";
import { ANALYTICS_CHANNELS, type AnalyticsView } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { EMAIL, LINKEDIN, OVERVIEW, WHATSAPP } from "./data/analytics";
import { actionRows, CATEGORIES } from "./data/crm";
import { THREADS } from "./data/inbox";
import styles from "./landing.module.css";
import { useMounted } from "./Reveal";

/**
 * The real app screens the landing page shows, each fed sample data shaped
 * by the real contracts. Anything that prints a relative time ("2h ago")
 * renders after mount so the server and client HTML agree.
 */

const DATA = { overview: OVERVIEW, email: EMAIL, linkedin: LINKEDIN, whatsapp: WHATSAPP } as const;

const VIEW_TABS: Array<{ view: AnalyticsView; label: string; icon: ComponentType<{ className?: string }>; color?: string }> = [
  { view: "overview", label: "Overview", icon: RiDashboard3Line },
  ...ANALYTICS_CHANNELS.map((channel) => ({ view: channel, label: CHANNEL_META[channel].label, icon: CHANNEL_META[channel].icon, color: CHANNEL_META[channel].color })),
];

/** A screen's title block, as PageHeader draws it (a <p>, so the landing page keeps one <h1>). */
function ScreenHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-title-h5 text-text-strong-950">{title}</p>
        <p className="mt-1 max-w-2xl text-paragraph-sm text-text-sub-600">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 self-start">{actions}</div>}
    </div>
  );
}

const fakeControl = "flex h-9 shrink-0 items-center gap-2 rounded-lg bg-bg-white-0 px-3 text-label-sm text-text-strong-950 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200";

/** The Analytics page: its header, view tabs and the real view for the tab, over sample data. */
export function AnalyticsScreen({ view, onView }: { view: AnalyticsView; onView: (view: AnalyticsView) => void }) {
  const View = views[view] as unknown as ComponentType<ViewProps<AnalyticsView>>;
  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <ScreenHeader
        title="Analytics"
        description="How conversations turn into meetings and customers, and which channels bring them in."
        actions={
          <>
            <span className={fakeControl}>
              <RiCalendarLine className="size-4 text-text-sub-600" aria-hidden="true" />
              Last 4 weeks
              <span className="hidden text-text-sub-600 sm:inline">· 2 Sep – 29 Sep</span>
              <RiArrowDownSLine className="size-4 text-text-soft-400" aria-hidden="true" />
            </span>
            <span className={cn(fakeControl, "w-9 justify-center px-0")} aria-hidden="true">
              <RiRefreshLine className="size-4 text-text-sub-600" />
            </span>
          </>
        }
      />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-stroke-soft-200">
        <div role="tablist" aria-label="Analytics views" className="-mb-px flex gap-5 overflow-x-auto [scrollbar-width:none]">
          {VIEW_TABS.map(({ view: tabView, label, icon: Icon, color }) => {
            const active = tabView === view;
            return (
              <button key={tabView} role="tab" type="button" aria-selected={active} onClick={() => onView(tabView)} className={cn("relative flex h-10 shrink-0 items-center gap-2 text-label-sm outline-none transition-colors focus-visible:text-text-strong-950", active ? "text-text-strong-950" : "text-text-sub-600 hover:text-text-strong-950")}>
                <span aria-hidden="true" className={cn("flex transition-opacity", color ? !active && "opacity-70" : active ? "text-text-strong-950" : "text-text-soft-400")} style={color ? { color } : undefined}>
                  <Icon className="size-[18px] shrink-0" />
                </span>
                {label}
                <span className={cn("absolute inset-x-0 bottom-0 h-0.5 rounded-full", active ? "bg-primary-base" : "bg-transparent")} />
              </button>
            );
          })}
        </div>
        <p className="hidden pb-2 text-paragraph-xs text-text-soft-400 sm:block">Sample data</p>
      </div>
      <div key={view} role="tabpanel" className={cn("mt-6", styles.screenIn)}>
        {createElement(View, { data: DATA[view], loading: false, onSelectView: onView })}
      </div>
    </div>
  );
}

/** Action required: the CRM's queue — real KPI strip and the real ActionRows, over sample rows. */
export function ActionsScreen() {
  const mounted = useMounted();
  const [now] = useState(() => Date.now());
  const [rows, setRows] = useState(() => actionRows(now));
  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6">
      <ScreenHeader title="Action required" description="Every reply the AI has classified, with the answer it drafted. Approve, edit or reclassify." />
      <KpiStrip className="mt-6" columns={4}>
        <KpiCell icon={RiInboxLine} label="In the queue" value="23" context="replies and follow-ups due" />
        <KpiCell icon={RiDraftLine} label="Drafts to review" value="11" context="written by your model" />
        <KpiCell icon={RiTimeLine} label="Follow-ups due" value="4" context="past their due date" />
        <KpiCell icon={RiErrorWarningLine} label="Errors" value="0" context="nothing failed today" />
      </KpiStrip>
      <Frame className="mt-5">
        <FrameHeader title="Queue" description="Newest reply first. Hover a reply or a draft to read it whole." />
        <FramePanel className="p-0 sm:p-0">
          {mounted ? (
            <ActionRows actions={rows} categories={CATEGORIES} onActionsChange={setRows} empty={{ icon: RiInboxLine, title: "All clear", detail: "Nothing needs you right now." }} />
          ) : (
            <div className="h-[420px]" />
          )}
        </FramePanel>
      </Frame>
    </div>
  );
}

type Campaigns = React.ComponentProps<typeof CampaignListClient>["campaigns"];

function sampleCampaigns(now: number): Campaigns {
  const day = 86_400_000;
  const step = (n: number) => Array.from({ length: n }, (_, i) => ({ stepNumber: i + 1, subject: "", body: "", waitDays: i === 0 ? 0 : 3 }));
  const c = (id: string, name: string, status: "active" | "paused" | "draft" | "completed", steps: number, createdDaysAgo: number, leadCount: number, sentCount: number, repliedCount: number, lastMinutesAgo: number | null) => ({
    id,
    organizationId: "demo",
    name,
    status,
    sequence: step(steps),
    createdAt: new Date(now - createdDaysAgo * day),
    updatedAt: new Date(now - createdDaysAgo * day),
    leadCount,
    sentCount,
    repliedCount,
    replyRate: leadCount ? repliedCount / leadCount : null,
    progress: status === "draft" ? null : Math.min(1, sentCount / (leadCount * steps)),
    lastActivityAt: lastMinutesAgo === null ? null : new Date(now - lastMinutesAgo * 60_000),
  });
  return [
    c("c1", "Series A SaaS · Heads of Growth", "active", 4, 23, 1_240, 2_318, 46, 12),
    c("c2", "Agencies · Founders (EU)", "active", 3, 17, 860, 1_406, 31, 26),
    c("c3", "RevOps leaders · follow-up", "active", 3, 12, 420, 902, 22, 48),
    c("c4", "Webinar attendees · Sept", "paused", 2, 9, 310, 244, 12, 60 * 50),
    c("c5", "Dev-tools CTOs · pilot", "completed", 3, 41, 180, 540, 7, 60 * 24 * 6),
    c("c6", "Q4 · Logistics ops leaders", "draft", 4, 1, 612, 0, 0, null),
  ];
}

/** Email campaigns: the real campaign list page. */
export function CampaignsScreen() {
  const mounted = useMounted();
  const [campaigns] = useState(() => sampleCampaigns(Date.now()));
  // The page's own title is its only <h1>; the campaign list's header is a sub-heading here.
  const demote = (el: HTMLDivElement | null) => {
    el?.querySelectorAll("h1").forEach((h) => {
      h.setAttribute("role", "heading");
      h.setAttribute("aria-level", "3");
    });
  };
  if (!mounted) return <div className="h-[560px]" />;
  return (
    <div ref={demote} className="[&>div]:px-4 [&>div]:py-5 sm:[&>div]:px-6 sm:[&>div]:py-6 lg:[&>div]:px-8">
      <CampaignListClient campaigns={campaigns} />
    </div>
  );
}

function ago(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

/** LinkedIn Messages: the real inbox shell's list, thread, AI-draft composer and details column. */
export function InboxScreen({ showDetails = true }: { showDetails?: boolean }) {
  const mounted = useMounted();
  const [selected, setSelected] = useState(THREADS[0].id);
  // Below md one pane shows at a time, as in the app: the list, then the thread once one is picked.
  const [picked, setPicked] = useState(false);
  const [tab, setTab] = useState("replied");
  const thread = THREADS.find((t) => t.id === selected) ?? THREADS[0];
  const [text, setText] = useState(THREADS[0].draft ?? "");
  const [now] = useState(() => Date.now());

  const select = (id: string) => {
    setSelected(id);
    setPicked(true);
    setText(THREADS.find((t) => t.id === id)?.draft ?? "");
  };

  if (!mounted) return <div className="h-full" />;
  return (
    <div className="flex h-full min-h-0">
      <div data-showcase-allow className="contents">
        <ListPane
          label="Conversations"
          hidden={picked}
          className="md:w-72 xl:w-80"
          toolbar={<ListSearch value="" onChange={() => {}} placeholder="Search conversations" label="Search conversations" />}
          tabs={<TriageTabs label="Show conversations" value={tab} onChange={setTab} tabs={[{ key: "replied", label: "Replied", count: 171 }, { key: "unreplied", label: "Needs reply", count: 23 }, { key: "all", label: "All", count: 1902 }]} />}
        >
          {THREADS.map((t) => {
            const meta = CHANNEL_META[t.channel];
            const Icon = meta.icon;
            return (
              <ConversationRow
                key={t.id}
                selected={t.id === selected}
                unread={t.unread}
                onSelect={() => select(t.id)}
                avatar={<InboxAvatar name={t.name} />}
                accent={
                  <span className="flex size-4 items-center justify-center rounded-full text-static-white ring-2 ring-bg-white-0" style={{ backgroundColor: meta.color }}>
                    <Icon className="size-2.5" />
                  </span>
                }
                title={t.name}
                subtitle={t.company}
                time={ago(t.minutesAgo)}
                headline={t.subject}
                snippet={t.messages[t.messages.length - 1].text}
                meta={
                  <>
                    <CategoryChip categoryKey={t.categoryKey} label={t.category} />
                    {t.draft && <DraftChip />}
                  </>
                }
              />
            );
          })}
        </ListPane>
      </div>
      <ReadingPane
        shown={picked}
        aside={
          showDetails ? (
            <aside aria-label="Contact details" className="hidden w-72 shrink-0 flex-col overflow-hidden border-l border-stroke-soft-200 bg-bg-white-0 2xl:flex">
              <ContactDetails
                name={thread.name}
                headline={thread.headline}
                company={{ name: thread.company }}
                channel={thread.channel}
                links={{}}
                crm={{ recordId: null, categoryKey: thread.categoryKey, categoryLabel: thread.category, sequence: thread.sequence ?? null, step: thread.step ?? null }}
                facts={[{ label: "Campaign", value: "Heads of Growth · US" }, { label: "Sent from", value: "Maya Brandt" }]}
              />
            </aside>
          ) : undefined
        }
      >
        <div data-showcase-allow className="contents">
        <ThreadHeader
          onBack={() => setPicked(false)}
          avatar={<InboxAvatar name={thread.name} />}
          title={thread.name}
          badges={<CategoryChip categoryKey={thread.categoryKey} label={thread.category} />}
          channel={thread.channel}
          subtitle={thread.headline}
          actions={<HeaderAction icon={RiUserSearchLine} label="CRM record" />}
        />
        </div>
        <div key={thread.id} className={cn("min-h-0 flex-1 overflow-hidden px-3 py-4 sm:px-5", styles.screenIn)}>
          <DaySeparator date={new Date(now - thread.messages[0].minutesAgo * 60_000)} />
          <div className="space-y-3">
            {thread.messages.map((m, i) => (
              <div key={i} className={cn("flex flex-col", m.outbound ? "items-end" : "items-start")}>
                <MessageCaption outbound={m.outbound} who={m.outbound ? "You" : thread.name.split(" ")[0]} detail={m.via} time={ago(m.minutesAgo) + " ago"} />
                <Bubble outbound={m.outbound}>{m.text}</Bubble>
              </div>
            ))}
          </div>
        </div>
        <ComposerDock>
          <div data-showcase-allow>
            <ChatComposer
              value={text}
              onChange={setText}
              onSubmit={() => {}}
              tone={thread.draft ? "draft" : "default"}
              minRows={2}
              placeholder={`Reply to ${thread.name.split(" ")[0]}…`}
              banner={thread.draft && text === thread.draft ? <ComposerDraftBanner onClear={() => setText("")} note="Drafted from your knowledge base — approve to send." /> : undefined}
              meta={
                <span className="inline-flex items-center gap-1">
                  <RiSparkling2Line className="size-3.5 text-primary-base" aria-hidden="true" />
                  {thread.sequence ? `${thread.sequence} · ${thread.step}` : "Reply in your own words"}
                </span>
              }
              submitLabel="Approve & send"
            />
          </div>
        </ComposerDock>
      </ReadingPane>
    </div>
  );
}


const CALL_CONTACTS: Array<{ name: string; role: string; status: ContactCallStatus; attempt?: string; last: string; next: string }> = [
  { name: "Aiko Tanaka", role: "Growth Lead @ Kestrel Health", status: "connected", last: "Today, 11:42 · 4m 12s", next: "Send recap" },
  { name: "Samir Haddad", role: "COO @ Parcelly", status: "no_answer", attempt: "Attempt 2 of 4", last: "Today, 11:20", next: "Retry in 2 days" },
  { name: "Hannah Weiss", role: "Head of Growth @ Lumen Freight", status: "connected", last: "Today, 10:58 · 6m 40s", next: "Meeting booked" },
  { name: "Rafael Costa", role: "VP Sales @ Brightloop", status: "busy", attempt: "Attempt 1 of 4", last: "Today, 10:31", next: "Retry tomorrow" },
  { name: "Chloé Martin", role: "Founder @ Atelier Nord", status: "new", last: "—", next: "Due today" },
  { name: "Marcus Lindqvist", role: "Partner @ Oakridge Capital", status: "new", last: "—", next: "Due today" },
];

/** A WhatsApp call campaign: the real KPI strip, call-status badges and avatars, and a call in progress with its transcript. */
export function CallsScreen() {
  const wa = CHANNEL_META.whatsapp.color;
  return (
    <div className="relative px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-title-h5 text-text-strong-950">Demo no-shows · call back</p>
            <CampaignStatusBadge status="active" />
          </div>
          <p className="mt-1 text-paragraph-sm text-text-sub-600">Calls placed from AgentSDR, dialled and recorded in WhatsApp Web.</p>
        </div>
      </div>
      <KpiStrip className="mt-6" columns={4}>
        <KpiCell icon={RiUserSearchLine} label="Leads" value="120" context="in this campaign" />
        <KpiCell icon={RiPhoneLine} label="Calls placed" value="214" context="last 4 weeks" />
        <KpiCell icon={RiCheckDoubleLine} label="Connected" value="91" context="43% connect rate" />
        <KpiCell icon={RiTimeLine} label="Due today" value="8" context="first calls and retries" />
      </KpiStrip>
      <Frame className="mt-5">
        <FrameHeader title="Contacts" description="Who to call next, and how each call went." />
        <FramePanel className="p-0 sm:p-0">
          <ul className="divide-y divide-stroke-soft-200">
            {CALL_CONTACTS.map((c) => (
              <li key={c.name} className="flex items-center gap-3 px-4 py-3">
                <CallAvatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label-sm text-text-strong-950">{c.name}</p>
                  <p className="truncate text-paragraph-xs text-text-sub-600">{c.role}</p>
                </div>
                <div className="hidden w-40 shrink-0 sm:block">
                  <CallStatusBadge status={c.status} />
                  {c.attempt && <p className="mt-1 text-paragraph-xs text-text-soft-400">{c.attempt}</p>}
                </div>
                <p className="hidden w-40 shrink-0 text-paragraph-xs text-text-sub-600 md:block">{c.last}</p>
                <p className="hidden w-28 shrink-0 text-right text-paragraph-xs text-text-sub-600 lg:block">{c.next}</p>
              </li>
            ))}
          </ul>
        </FramePanel>
      </Frame>

      {/* A call in progress, with its transcript */}
      <div className="absolute bottom-6 right-4 z-20 w-[300px] max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl bg-bg-white-0 shadow-[0_24px_48px_-12px_rgb(14_18_27/0.28),0_0_0_1px_rgb(14_18_27/0.08)] sm:right-6">
        <div className="flex items-center gap-3 border-b border-stroke-soft-200 px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: wa }}>
            <RiPhoneLine className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-label-sm text-text-strong-950">Aiko Tanaka</p>
            <p className="flex items-center gap-1.5 text-paragraph-xs text-text-sub-600">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-[#fb3748]" /> Recording · 04:12
            </p>
          </div>
          <StatusDotBadge status="good">On call</StatusDotBadge>
        </div>
        <div className="space-y-2 px-4 py-3">
          <div className="flex flex-col items-end">
            <MessageCaption outbound who="Rep" time="0:08" />
            <Bubble outbound className="text-[13px]">Is now still a good time? Two minutes on follow-ups.</Bubble>
          </div>
          <div className="flex flex-col items-start">
            <MessageCaption outbound={false} who="Lead" time="0:15" />
            <Bubble outbound={false} className="text-[13px]">Sure — most of ours never get sent.</Bubble>
          </div>
        </div>
      </div>
    </div>
  );
}

function CallAvatar({ name }: { name: string }) {
  return <Avatar name={name} className="size-9" />;
}
