"use client";

import type { ReactNode } from "react";
import { RiArrowRightSLine, RiCheckLine, RiCornerDownLeftLine, RiLinkedinBoxFill, RiMailFill, RiSearchLine, RiSendPlaneLine, RiSparkling2Line, RiTimeLine, RiWhatsappFill } from "@remixicon/react";
import { CRM_CATEGORY_COLOR, HUE } from "@/components/analytics/theme";
import { cn } from "@/utils/cn";
import { Appear, EASE, SceneCard, useTimeline, type Scene } from "./kit";

const ACCENT = HUE.blue;
const TRANSITION = (ms: number, delay = 0) => `all ${ms}ms ${EASE} ${delay}ms`;

/** The same quiet chip the inbox rows wear, without its 10rem cap (the label here is the point). */
function Chip({ colorKey, children, size = "xs" }: { colorKey: keyof typeof CRM_CATEGORY_COLOR; children: ReactNode; size?: "xs" | "sm" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200", size === "sm" ? "h-7 px-2.5 text-label-sm" : "h-5 px-1.5 text-label-xs")}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: CRM_CATEGORY_COLOR[colorKey] }} />
      {children}
    </span>
  );
}

/** Same tokens as the app's Kbd, drawn larger so a press is legible, with a visible pressed state. */
function Key({ children, pressed, wide }: { children: ReactNode; pressed: boolean; wide?: boolean }) {
  return (
    <span
      className={cn("inline-flex h-8 items-center justify-center rounded-lg px-2 text-label-sm ring-1 ring-inset", wide ? "min-w-14" : "min-w-8")}
      style={{
        background: pressed ? "rgb(51 92 255 / 0.1)" : "var(--color-bg-white-0)",
        color: pressed ? ACCENT : "var(--color-text-sub-600)",
        boxShadow: pressed ? `inset 0 0 0 1px rgb(51 92 255 / 0.35)` : "0 2px 0 0 rgb(14 18 27 / 0.08), inset 0 0 0 1px var(--color-stroke-soft-200)",
        transform: pressed ? "translateY(2px)" : "none",
        transition: `transform 120ms ease-out, background 120ms ease-out, color 120ms ease-out, box-shadow 120ms ease-out`,
      }}
    >
      {children}
    </span>
  );
}

function Avatar({ initials, size = 28 }: { initials: string; size?: number }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-full bg-bg-weak-50 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------- 1. classify

const CLASSIFY_TIMES = [500, 1300, 2200, 3000] as const;
const CATEGORY_SET = [
  { key: "interested", label: "Interested" },
  { key: "customer", label: "Customer" },
  { key: "not_interested", label: "Not interested" },
  { key: "other", label: "Other" },
] as const;

function ClassifyScene({ reduced }: { reduced: boolean }) {
  const step = useTimeline(CLASSIFY_TIMES, reduced);
  const reading = step >= 1 && step < 3;
  return (
    <>
      <SceneCard className="absolute left-7 top-8 w-[386px] p-4">
        <div className="flex items-center gap-2.5">
          <Avatar initials="HW" />
          <div className="min-w-0 flex-1">
            <div className="text-label-sm text-text-strong-950">Hannah Weiss</div>
            <div className="text-paragraph-xs text-text-sub-600">Lumen Freight</div>
          </div>
          <span className="inline-flex items-center gap-1 text-paragraph-xs text-text-soft-400">
            <RiLinkedinBoxFill className="size-4" style={{ color: HUE.blue }} aria-hidden="true" />
            09:14
          </span>
        </div>
        <p className="mt-3 text-paragraph-sm text-text-strong-950">Sounds interesting. Could we get on a call Thursday afternoon?</p>
      </SceneCard>

      <div aria-hidden="true" className="absolute left-1/2 top-[150px] flex -translate-x-1/2 flex-col items-center" style={{ opacity: step >= 1 ? 1 : 0, transition: TRANSITION(400) }}>
        <span className="h-4 w-px bg-stroke-soft-200" />
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-bg-white-0 px-2.5 text-label-xs text-text-sub-600 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200">
          <RiSparkling2Line className="size-3.5" style={{ color: ACCENT }} aria-hidden="true" />
          {reading ? "AI is reading the reply" : step >= 3 ? "Classified" : "AI reads every reply"}
        </span>
        <span className="h-4 w-px bg-stroke-soft-200" />
      </div>

      <Appear show={step >= 2} className="absolute left-7 top-[222px] w-[386px]" duration={500}>
        <SceneCard className="p-4">
          <div className="text-label-xs text-text-soft-400">Categories</div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {CATEGORY_SET.map((c) => {
              const chosen = c.key === "interested";
              const dim = step >= 3 && !chosen;
              return (
                <span
                  key={c.key}
                  className={cn("inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-label-xs ring-1 ring-inset", chosen && step >= 3 ? "bg-bg-white-0 text-text-strong-950" : "text-text-sub-600 ring-stroke-soft-200")}
                  style={{
                    opacity: dim ? 0.4 : 1,
                    boxShadow: chosen && step >= 3 ? `inset 0 0 0 1.5px ${CRM_CATEGORY_COLOR.interested}` : undefined,
                    transition: TRANSITION(500),
                  }}
                >
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: CRM_CATEGORY_COLOR[c.key] }} />
                  {c.label}
                </span>
              );
            })}
          </div>
          <div className="mt-4 flex h-8 items-center gap-2 border-t border-stroke-soft-200 pt-3" style={{ minHeight: 44 }}>
            <span className="text-paragraph-xs text-text-soft-400">Stage</span>
            <Appear show={step >= 4} from="scale" duration={450}>
              <Chip colorKey="interested" size="sm">
                Interested · Meeting Requested
              </Chip>
            </Appear>
          </div>
        </SceneCard>
      </Appear>
    </>
  );
}

