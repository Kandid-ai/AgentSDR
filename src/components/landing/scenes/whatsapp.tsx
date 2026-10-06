"use client";

import type { CSSProperties } from "react";
import { RiCheckLine, RiCloudLine, RiForbidLine, RiPhoneFill, RiPuzzleLine, RiTimeLine, RiWhatsappFill } from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import { HUE } from "@/components/analytics/theme";
import { CONTACT_CALL_STATUS_DEFINITIONS, RETRY_AFTER_DAYS } from "@/lib/calls/contract";
import { WHATSAPP_MIN_SECONDS_BETWEEN_SENDS, WHATSAPP_NEW_CHAT_WARMUP_HOURS, WHATSAPP_NEW_CHATS_PER_DAY } from "@/lib/whatsapp/contract";
import { cn } from "@/utils/cn";
import { Appear, ClickRipple, Cursor, EASE, SceneCard, useCountUp, useTimeline, type Scene } from "./kit";

const SOFT_RING = "ring-1 ring-inset ring-stroke-soft-200";

/** Initials in a tinted circle: the people here are fictional, so no photos. */
function Person({ name, tint, size = 36 }: { name: string; tint: string; size?: number }) {
  const initials = name.split(" ").map((part) => part[0]).join("");
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full text-label-xs text-text-strong-950"
      style={{ width: size, height: size, background: tint }}
    >
      {initials}
    </span>
  );
}

/** The call-status chip, drawn from the same definitions CallStatusBadge reads. */
function StatusChip({ status }: { status: "calling" | "no_answer" | "connected" }) {
  const definition = CONTACT_CALL_STATUS_DEFINITIONS[status];
  return (
    <Badge.Root variant="lighter" size="medium" color={definition.tone} className="shrink-0 whitespace-nowrap">
      <Badge.Dot />
      {definition.label}
    </Badge.Root>
  );
}

const fade = (show: boolean, delay = 0, duration = 400): CSSProperties => ({
  opacity: show ? 1 : 0,
  transition: `opacity ${duration}ms ${EASE} ${delay}ms`,
});

/* ------------------------------------------------------------------ */
/* 1. One-click calls                                                  */
/* ------------------------------------------------------------------ */

const CALL_TIMES = [500, 1500, 1750, 2600, 3050, 3500] as const;

const clock = (seconds: number) => `00:${String(seconds).padStart(2, "0")}`;

