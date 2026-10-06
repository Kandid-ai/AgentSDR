"use client";

import { RiAlertLine, RiArrowRightSLine, RiFileExcel2Line, RiMailSendLine, RiMailLine, RiTimeLine } from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import { HUE } from "@/components/analytics/theme";
import { cn } from "@/utils/cn";
import { Appear, Cursor, ClickRipple, EASE, SceneCard, useTimeline, type Scene } from "./kit";

const ORANGE = HUE.orange;
const ORANGE_TINT = "rgb(250 115 25 / 0.13)";
const ORANGE_SOFT = "rgb(250 115 25 / 0.07)";
const ORANGE_INK = "#c2570c";

/* ------------------------------------------------------------------ */
/* 1. Merge fields                                                     */
/* ------------------------------------------------------------------ */

// Hl = a token lights up (with its CSV cell), Res = it swaps to the row's value.
const MERGE_TIMES = [500, 950, 1400, 1850, 2300, 2750, 3200, 3700] as const;

// The header "Open Role" is not a lead column the app knows, so the importer
// keeps it as a custom field under its camelCased header (openRole).
const CSV_COLUMNS = [
  { header: "First Name", key: "firstName", value: "Hannah" },
  { header: "Company", key: "company", value: "Lumen Freight" },
  { header: "Open Role", key: "openRole", value: "Sales Ops Lead" },
] as const;

function Token({ state, raw, value }: { state: 0 | 1 | 2; raw: string; value: string }) {
  return (
    <span
      className="rounded-[5px] px-[3px] py-px transition-[background-color,color] duration-500"
      style={{
        backgroundColor: state === 1 ? ORANGE_TINT : state === 2 ? ORANGE_SOFT : "rgb(14 18 27 / 0.05)",
        color: state === 1 ? ORANGE_INK : undefined,
        transitionTimingFunction: EASE,
      }}
    >
      {state === 2 ? value : raw}
    </span>
  );
}