// ------------------------------------------------------------------ 2. drafts

const DRAFT_TIMES = [500, 1300, 2100, 3000] as const;
const PRICE_COLOR = "rgb(51 92 255 / 0.12)";
const SETUP_COLOR = "rgb(29 175 156 / 0.16)";

function Snippet({ title, line, mark, markColor, lit }: { title: string; line: string; mark: string; markColor: string; lit: boolean }) {
  const [before, after] = line.split(mark);
  return (
    <SceneCard className="h-[112px] w-[190px] p-3">
      <div className="text-label-xs text-text-soft-400">Knowledge · {title}</div>
      <p className="mt-1.5 text-paragraph-xs leading-[18px] text-text-sub-600">
        {before}
        <span className="rounded px-0.5 text-text-strong-950" style={{ background: lit ? markColor : "transparent", transition: TRANSITION(500) }}>
          {mark}
        </span>
        {after}
      </p>
    </SceneCard>
  );
}

function DraftScene({ reduced }: { reduced: boolean }) {
  const step = useTimeline(DRAFT_TIMES, reduced);
  const hl = (color: string) => ({ background: step >= 2 ? color : "transparent", transition: TRANSITION(500, 300) });
  return (
    <>
      <Appear show className="absolute left-5 top-6" from="none">
        <Snippet title="Pricing" line="Team plan: $29 per seat per month, billed annually." mark="$29 per seat per month" markColor={PRICE_COLOR} lit={step >= 1} />
      </Appear>
      <Appear show className="absolute right-5 top-6" from="none">
        <Snippet title="Workspace" line="Connect with OAuth in about two minutes. No app passwords." mark="OAuth in about two minutes" markColor={SETUP_COLOR} lit={step >= 1} />
      </Appear>

      <div aria-hidden="true" className="absolute left-1/2 top-[132px] flex -translate-x-1/2 flex-col items-center" style={{ opacity: step >= 2 ? 1 : 0, transform: `translate(-50%, ${step >= 2 ? 0 : -6}px)`, transition: TRANSITION(450) }}>
        <span className="h-5 w-px bg-stroke-soft-200" />
        <RiArrowRightSLine className="-mt-1.5 size-4 rotate-90 text-text-soft-400" />
      </div>

      <Appear show={step >= 2} className="absolute left-5 right-5 top-[170px]" duration={550}>
        <SceneCard className="p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center gap-1 rounded-md bg-primary-alpha-10 px-1.5 text-label-xs text-primary-base">
              <RiSparkling2Line className="size-3" aria-hidden="true" />
              AI draft
            </span>
            <span className="text-paragraph-xs text-text-soft-400">Reply to Hannah Weiss</span>
          </div>
          <p className="mt-3 text-paragraph-sm text-text-strong-950">
            Hi Hannah, glad to help. The Team plan is <span className="rounded px-0.5" style={hl(PRICE_COLOR)}>$29 per seat per month</span>, billed annually, and connecting Google Workspace takes <span className="rounded px-0.5" style={hl(SETUP_COLOR)}>OAuth in about two minutes</span>.
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-stroke-soft-200 pt-3">
            <span className="inline-flex items-center gap-1.5 text-label-xs text-text-sub-600" style={{ opacity: step >= 3 ? 1 : 0.5, transition: TRANSITION(400) }}>
              <RiTimeLine className="size-4" style={{ color: HUE.amber }} aria-hidden="true" />
              {step >= 3 ? "Awaiting approval" : "Drafting"}
            </span>
            <span
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-label-sm"
              style={{
                background: step >= 4 ? ACCENT : "var(--color-bg-weak-50)",
                color: step >= 4 ? "#fff" : "var(--color-text-soft-400)",
                transition: TRANSITION(450),
              }}
            >
              <RiSendPlaneLine className="size-4" aria-hidden="true" />
              Approve &amp; send
            </span>
          </div>
        </SceneCard>
      </Appear>
      <Appear show={step >= 3} className="absolute inset-x-0 bottom-6 text-center text-paragraph-xs text-text-soft-400" duration={500}>
        Nothing is sent until you approve it
      </Appear>
    </>
  );
}

