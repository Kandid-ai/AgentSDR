"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  RiCheckboxCircleLine,
  RiChat1Line,
  RiDownloadLine,
  RiLinkedinBoxFill,
  RiPauseCircleLine,
  RiSearchLine,
  RiUserAddLine,
} from "@remixicon/react";
import { HUE } from "@/components/analytics/theme";
import { Bubble, MessageCaption } from "@/components/inbox/shell/Conversation";
import { CategoryChip, DraftChip, InboxAvatar } from "@/components/inbox/shell/InboxShell";
import { cn } from "@/utils/cn";
import { Appear, EASE, SceneCard, useCountUp, useTimeline, type Scene } from "./kit";

const BLUE = HUE.blue;
const BLUE_SOFT = "rgb(51 92 255 / 0.1)";

const ease = (ms: number, props: string[], delay = 0) => props.map((p) => `${p} ${ms}ms ${EASE} ${delay}ms`).join(", ");

/* ------------------------------------------------------------------ */
/* 1. Sequence: invite, accept message, three follow-ups               */
/* ------------------------------------------------------------------ */

// Delays are the real ones: follow-ups go out 1, 2 and 3 days after the step
// before (src/functions/sendFollowUps.ts, lib/linkedin/campaignSequence.ts).
const SEQUENCE_ROWS = [
  { icon: RiUserAddLine, title: "Invite sent", sub: "Note is optional", when: "Day 0" },
  { icon: RiCheckboxCircleLine, title: "Accepted", sub: "Prospect connects", when: "" },
  { icon: RiChat1Line, title: "Accept message", sub: "As soon as they accept", when: "Right away" },
  { icon: RiChat1Line, title: "Follow-up 1", sub: "After the accept message", when: "+1 day" },
  { icon: RiChat1Line, title: "Follow-up 2", sub: "After follow-up 1", when: "+2 days" },
  { icon: RiChat1Line, title: "Follow-up 3", sub: "After follow-up 2", when: "+3 days" },
] as const;

const SEQUENCE_TIMES = [450, 950, 1450, 2000, 2550, 3100] as const;
const ROW_H = 54;