function CallScene({ reduced }: { reduced: boolean }) {
  const step = useTimeline(CALL_TIMES, reduced);
  const placed = step >= 3;
  const connected = step >= 4;
  const seconds = step >= 6 ? 3 : step >= 5 ? 2 : step >= 4 ? 1 : 0;

  return (
    <>
      <SceneCard className="absolute left-5 top-9 flex h-[76px] w-[400px] items-center gap-3 px-4">
        <Person name="Hannah Weiss" tint="#e4ecff" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-label-sm text-text-strong-950">Hannah Weiss</div>
          <div className="truncate text-paragraph-xs text-text-sub-600">Lumen Freight · +49 30 5550 142</div>
        </div>
        <span
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-label-sm text-white"
          style={{ background: HUE.green, transform: step === 2 ? "scale(0.96)" : "none", transition: `transform 160ms ${EASE}` }}
        >
          <RiPhoneFill className="size-4" aria-hidden="true" />
          Call
        </span>
      </SceneCard>

      {step === 2 && <ClickRipple key="call" x={354} y={74} />}

      <Appear show={placed} from="scale" duration={600} className="absolute left-[90px] top-[160px] w-[260px]">
        <div className="overflow-hidden rounded-2xl text-white shadow-[0_0_0_1px_rgb(14_18_27/0.1),0_16px_40px_-16px_rgb(14_18_27/0.4)]" style={{ background: "#111b21" }}>
          <div className="flex items-center gap-1.5 px-4 pt-3.5 text-paragraph-xs" style={{ color: "#8696a0" }}>
            <RiWhatsappFill className="size-4" style={{ color: HUE.green }} aria-hidden="true" />
            WhatsApp Web
          </div>
          <div className="flex flex-col items-center px-4 pb-5 pt-3">
            <Person name="Hannah Weiss" tint="#e4ecff" size={52} />
            <div className="mt-2.5 text-label-md">Hannah Weiss</div>
            <div className="relative mt-1 h-5 w-full text-center text-paragraph-sm tabular-nums" style={{ color: "#8696a0" }}>
              <span className="absolute inset-x-0" style={fade(!connected)}>Calling…</span>
              <span className="absolute inset-x-0" style={{ ...fade(connected), color: HUE.green }}>{clock(seconds)}</span>
            </div>
          </div>
        </div>
      </Appear>

      <Appear show={placed} delay={350} className="absolute left-0 top-[348px] flex w-full justify-center">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-bg-white-0 px-3 py-1.5 text-paragraph-xs text-text-sub-600", SOFT_RING)}>
          <RiPuzzleLine className="size-3.5" aria-hidden="true" />
          Placed by the AgentSDR extension
        </span>
      </Appear>

      <Cursor x={step >= 1 ? 352 : 300} y={step >= 1 ? 76 : 150} pressed={step === 2} show={step < 3} duration={step >= 1 ? 900 : 0} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Recorded & transcribed                                           */
/* ------------------------------------------------------------------ */

const RECORD_TIMES = [500, 1900, 2300, 3000, 3350] as const;

// A fixed, calm shape per track (no randomness: server and client must agree).
const REP_SEED = [3, 5, 8, 6, 9, 12, 8, 5, 7, 10, 13, 9, 6, 4, 7, 11, 8, 5, 3, 6, 9, 12, 10, 6, 4, 7, 9, 6, 4, 3];
const LEAD_SEED = [2, 2, 4, 6, 4, 3, 7, 10, 12, 9, 6, 4, 3, 2, 5, 8, 11, 8, 5, 3, 2, 4, 7, 9, 6, 4, 2, 3, 5, 3];
// Stretched to the track's width by running the pattern back on itself.
const stretch = (seed: number[]) => [...seed, ...[...seed].reverse()].slice(0, 52);
const REP_BARS = stretch(REP_SEED);
const LEAD_BARS = stretch(LEAD_SEED);

function Track({ label, bars, color, drawn, quiet }: { label: string; bars: number[]; color: string; drawn: boolean; quiet: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-9 text-label-xs text-text-sub-600">{label}</span>
      <div className="flex h-8 flex-1 items-center gap-[3px]" aria-hidden="true">
        {bars.map((height, index) => (
          <span
            key={index}
            className="w-[3px] shrink-0 rounded-full"
            style={{
              height: height * 2,
              background: color,
              opacity: drawn ? (quiet ? 0.55 : 1) : 0.12,
              transition: `opacity 500ms ${EASE} ${drawn && !quiet ? index * 45 : 0}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function RecordingScene({ reduced }: { reduced: boolean }) {
  const step = useTimeline(RECORD_TIMES, reduced);
  const ended = step >= 2;
  const saved = step >= 4;

  return (
    <>
      <SceneCard className="absolute left-5 top-5 w-[400px] px-4 py-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-label-sm text-text-strong-950">Call with Hannah Weiss</span>
          <span className="relative h-5 text-paragraph-xs tabular-nums text-text-sub-600">
            <span className="flex items-center gap-1.5" style={fade(!ended)}>
              <span className="size-2 rounded-full" style={{ background: HUE.red }} />
              Recording
            </span>
            <span className="absolute right-0 top-0 whitespace-nowrap" style={fade(ended)}>Ended · 02:14</span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Track label="Rep" bars={REP_BARS} color={HUE.green} drawn={step >= 1} quiet={ended} />
          <Track label="Lead" bars={LEAD_BARS} color="#525866" drawn={step >= 1} quiet={ended} />
        </div>
      </SceneCard>

      <Appear show={ended} from="up" className="absolute left-5 top-[168px] w-[400px]">
        <div className={cn("flex h-10 items-center gap-2.5 rounded-xl bg-bg-white-0 px-3.5", SOFT_RING)}>
          <span className="relative flex size-5 shrink-0 items-center justify-center">
            <RiCloudLine className="absolute size-5 text-text-sub-600" style={fade(!saved, 0, 300)} aria-hidden="true" />
            <RiCheckLine className="absolute size-5" style={{ ...fade(saved, 0, 300), color: HUE.green }} aria-hidden="true" />
          </span>
          <span className="relative h-5 flex-1 text-paragraph-sm text-text-strong-950">
            <span className="absolute left-0" style={fade(!saved, 0, 300)}>Uploading to your R2 bucket</span>
            <span className="absolute left-0" style={fade(saved, 0, 300)}>Saved to your R2 bucket</span>
          </span>
          <span className="h-1 w-[90px] overflow-hidden rounded-full bg-bg-soft-200" aria-hidden="true">
            <span
              className="block h-full rounded-full"
              style={{ width: step >= 3 ? "100%" : "0%", background: HUE.green, transition: `width 700ms ${EASE}` }}
            />
          </span>
        </div>
      </Appear>

      <Appear show={saved} from="up" className="absolute left-5 top-[224px] w-[400px]">
        <SceneCard className="px-4 py-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-label-sm text-text-strong-950">Transcript</span>
            <span className="text-paragraph-xs text-text-soft-400">written by your model</span>
          </div>
          <div className="flex flex-col gap-2 text-paragraph-sm">
            <p className="flex gap-3">
              <span className="w-9 shrink-0 text-label-xs leading-5" style={{ color: HUE.green }}>Rep</span>
              <span className="text-text-strong-950">Hi Hannah, is now a good time to talk lanes?</span>
            </p>
            <p className="flex gap-3">
              <span className="w-9 shrink-0 text-label-xs leading-5 text-text-sub-600">Lead</span>
              <span className="text-text-strong-950">Yes, send me pricing for Q4.</span>
            </p>
          </div>
          <Appear show={step >= 5} from="up" duration={500}>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-bg-weak-50 px-3 py-2">
              <Badge.Root variant="lighter" size="medium" color="green">Interested</Badge.Root>
              <span className="truncate text-paragraph-xs text-text-sub-600">Wants Q4 pricing, follow up Tuesday</span>
            </div>
          </Appear>
        </SceneCard>
      </Appear>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Retries                                                          */
/* ------------------------------------------------------------------ */

const RETRY_TIMES = [500, 1100, 1550, 2100, 2550, 3100, 3600] as const;

// Each gap counts from the previous call (contactCallStatus.ts), so the calls
// land on days 0, 1, 3 and 7 — not 1, 2 and 4 after the first.
const ATTEMPT_DAYS = RETRY_AFTER_DAYS.reduce<number[]>((days, gap) => [...days, days[days.length - 1] + gap], [0]);

const ROW_H = 70;
const ROW_TOP = 86;

function RetriesScene({ reduced }: { reduced: boolean }) {
  const step = useTimeline(RETRY_TIMES, reduced);
  // Row i appears at step 2i (row 0 from the start); it resolves one step later.
  const shown = (i: number) => i === 0 || step >= i * 2;
  const resolved = (i: number) => step >= i * 2 + 1;
  const attempts = 1 + Math.min(RETRY_AFTER_DAYS.length, Math.floor(step / 2));
  const total = RETRY_AFTER_DAYS.length + 1;
  const last = ATTEMPT_DAYS.length - 1;

  return (
    <SceneCard className="absolute left-5 top-5 h-[360px] w-[400px]">
      <div className="flex items-center gap-3 px-5 pt-4">
        <Person name="Hannah Weiss" tint="#e4ecff" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-label-sm text-text-strong-950">Hannah Weiss</div>
          <div className="truncate text-paragraph-xs text-text-sub-600">Each retry counts from the last call</div>
        </div>
        <span className="whitespace-nowrap text-paragraph-xs tabular-nums text-text-sub-600">
          Attempt {attempts} of {total}
        </span>
      </div>

      {/* the rail the attempts hang on */}
      <span
        aria-hidden="true"
        className="absolute left-[41px] w-px bg-stroke-soft-200"
        style={{ top: ROW_TOP + 10, height: Math.max(0, (attempts - 1) * ROW_H) + 0, transition: `height 500ms ${EASE}` }}
      />

      {ATTEMPT_DAYS.map((day, i) => {
        const answered = i === last;
        return (
          <div key={day}>
            {i > 0 && (
              <Appear
                show={shown(i)}
                from="none"
                className="absolute left-[41px] z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-bg-white-0 px-2 py-0.5 text-paragraph-xs tabular-nums text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200"
                style={{ top: ROW_TOP + (i - 1) * ROW_H + ROW_H / 2 - 2 }}
              >
                +{RETRY_AFTER_DAYS[i - 1]} {RETRY_AFTER_DAYS[i - 1] === 1 ? "day" : "days"}
              </Appear>
            )}
            <Appear show={shown(i)} from="up" className="absolute left-0 flex w-full items-center gap-3 px-8" style={{ top: ROW_TOP + i * ROW_H - 4 }}>
              <span
                className="relative z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full bg-bg-white-0"
                style={{
                  boxShadow: `inset 0 0 0 2px ${resolved(i) ? (answered ? HUE.green : HUE.orange) : "#cdd0d5"}`,
                  transition: `box-shadow 400ms ${EASE}`,
                }}
                aria-hidden="true"
              >
                {resolved(i) && answered && <RiCheckLine className="size-3" style={{ color: HUE.green }} />}
              </span>
              <div className="flex-1">
                <div className="text-label-sm text-text-strong-950">Day {day}</div>
                <div className="text-paragraph-xs text-text-soft-400">Call {i + 1}</div>
              </div>
              <span className="relative h-6 w-[130px]">
                <span className="absolute right-0 top-0" style={fade(!resolved(i), 0, 300)}>
                  <StatusChip status="calling" />
                </span>
                <span className="absolute right-0 top-0" style={fade(resolved(i), 0, 300)}>
                  <StatusChip status={answered ? "connected" : "no_answer"} />
                </span>
              </span>
            </Appear>
          </div>
        );
      })}
    </SceneCard>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Messages                                                         */
/* ------------------------------------------------------------------ */

const MESSAGE_TIMES = [500, 1700, 2100, 2650, 3150, 3550] as const;

type Outreach = { name: string; company: string; tint: string; at: string | null };
const OUTREACH: Outreach[] = [
  { name: "Rafael Costa", company: "Brightloop", tint: "#d0fbe5", at: "0:00" },
  { name: "Aiko Tanaka", company: "Kestrel Health", tint: "#ffe9d0", at: "0:10" },
  { name: "Marcus Lindqvist", company: "Oakridge Capital", tint: "#e4ecff", at: null },
  { name: "Chloé Martin", company: "Atelier Nord", tint: "#ffe0f0", at: "0:20" },
];

function MessagesScene({ reduced }: { reduced: boolean }) {
  const step = useTimeline(MESSAGE_TIMES, reduced);
  const warmed = step >= 2;
  const hours = useCountUp(0, WHATSAPP_NEW_CHAT_WARMUP_HOURS, step >= 1, 900, reduced);
  // Rows resolve at steps 3..6; the skipped lead does not count as a chat.
  const sent = [step >= 3, step >= 4, step >= 6].filter(Boolean).length;
  const counted = sent;

  return (
    <>
      <SceneCard className="absolute left-5 top-5 w-[400px] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full" style={{ background: "#d0fbe5" }} aria-hidden="true">
            <RiWhatsappFill className="size-5" style={{ color: HUE.green }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-label-sm text-text-strong-950">Sales line · +49 30 5550 188</div>
            <div className="relative h-5 text-paragraph-xs text-text-sub-600">
              <span className="absolute left-0 whitespace-nowrap tabular-nums" style={fade(!warmed, 0, 300)}>
                Just linked · warm-up {hours} h of {WHATSAPP_NEW_CHAT_WARMUP_HOURS} h
              </span>
              <span className="absolute left-0 whitespace-nowrap" style={fade(warmed, 0, 300)}>Warm-up done · new chats open</span>
            </div>
          </div>
          <span className="relative flex size-5 items-center justify-center">
            <RiTimeLine className="absolute size-5 text-text-soft-400" style={fade(!warmed, 0, 300)} aria-hidden="true" />
            <RiCheckLine className="absolute size-5" style={{ ...fade(warmed, 0, 300), color: HUE.green }} aria-hidden="true" />
          </span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-bg-soft-200" aria-hidden="true">
          <div
            className="h-full rounded-full"
            style={{ width: step >= 1 ? "100%" : "0%", background: HUE.green, transition: `width 900ms ${EASE}` }}
          />
        </div>
      </SceneCard>

      <Appear show={warmed} from="up" className="absolute left-5 top-[142px] w-[400px]">
        <SceneCard className="px-4 pb-2 pt-3.5">
          <div className="flex items-center justify-between">
            <span className="text-label-sm text-text-strong-950">New chats today</span>
            <span className="text-label-sm tabular-nums text-text-strong-950">
              {counted} <span className="text-text-soft-400">/ {WHATSAPP_NEW_CHATS_PER_DAY}</span>
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-soft-200" aria-hidden="true">
            <div
              className="h-full rounded-full"
              style={{ width: `${(counted / WHATSAPP_NEW_CHATS_PER_DAY) * 100}%`, background: HUE.green, transition: `width 500ms ${EASE}` }}
            />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-paragraph-xs text-text-sub-600">
            <RiTimeLine className="size-3.5" aria-hidden="true" />
            {WHATSAPP_MIN_SECONDS_BETWEEN_SENDS} s between sends
          </div>

          <div className="mt-1.5">
            {OUTREACH.map((lead, i) => {
              const skipped = lead.at === null;
              return (
                <Appear key={lead.name} show={step >= i + 3} from="up" duration={500} className="flex h-[46px] items-center gap-3 border-t border-stroke-soft-200 first:border-t-0">
                  <Person name={lead.name} tint={lead.tint} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-label-sm", skipped ? "text-text-soft-400" : "text-text-strong-950")}>{lead.name}</div>
                    <div className="truncate text-paragraph-xs text-text-soft-400">{lead.company}</div>
                  </div>
                  {skipped ? (
                    <Badge.Root variant="lighter" size="medium" color="red" className="whitespace-nowrap">
                      <Badge.Icon as={RiForbidLine} />
                      Do Not Contact
                    </Badge.Root>
                  ) : (
                    <span className="flex items-center gap-2 text-paragraph-xs tabular-nums text-text-sub-600">
                      {lead.at}
                      <Badge.Root variant="lighter" size="medium" color="green" className="whitespace-nowrap">
                        <Badge.Icon as={RiCheckLine} />
                        New chat
                      </Badge.Root>
                    </span>
                  )}
                </Appear>
              );
            })}
          </div>
        </SceneCard>
      </Appear>
    </>
  );
}

export const WHATSAPP_SCENES: readonly Scene[] = [CallScene, RecordingScene, RetriesScene, MessagesScene];