// ----------------------------------------------------------- 3. reply sequence

const SEQUENCE_TIMES = [500, 1200, 1900, 2600] as const;
const SEQUENCE_STEPS = [
  { name: "Immediate reply", when: "Right away", note: "Answers the request" },
  { name: "Follow-up 1", when: "After 1 day", note: "Checks they saw it" },
  { name: "Follow-up 2", when: "After 3 days", note: "Shares a comparison" },
] as const;

function ReplySequenceScene({ reduced }: { reduced: boolean }) {
  const step = useTimeline(SEQUENCE_TIMES, reduced);
  return (
    <>
      <Appear show className="absolute left-7 top-14 flex items-center gap-2" from="none">
        <span className="text-label-sm text-text-sub-600">Stage</span>
        <Chip colorKey="interested" size="sm">
          Interested · Meeting Requested
        </Chip>
      </Appear>

      <SceneCard className="absolute left-7 top-[112px] w-[386px] px-4 py-5">
        <div className="relative">
          <span aria-hidden="true" className="absolute left-[11px] top-3 w-px bg-stroke-soft-200" style={{ height: 124 }} />
          {SEQUENCE_STEPS.map((s, i) => {
            const shown = step >= i + 1;
            const isDrafted = step >= i + 2;
            return (
              <Appear key={s.name} show={shown} from="up" duration={500} className={cn("relative flex items-start gap-3", i > 0 && "mt-5")}>
                <span
                  aria-hidden="true"
                  className="relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-bg-white-0 text-label-xs ring-1 ring-inset"
                  style={{
                    color: isDrafted ? "#fff" : "var(--color-text-sub-600)",
                    background: isDrafted ? ACCENT : "var(--color-bg-white-0)",
                    boxShadow: isDrafted ? "none" : "inset 0 0 0 1px var(--color-stroke-soft-200)",
                    transition: TRANSITION(450),
                  }}
                >
                  {isDrafted ? <RiCheckLine className="size-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-label-sm text-text-strong-950">{s.name}</div>
                  <div className="text-paragraph-xs text-text-sub-600">
                    {s.when} · {s.note}
                  </div>
                </div>
                <span
                  className="mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-primary-alpha-10 px-1.5 text-label-xs text-primary-base"
                  style={{ opacity: isDrafted ? 1 : 0, transform: isDrafted ? "none" : "scale(0.94)", transition: TRANSITION(450) }}
                >
                  <RiSparkling2Line className="size-3" aria-hidden="true" />
                  Drafted
                </span>
              </Appear>
            );
          })}
        </div>
      </SceneCard>
      <Appear show={step >= 4} className="absolute inset-x-0 bottom-6 text-center text-paragraph-xs text-text-soft-400" duration={500}>
        You review every step before it goes out
      </Appear>
    </>
  );
}

// ------------------------------------------------------------------ 4. keyboard

// Each key is a down/up pair: the selection moves on the press.
// 1-2 J, 3-4 J, 5-6 K, 7-8 Enter, 9-10 ⌘K.
const KEY_TIMES = [450, 650, 1050, 1250, 1650, 1850, 2350, 2550, 3050, 3250] as const;
const ROWS = [
  { name: "Aiko Tanaka", text: "Can you send the security docs?", cat: "interested", sub: "Information Requested", icon: RiMailFill },
  { name: "Hannah Weiss", text: "Could we get on a call Thursday?", cat: "interested", sub: "Meeting Requested", icon: RiLinkedinBoxFill },
  { name: "Rafael Costa", text: "Not a priority until next quarter.", cat: "not_interested", sub: "Not Required Right Now", icon: RiWhatsappFill },
  { name: "Marcus Lindqvist", text: "I'm away until the 12th.", cat: "other", sub: "Out of Office", icon: RiMailFill },
] as const;
const ICON_COLOR = new Map<unknown, string>([[RiMailFill, HUE.orange], [RiLinkedinBoxFill, HUE.blue], [RiWhatsappFill, HUE.green]]);

function KeyboardScene({ reduced }: { reduced: boolean }) {
  const step = useTimeline(KEY_TIMES, reduced);
  const selected = step >= 5 ? 1 : step >= 3 ? 2 : step >= 1 ? 1 : 0;
  // Final frame: the row is open and the palette is up.
  const pressed = (n: number) => !reduced && step === n;
  const open = step >= 7;
  const palette = step >= 9;
  return (
    <>
      <SceneCard className="absolute left-7 top-8 h-[262px] w-[386px] overflow-hidden p-2">
        <div style={{ opacity: open ? 0 : 1, transition: TRANSITION(350) }}>
          {ROWS.map((r, i) => {
            const on = i === selected;
            const Icon = r.icon;
            return (
              <div key={r.name} className="relative flex h-[60px] items-center gap-3 rounded-xl px-3" style={{ background: on ? "var(--color-bg-weak-50)" : "transparent", transition: TRANSITION(300) }}>
                <span aria-hidden="true" className="absolute left-0 top-3 h-[36px] w-[3px] rounded-full" style={{ background: ACCENT, opacity: on ? 1 : 0, transition: TRANSITION(300) }} />
                <Avatar initials={r.name.split(" ").map((p) => p[0]).join("")} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-label-sm text-text-strong-950">{r.name}</span>
                    <Icon className="size-3.5" style={{ color: ICON_COLOR.get(Icon) }} aria-hidden="true" />
                  </div>
                  <div className="truncate text-paragraph-xs text-text-sub-600">{r.text}</div>
                </div>
                <Chip colorKey={r.cat}>{r.sub.length > 14 ? r.sub.split(" ")[0] : r.sub}</Chip>
              </div>
            );
          })}
        </div>

        <div className="absolute inset-0 bg-bg-white-0 p-5" style={{ opacity: open ? (palette ? 0.35 : 1) : 0, transform: open ? "none" : "translateY(10px)", transition: TRANSITION(450) }}>
          <div className="flex items-center gap-2.5">
            <Avatar initials="HW" size={32} />
            <div className="flex-1">
              <div className="text-label-sm text-text-strong-950">Hannah Weiss</div>
              <div className="text-paragraph-xs text-text-sub-600">Lumen Freight</div>
            </div>
            <Chip colorKey="interested">Meeting Requested</Chip>
          </div>
          <p className="mt-4 rounded-xl bg-bg-weak-50 p-3 text-paragraph-sm text-text-strong-950">Could we get on a call Thursday afternoon?</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex h-5 items-center gap-1 rounded-md bg-primary-alpha-10 px-1.5 text-label-xs text-primary-base">
              <RiSparkling2Line className="size-3" aria-hidden="true" />
              AI draft
            </span>
            <span className="text-paragraph-xs text-text-sub-600">Thursday at 3pm works. I will send an invite.</span>
          </div>
        </div>
      </SceneCard>

      <div className="absolute inset-x-0 bottom-9 flex items-center justify-center gap-2" aria-hidden="true">
        <Key pressed={pressed(1) || pressed(3)}>J</Key>
        <Key pressed={pressed(5)}>K</Key>
        <Key pressed={pressed(7)} wide>
          <RiCornerDownLeftLine className="mr-1 size-3.5" />
          Enter
        </Key>
        <Key pressed={pressed(9)} wide>
          ⌘K
        </Key>
      </div>

      <Appear show={palette} from="scale" duration={450} className="absolute left-[70px] top-[64px] z-20 w-[300px]">
        <SceneCard className="overflow-hidden shadow-[0_0_0_1px_rgb(14_18_27/0.08),0_24px_48px_-12px_rgb(14_18_27/0.3)]">
          <div className="flex h-11 items-center gap-2 border-b border-stroke-soft-200 px-3.5 text-paragraph-sm text-text-soft-400">
            <RiSearchLine className="size-4" aria-hidden="true" />
            Search or jump to…
          </div>
          <div className="p-1.5">
            {["Pipeline", "Sequences", "New email campaign"].map((label, i) => (
              <div key={label} className="flex h-9 items-center rounded-lg px-2.5 text-label-sm text-text-strong-950" style={{ background: i === 0 ? "var(--color-bg-weak-50)" : "transparent" }}>
                {label}
                {i === 0 && <RiCornerDownLeftLine className="ml-auto size-4 text-text-soft-400" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </SceneCard>
      </Appear>
    </>
  );
}

export const CRM_SCENES: readonly Scene[] = [ClassifyScene, DraftScene, ReplySequenceScene, KeyboardScene];