const SequenceReal: Scene = ({ reduced }) => {
  const step = useTimeline(SEQUENCE_TIMES, reduced);
  return (
    <div role="group" aria-label="Sequence: invite, accept message and three follow-ups">
      <SceneCard className="absolute left-12 top-5 h-[360px] w-[344px] px-6 py-4">
        <div className="relative">
          {SEQUENCE_ROWS.map((row, i) => {
            const lit = step > i;
            const Icon = row.icon;
            const isEvent = i === 1;
            return (
              <div key={row.title} className="relative flex items-center gap-3.5" style={{ height: ROW_H }}>
                {i < SEQUENCE_ROWS.length - 1 && (
                  <span aria-hidden="true" className="absolute left-[15px] top-[35px] w-0.5 rounded-full bg-stroke-soft-200" style={{ height: ROW_H - 28 }}>
                    <span
                      className="absolute inset-x-0 top-0 rounded-full"
                      style={{ backgroundColor: BLUE, height: step > i + 1 ? "100%" : "0%", transition: ease(450, ["height"]) }}
                    />
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center ring-1 ring-inset", isEvent ? "rounded-full" : "rounded-lg")}
                  style={{
                    backgroundColor: lit ? (isEvent ? BLUE : BLUE_SOFT) : "var(--bg-weak-50, #f6f8fa)",
                    color: lit ? (isEvent ? "#fff" : BLUE) : "#a3a8b1",
                    boxShadow: lit ? "none" : undefined,
                    transform: lit ? "scale(1)" : "scale(0.96)",
                    transition: ease(450, ["background-color", "color", "transform"]),
                  }}
                >
                  <Icon className="size-[17px]" />
                </span>
                <span className="min-w-0 flex-1" style={{ opacity: lit ? 1 : 0.5, transition: ease(450, ["opacity"]) }}>
                  <span className="block text-label-sm text-text-strong-950">{row.title}</span>
                  <span className="block truncate text-paragraph-xs text-text-sub-600">{row.sub}</span>
                </span>
                {row.when && (
                  <span
                    className="shrink-0 rounded-md px-2 py-0.5 text-label-xs tabular-nums ring-1 ring-inset"
                    style={{
                      backgroundColor: lit && i >= 3 ? BLUE_SOFT : "transparent",
                      color: lit && i >= 3 ? BLUE : "#525866",
                      opacity: lit ? 1 : 0.5,
                      transition: ease(450, ["background-color", "color", "opacity"]),
                    }}
                  >
                    {row.when}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </SceneCard>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2. Safe pacing                                                      */
/* ------------------------------------------------------------------ */

// Real numbers: 30/day premium, 5/day free; an account sends in sessions of
// 3-4 invites with 30-60 s between them (src/functions/sendInvitations.ts), and
// only inside the account's working hours (default Mon-Sat 09:00-18:00,
// src/lib/linkedin/workingHours.ts, src/jobs/runOutreach.ts).
const PACING_TIMES = [500, 1100, 1700, 2700] as const;
const PACING_INVITES = [
  { name: "Hannah Weiss", gap: "42 s later" },
  { name: "Rafael Costa", gap: "51 s later" },
  { name: "Aiko Tanaka", gap: "36 s later" },
] as const;
const PACING_START = 14;

const PacingReal: Scene = ({ reduced }) => {
  const step = useTimeline(PACING_TIMES, reduced);
  const sent = Math.min(step, 3);
  const count = PACING_START + sent;
  const outside = step >= 4;
  const markerPct = outside ? (19.5 / 24) * 100 : (10.7 / 24) * 100;
  return (
    <div role="group" aria-label="Safe pacing: 30 invites a day on premium, 5 on free, inside working hours">
      <SceneCard className="absolute left-3 top-4 h-[368px] w-[416px] px-5 py-[18px]">
        {/* daily counter */}
        <div className="flex items-baseline justify-between">
          <span className="text-label-sm text-text-sub-600">Invites today</span>
          <span className="rounded-md bg-bg-weak-50 px-1.5 py-0.5 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">Premium</span>
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[30px] font-medium leading-9 tabular-nums text-text-strong-950">{count}</span>
          <span className="text-label-md tabular-nums text-text-soft-400">/ 30</span>
        </div>
        <div className="relative mt-3 h-2 rounded-full bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200">
          <div className="h-full rounded-full" style={{ width: `${(count / 30) * 100}%`, backgroundColor: BLUE, transition: ease(500, ["width"]) }} />
          <span aria-hidden="true" className="absolute -top-1 h-4 w-0.5 rounded-full bg-text-strong-950" style={{ left: `${(5 / 30) * 100}%` }} />
        </div>
        <div className="relative mt-1.5 h-4 text-paragraph-xs text-text-sub-600">
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(5 / 30) * 100}%` }}>Free limit: 5</span>
        </div>

        {/* invites leaving */}
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-label-sm text-text-sub-600">Sending</span>
          <span className="text-paragraph-xs text-text-soft-400">30–60 s apart, randomised</span>
        </div>
        <div className="mt-1.5" style={{ opacity: outside ? 0.6 : 1, transition: ease(500, ["opacity"]) }}>
          {PACING_INVITES.map((inv, i) => (
            <Appear key={inv.name} show={step > i} from="up" duration={450} className="flex h-9 items-center gap-2.5 border-b border-stroke-soft-200 last:border-b-0">
              <InboxAvatar name={inv.name} size="xs" />
              <span className="flex-1 truncate text-label-sm text-text-strong-950">{inv.name}</span>
              <span className="text-paragraph-xs tabular-nums text-text-soft-400">{i === 0 ? "09:41" : inv.gap}</span>
              <RiUserAddLine className="size-4 shrink-0" style={{ color: BLUE }} aria-hidden="true" />
            </Appear>
          ))}
          {/* reserve the space so the card below does not jump */}
          <div style={{ height: (3 - Math.min(step, 3)) * 36 }} aria-hidden="true" className="transition-[height] duration-500" />
        </div>

        {/* working hours */}
        <div className="absolute inset-x-5 bottom-[18px]">
          <div className="flex items-center justify-between">
            <span className="text-label-sm text-text-sub-600">Working hours</span>
            <span className="inline-flex items-center gap-1.5 text-label-xs text-text-sub-600">
              {outside ? <RiPauseCircleLine className="size-4 text-text-soft-400" aria-hidden="true" /> : <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: HUE.green }} />}
              {outside ? "19:30 · Paused until 09:00" : "10:42 · Sending"}
            </span>
          </div>
          <div className="relative mt-3.5 h-3 rounded-full bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200">
            <span aria-hidden="true" className="absolute inset-y-0 rounded-full" style={{ left: `${(9 / 24) * 100}%`, width: `${(9 / 24) * 100}%`, backgroundColor: BLUE_SOFT, boxShadow: `inset 0 0 0 1px ${BLUE}55` }} />
            <span
              aria-hidden="true"
              className="absolute -top-1.5 h-6 w-0.5 rounded-full bg-text-strong-950"
              style={{ left: `${markerPct}%`, transition: ease(800, ["left"]) }}
            >
            </span>
          </div>
          <div className="relative mt-1.5 h-4 text-paragraph-xs tabular-nums text-text-soft-400">
            {[
              { h: 0, t: "00:00", a: "left-0" },
              { h: 9, t: "09:00", a: "-translate-x-1/2" },
              { h: 18, t: "18:00", a: "-translate-x-1/2" },
              { h: 24, t: "24:00", a: "right-0" },
            ].map((l) => (
              <span key={l.t} className={cn("absolute", l.a)} style={l.a.includes("translate") ? { left: `${(l.h / 24) * 100}%` } : undefined}>{l.t}</span>
            ))}
          </div>
        </div>
      </SceneCard>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 3. Search batches                                                   */
/* ------------------------------------------------------------------ */

// Real: an account pulls up to 400 search leads a day (DAILY_SEARCH_LEAD_LIMIT).
// A batch's leads are exported to .xlsx and imported into a campaign; there is
// no direct "add to campaign" button, so the scene ends on the export.
const SEARCH_TIMES = [500, 1000, 1500, 2000, 2500] as const;
const SEARCH_LEADS = [
  { name: "Hannah Weiss", role: "Head of Growth", company: "Lumen Freight" },
  { name: "Rafael Costa", role: "VP Sales", company: "Brightloop" },
  { name: "Aiko Tanaka", role: "Growth Lead", company: "Kestrel Health" },
  { name: "Marcus Lindqvist", role: "Partner", company: "Oakridge Capital" },
] as const;

const SearchReal: Scene = ({ reduced }) => {
  const step = useTimeline(SEARCH_TIMES, reduced);
  const used = useCountUp(248, 312, step >= 1, 2000, reduced);
  return (
    <div role="group" aria-label="Search batches: up to 400 leads a day per account">
      {/* the search URL */}
      <SceneCard className="absolute left-3 top-4 flex h-[52px] w-[416px] items-center gap-2.5 px-3.5">
        <RiLinkedinBoxFill className="size-5 shrink-0" style={{ color: BLUE }} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-paragraph-sm text-text-sub-600">linkedin.com/search/results/people/?keywords=head+of+growth</span>
        <RiSearchLine className="size-4 shrink-0 text-text-soft-400" aria-hidden="true" />
      </SceneCard>

      {/* the leads it produced */}
      <SceneCard className="absolute left-3 top-[84px] h-[300px] w-[416px] px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-label-sm text-text-strong-950">Leads from this search</span>
          <span className="text-label-xs tabular-nums text-text-sub-600">{used} / 400 today</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200">
          <div className="h-full rounded-full" style={{ width: `${(used / 400) * 100}%`, backgroundColor: BLUE }} />
        </div>
        <div className="mt-2">
          {SEARCH_LEADS.map((lead, i) => (
            <Appear key={lead.name} show={step > i} from="up" duration={450} className="flex h-[46px] items-center gap-3 border-b border-stroke-soft-200 last:border-b-0">
              <InboxAvatar name={lead.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-label-sm text-text-strong-950">{lead.name}</span>
                <span className="block truncate text-paragraph-xs text-text-sub-600">{lead.role} · {lead.company}</span>
              </span>
            </Appear>
          ))}
        </div>
        <Appear show={step >= 5} from="up" duration={450} className="absolute inset-x-4 bottom-3.5 flex items-center justify-between">
          <span className="text-paragraph-xs text-text-sub-600">Import the export into a campaign</span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-label-sm text-white" style={{ backgroundColor: BLUE }}>
            <RiDownloadLine className="size-4" aria-hidden="true" />
            Export leads
          </span>
        </Appear>
      </SceneCard>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 4. Replies inbox                                                    */
/* ------------------------------------------------------------------ */

const REPLY_TIMES = [500, 1100, 1700, 2300, 3000] as const;
const HANNAH_REPLY = "This is timely. Could you do Thursday afternoon?";
const HANNAH_DRAFT = "Thursday works — I've held 3:00pm CET and sent the invite to your inbox. I'll bring the reply-rate numbers from teams your size.";

function ThreadRow({ name, snippet, time, children, style, tall }: { name: string; snippet: string; time: string; children?: ReactNode; style?: CSSProperties; tall?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-3.5", tall ? "h-[72px]" : "h-12")} style={style}>
      <InboxAvatar name={name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label-sm text-text-strong-950">{name}</span>
        <span className="block truncate text-paragraph-xs text-text-sub-600">{snippet}</span>
        {children}
      </span>
      <span className="shrink-0 text-paragraph-xs tabular-nums text-text-soft-400">{time}</span>
    </div>
  );
}

const RepliesReal: Scene = ({ reduced }) => {
  const step = useTimeline(REPLY_TIMES, reduced);
  return (
    <div role="group" aria-label="Replies inbox: every LinkedIn reply in one thread view, AI draft ready">
      <SceneCard className="absolute left-3 top-4 w-[416px] overflow-hidden">
        <div
          className="grid"
          style={{ gridTemplateRows: step >= 1 ? "1fr" : "0fr", transition: ease(450, ["grid-template-rows"]) }}
        >
          <div className="min-h-0 overflow-hidden">
            <div style={{ opacity: step >= 1 ? 1 : 0, transition: ease(450, ["opacity"], 120), backgroundColor: step >= 1 ? "rgb(51 92 255 / 0.05)" : undefined }}>
              <ThreadRow tall name="Hannah Weiss" snippet={HANNAH_REPLY} time="14m">
                <span className="mt-1 flex items-center gap-1.5" style={{ opacity: step >= 2 ? 1 : 0, transition: ease(400, ["opacity"]) }}>
                  <CategoryChip categoryKey="interested" label="Meeting Requested" />
                  <span style={{ opacity: step >= 3 ? 1 : 0, transition: ease(400, ["opacity"]) }}><DraftChip /></span>
                </span>
              </ThreadRow>
            </div>
          </div>
        </div>
        <div className="border-t border-stroke-soft-200">
          <ThreadRow name="Rafael Costa" snippet="Interesting. Does it work with our own Google Workspace…" time="52m" />
        </div>
        <div className="border-t border-stroke-soft-200">
          <ThreadRow name="Aiko Tanaka" snippet="I've moved teams — Daniel runs growth now." time="1h" />
        </div>
      </SceneCard>

      <SceneCard className="absolute left-3 top-[196px] w-[416px] px-4 py-3.5">
        <div style={{ opacity: step >= 1 ? 1 : 0, transition: ease(450, ["opacity"], 200) }}>
          <MessageCaption outbound={false} who="Hannah Weiss" detail="LinkedIn" time="14m" />
          <Bubble outbound={false}>{HANNAH_REPLY}</Bubble>
        </div>
        <Appear show={step >= 4} from="up" duration={500} className="mt-2.5">
          <div className="rounded-xl bg-bg-white-0 p-3 ring-1 ring-inset ring-stroke-soft-200">
            <div className="mb-1.5 flex items-center gap-1.5">
              <DraftChip label="AI draft" />
              <span className="text-paragraph-xs text-text-soft-400">Edit freely, then send</span>
            </div>
            <p className="line-clamp-2 text-paragraph-sm text-text-strong-950">{HANNAH_DRAFT}</p>
          </div>
        </Appear>
      </SceneCard>
    </div>
  );
};

export const LINKEDIN_SCENES: readonly Scene[] = [SequenceReal, PacingReal, SearchReal, RepliesReal];