function MergeFields({ reduced }: { reduced: boolean }) {
  const step = useTimeline(MERGE_TIMES, reduced);
  const tokenState = (i: number): 0 | 1 | 2 => (step < 2 * i + 1 ? 0 : step === 2 * i + 1 ? 1 : 2);
  const spin = tokenState(3);

  return (
    <>
      <SceneCard className="absolute left-5 top-6 w-[400px] p-4">
        <div className="flex items-center gap-2 text-paragraph-xs text-text-soft-400">
          <RiFileExcel2Line className="size-4" aria-hidden="true" />
          <span>leads.xlsx · row 1</span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_1.25fr_1.25fr] gap-2">
          {CSV_COLUMNS.map((col, i) => {
            const active = tokenState(i) === 1;
            return (
              <div
                key={col.key}
                className="rounded-lg px-2.5 py-2 ring-1 ring-inset transition-[background-color,box-shadow] duration-500"
                style={{
                  backgroundColor: active ? ORANGE_TINT : "rgb(246 247 249)",
                  // ring colour via box-shadow so it can transition with the fill
                  boxShadow: `inset 0 0 0 1px ${active ? ORANGE : "rgb(14 18 27 / 0.06)"}`,
                  transitionTimingFunction: EASE,
                }}
              >
                <p className="text-paragraph-xs text-text-soft-400">{col.header}</p>
                <p className="mt-0.5 truncate text-label-sm text-text-strong-950">{col.value}</p>
              </div>
            );
          })}
        </div>
      </SceneCard>

      <SceneCard className="absolute left-5 top-[168px] w-[400px] p-5">
        <div className="flex items-center gap-2 border-b border-stroke-soft-200 pb-3 text-paragraph-sm">
          <RiMailLine className="size-4 text-text-soft-400" aria-hidden="true" />
          <span className="text-text-soft-400">Subject</span>
          <span className="text-label-sm text-text-strong-950">
            Quick question, <Token state={tokenState(0)} raw="{{firstName}}" value="Hannah" />
          </span>
        </div>
        <p className="mt-4 text-[15px] leading-[26px] text-text-strong-950">
          Hi <Token state={tokenState(0)} raw="{{firstName}}" value="Hannah" />, saw <Token state={tokenState(1)} raw="{{company}}" value="Lumen Freight" /> is
          hiring a <Token state={tokenState(2)} raw="{{openRole}}" value="Sales Ops Lead" />.
        </p>
        <p className="mt-3 text-[15px] leading-[26px] text-text-strong-950">
          <span
            className="rounded-[5px] px-[3px] py-px transition-[background-color,color] duration-500"
            style={{
              backgroundColor: spin === 1 ? ORANGE_TINT : spin === 2 ? ORANGE_SOFT : "rgb(14 18 27 / 0.05)",
              color: spin === 1 ? ORANGE_INK : undefined,
              transitionTimingFunction: EASE,
            }}
          >
            {spin === 2 ? "Open to a quick chat" : "{Worth comparing notes|Open to a quick chat}"}
          </span>
          ?
        </p>
      </SceneCard>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Per-mailbox limits                                               */
/* ------------------------------------------------------------------ */

const LIMIT_TIMES = [600, 1050, 1500, 1950, 2450, 3200] as const;
const DAILY_CAP = 30; // the default `dailySendLimit`

// Sends so far at each tick (index 0 = before any tick). Ben reaches the cap on tick 3 and stops.
const MAILBOXES = [
  { address: "ana@northwind.io", sent: [20, 22, 24, 26, 28] },
  { address: "ben@northwind.io", sent: [26, 28, 30, 30, 30] },
  { address: "cara@northwind.io", sent: [8, 10, 11, 13, 14] },
] as const;

function MailboxLimits({ reduced }: { reduced: boolean }) {
  const step = useTimeline(LIMIT_TIMES, reduced);
  const tick = Math.min(step, 4); // ticks 1..4 move the meters
  const windowOn = step >= 5;
  const signatureOn = step >= 6;

  return (
    <>
      <SceneCard className="absolute left-5 top-6 w-[400px] px-5 py-4">
        {MAILBOXES.map((mb, i) => {
          const sent = mb.sent[tick];
          const atCap = sent >= DAILY_CAP;
          return (
            <div key={mb.address} className={cn("flex flex-col gap-2", i > 0 && "mt-4")}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-label-sm text-text-strong-950">
                  <RiMailSendLine className="size-4 text-text-soft-400" aria-hidden="true" />
                  {mb.address}
                </span>
                <span className="flex items-center gap-2 text-label-sm tabular-nums text-text-strong-950">
                  {atCap && (
                    <Badge.Root size="medium" variant="lighter" color="red">
                      At daily cap
                    </Badge.Root>
                  )}
                  <span>
                    {sent} <span className="text-text-soft-400">/ {DAILY_CAP}</span>
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-weak-50">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(sent / DAILY_CAP) * 100}%`,
                    backgroundColor: atCap ? HUE.red : ORANGE,
                    transition: `width 420ms ${EASE}, background-color 400ms ${EASE}`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </SceneCard>

      <Appear show={windowOn} className="absolute left-5 top-[206px] w-[400px]">
        <SceneCard className="px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-label-sm text-text-strong-950">
              <RiTimeLine className="size-4 text-text-soft-400" aria-hidden="true" />
              Sending window
            </span>
            <span className="text-paragraph-xs text-text-soft-400">Mon–Fri · 09:00–18:00</span>
          </div>
          <div className="relative mt-4 h-2 rounded-full bg-bg-weak-50">
            <div className="absolute inset-y-0 left-0 w-full rounded-full" style={{ backgroundColor: ORANGE_TINT }} />
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: windowOn ? "30%" : "0%", transition: `left 800ms ${EASE}` }}
            >
              <span className="block size-3.5 -translate-x-1/2 rounded-full border-2 border-white" style={{ backgroundColor: ORANGE, boxShadow: "0 1px 4px rgb(14 18 27 / 0.3)" }} />
            </div>
          </div>
          <div className="relative mt-2 h-4 text-paragraph-xs text-text-soft-400">
            <span className="absolute left-0">09:00</span>
            <span className="absolute -translate-x-1/2 text-text-strong-950" style={{ left: "30%" }}>
              Now 11:42
            </span>
            <span className="absolute right-0">18:00</span>
          </div>
        </SceneCard>
      </Appear>

      <Appear show={signatureOn} className="absolute left-5 top-[316px] w-[400px]">
        <SceneCard className="px-5 py-3">
          <p className="text-paragraph-sm text-text-sub-600">Worth comparing notes this week?</p>
          <div className="mt-2 border-l-2 pl-3" style={{ borderColor: ORANGE }}>
            <p className="text-label-sm text-text-strong-950">Daniel Reyes</p>
            <p className="text-paragraph-xs text-text-soft-400">Partnerships, Northwind</p>
          </div>
        </SceneCard>
      </Appear>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Mailbox pool                                                     */
/* ------------------------------------------------------------------ */

const POOL_TIMES = [500, 950, 1400, 1850, 2300, 2750] as const;

const LANES = ["ana@northwind.io", "ben@northwind.io", "cara@northwind.io"] as const;
const LANE_W = 130;
const LANE_GAP = 5;
const CHIP_W = 64;
const CAMPAIGN_A = ORANGE;
const CAMPAIGN_B = "#525866";

// Dealt in this order, mailbox = index % 3.
const POOL_LEADS = [
  { name: "Hannah", campaign: CAMPAIGN_A },
  { name: "Rafael", campaign: CAMPAIGN_B },
  { name: "Aiko", campaign: CAMPAIGN_A },
  { name: "Marcus", campaign: CAMPAIGN_A },
  { name: "Chloé", campaign: CAMPAIGN_B },
  { name: "Priya", campaign: CAMPAIGN_B },
] as const;

const QUEUE_Y = 104;
const LANE_TOP = 184;

function MailboxPool({ reduced }: { reduced: boolean }) {
  const step = useTimeline(POOL_TIMES, reduced);
  const queueX = (i: number) => 20 + i * ((400 - CHIP_W) / 5);
  const laneX = (lane: number) => 20 + lane * (LANE_W + LANE_GAP);

  return (
    <>
      <div className="absolute left-5 top-[64px] flex w-[400px] items-center justify-between text-paragraph-xs text-text-soft-400">
        <span>{step >= 6 ? "Assigned, in order" : "Queued"}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: CAMPAIGN_A }} />
            Campaign A
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: CAMPAIGN_B }} />
            Campaign B
          </span>
        </span>
      </div>

      {LANES.map((address, lane) => (
        <SceneCard key={address} className="absolute h-[150px]" style={{ left: laneX(lane), top: LANE_TOP, width: LANE_W }}>
          <div className="border-b border-stroke-soft-200 px-2.5 py-3">
            <p className="truncate text-paragraph-xs text-text-sub-600">{address}</p>
          </div>
        </SceneCard>
      ))}

      {POOL_LEADS.map((lead, i) => {
        const dealt = step > i;
        const lane = i % 3;
        const row = Math.floor(i / 3);
        const x = dealt ? laneX(lane) + (LANE_W - CHIP_W) / 2 : queueX(i);
        const y = dealt ? LANE_TOP + 52 + row * 40 : QUEUE_Y;
        return (
          <div
            key={lead.name}
            className="absolute left-0 top-0 z-10 flex h-8 items-center justify-center rounded-lg bg-bg-white-0 text-label-xs text-text-strong-950"
            style={{
              width: CHIP_W,
              transform: `translate(${x}px, ${y}px)`,
              boxShadow: `inset 3px 0 0 ${lead.campaign}, 0 0 0 1px rgb(14 18 27 / 0.08), 0 4px 10px -6px rgb(14 18 27 / 0.2)`,
              transition: `transform 650ms ${EASE}`,
            }}
          >
            {lead.name}
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Clean lists                                                      */
/* ------------------------------------------------------------------ */

const CLEAN_TIMES = [500, 1400, 1800, 2700, 3200] as const;

type LeadRow = { name: string; email: string; initials: string; tint: string };
const CLEAN_LEADS: readonly LeadRow[] = [
  { name: "Hannah Weiss", email: "hannah@lumenfreight.com", initials: "HW", tint: "#e0eaff" },
  { name: "Rafael Costa", email: "rafael@brightloop.io", initials: "RC", tint: "#ffe6d4" },
  { name: "Aiko Tanaka", email: "aiko@kestrelhealth.com", initials: "AT", tint: "#e4f7ee" },
  { name: "Marcus Lindqvist", email: "marcus@oakridge.capital", initials: "ML", tint: "#ece6ff" },
];

function StatusBadge({ kind }: { kind: "sequence" | "suppressed" | "bounced" }) {
  const map = {
    sequence: { color: "blue", label: "In sequence" },
    suppressed: { color: "orange", label: "Suppressed" },
    bounced: { color: "red", label: "Bounced" },
  } as const;
  const { color, label } = map[kind];
  return (
    <Badge.Root size="medium" variant="lighter" color={color}>
      <Badge.Dot />
      {label}
    </Badge.Root>
  );
}

function CleanLists({ reduced }: { reduced: boolean }) {
  const step = useTimeline(CLEAN_TIMES, reduced);
  const unsubscribed = step >= 3;
  const bounceShown = step >= 4;
  const bounced = step >= 5;
  const queued = 4 - (unsubscribed ? 1 : 0) - (bounced ? 1 : 0);
  const cursorOn = step >= 1 && step < 3;
  const pressed = step === 2;

  const kindOf = (i: number): "sequence" | "suppressed" | "bounced" =>
    i === 1 && unsubscribed ? "suppressed" : i === 2 && bounced ? "bounced" : "sequence";

  return (
    <>
      <div className="absolute left-5 top-6 h-[112px] w-[400px]">
        <SceneCard
          className="absolute inset-0 px-5 py-4"
          style={{ opacity: bounceShown ? 0 : 1, transform: bounceShown ? "translateY(-6px)" : "none", transition: `opacity 450ms ${EASE}, transform 450ms ${EASE}` }}
        >
          <p className="text-paragraph-xs text-text-soft-400">To Rafael Costa</p>
          <div className="mt-2 flex flex-col gap-1.5" aria-hidden="true">
            <span className="h-2 w-[86%] rounded-full bg-bg-weak-50" />
            <span className="h-2 w-[62%] rounded-full bg-bg-weak-50" />
          </div>
          <p className="mt-3 border-t border-stroke-soft-200 pt-2.5 text-paragraph-sm text-text-soft-400">
            Don&apos;t want to hear from us again?{" "}
            <span className="text-text-sub-600 underline decoration-text-soft-400 underline-offset-2">Unsubscribe</span>
          </p>
        </SceneCard>
        <SceneCard
          className="absolute inset-0 flex items-center gap-3 px-5 py-4"
          style={{ opacity: bounceShown ? 1 : 0, transform: bounceShown ? "none" : "translateY(8px)", transition: `opacity 450ms ${EASE}, transform 450ms ${EASE}` }}
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-error-lighter text-error-base">
            <RiAlertLine className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-label-sm text-text-strong-950">Delivery failed</p>
            <p className="mt-0.5 text-paragraph-sm text-text-sub-600">Address not found: aiko@kestrelhealth.com</p>
          </div>
        </SceneCard>
      </div>

      <SceneCard className="absolute left-5 top-[156px] w-[400px]">
        <div className="flex items-center justify-between border-b border-stroke-soft-200 px-5 py-3">
          <span className="text-label-sm text-text-strong-950">Leads</span>
          <span className="flex items-center gap-1.5 text-paragraph-xs text-text-soft-400">
            <RiArrowRightSLine className="size-4" aria-hidden="true" />
            Send queue <span className="w-3 text-right tabular-nums text-text-strong-950">{queued}</span>
          </span>
        </div>
        {CLEAN_LEADS.map((lead, i) => {
          const kind = kindOf(i);
          const out = kind !== "sequence";
          return (
            <div key={lead.email} className={cn("flex items-center gap-3 px-5 py-2.5", i > 0 && "border-t border-stroke-soft-200")}>
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-label-xs text-text-sub-600 transition-opacity duration-500"
                style={{ backgroundColor: lead.tint, opacity: out ? 0.55 : 1 }}
              >
                {lead.initials}
              </span>
              <div className="min-w-0 flex-1 transition-opacity duration-500" style={{ opacity: out ? 0.6 : 1 }}>
                <p className="truncate text-label-sm text-text-strong-950">{lead.name}</p>
                <p className="truncate text-paragraph-xs text-text-soft-400">{lead.email}</p>
              </div>
              <StatusBadge kind={kind} />
            </div>
          );
        })}
      </SceneCard>

      {step === 2 && <ClickRipple x={300} y={119} />}
      <Cursor x={step >= 2 ? 294 : 340} y={step >= 2 ? 112 : 150} pressed={pressed} show={cursorOn} duration={step >= 2 ? 700 : 900} />
    </>
  );
}

export const EMAIL_SCENES: readonly Scene[] = [MergeFields, MailboxLimits, MailboxPool, CleanLists];

