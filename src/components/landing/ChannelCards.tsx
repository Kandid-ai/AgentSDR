"use client";

import type { CSSProperties, ReactNode } from "react";
import { RiMicLine, RiPhoneFill } from "@remixicon/react";
import { CapacityMeter, FunnelChart, StatusDotBadge, TickMeter } from "@/components/analytics/kit";
import { CHANNEL_META, formatCompact } from "@/components/analytics/theme";
import { ProposalInline } from "@/components/crm/CrmActionsClient";
import { Bubble, ComposerDraftBanner, MessageCaption } from "@/components/inbox/shell/Conversation";
import { CategoryChip, DraftChip, InboxAvatar } from "@/components/inbox/shell/InboxShell";
import { cn } from "@/utils/cn";
import { EMAIL, LINKEDIN } from "./data/analytics";
import { Card, Slab } from "./Features";
import { Stage } from "./motion/Stage";
import { at, count, easeOut, flag, tween, within } from "./motion/timeline";
import vs from "./motion/vignettes.module.css";
import { Reveal } from "./Reveal";
import { monoFont, SectionHead } from "./ui";

/**
 * "A day of outreach": a 2×2 of the grey feature cards, one per channel,
 * each a live vignette of that channel's working state (mailboxes pacing
 * against their caps, the LinkedIn funnel across accounts, a call being
 * recorded and transcribed, a reply with its AI draft held for review) over
 * a centred title and paragraph. Sits between the channel tour, which shows
 * how each capability works, and "Built on data you own".
 */
export function ChannelCards() {
  return (
    <section id="day-to-day" aria-labelledby="day-title" className="scroll-mt-24 bg-white pb-16 pt-6 sm:pb-20 sm:pt-10">
      <Reveal>
        <SectionHead
          id="day-title"
          eyebrow="Day to day"
          title="What a day of outreach looks like"
          lede="Mailboxes pacing themselves, LinkedIn accounts inside their limits, calls recorded as they happen, and every reply answered before you open the inbox."
        />
      </Reveal>

      <div className="mx-auto mt-14 grid max-w-[560px] gap-4 px-3 sm:mt-16 sm:gap-6 lg:max-w-[1128px] lg:grid-cols-2 lg:px-6">
        <Reveal>
          <Card top title="Sequences that respect your mailboxes" body="Multi-step email from your own Google Workspace mailboxes: any CSV column as a {{merge field}}, spin text, a daily cap and sending window per mailbox, one-click unsubscribe and automatic bounce suppression.">
            <EmailVignette />
          </Card>
        </Reveal>
        <Reveal delay={80}>
          <Card top title="LinkedIn, within the limits" body="Campaigns across several accounts through Unipile: an invite, an accept message and three follow-ups. 30 invites a day on premium, 5 on free, with a randomised gap between each.">
            <LinkedinVignette />
          </Card>
        </Reveal>
        <Reveal>
          <Card top id="whatsapp" title="WhatsApp calls, recorded and transcribed" body="Dial from AgentSDR: a Chrome extension places the call inside WhatsApp Web, records both sides, and your own model writes the transcript. Messages sync too, with a warm-up for new numbers.">
            <WhatsappVignette />
          </Card>
        </Reveal>
        <Reveal delay={80}>
          <Card top title="Every reply read, every answer drafted" body="The CRM classifies each reply — interested, customer, not interested, other — and drafts the answer from your knowledge base. It only moves a lead forward on its own; anything else waits for you.">
            <CrmVignette />
          </Card>
        </Reveal>
      </div>
    </section>
  );
}

function SlabLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className={cn(monoFont, "mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.03em] text-[#656565]")}>
      <span>{children}</span>
      {right && <span className="text-[#707070]">{right}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- vignettes
//
// Each vignette is a pure function of its loop clock (./motion/Stage): it
// builds up to the static card at `final`, holds there with something small
// still alive, then fades and starts over. Under prefers-reduced-motion, and
// on the server, only the `final` frame is ever drawn.

/*
 * Email: the day's sends count up and each mailbox's meter fills, a staggered
 * beat apart; two last sends land on today's figures (Leo crossing into "Near
 * limit"), and while it holds, one more send takes Maya there too.
 */
const EMAIL_LOOP = { cycle: 12_000, final: 4_500 };
const EMAIL_SENDS = [
  { at: 2_700, row: 1 },
  { at: 3_600, row: 0 },
] as const;
const EMAIL_IDLE_SEND = { at: 7_000, row: 0 } as const;

function EmailVignette() {
  // One mailbox per sender, so the names differ.
  const rows = EMAIL.mailboxes.rows.filter((m) => !m.email.includes("@mail.")).slice(0, 3);
  const { sentToday, capacityToday } = EMAIL.mailboxes;
  return (
    <Stage {...EMAIL_LOOP}>
      {({ t, live }) => {
        const sends = [...EMAIL_SENDS, EMAIL_IDLE_SEND];
        const landed = sends.filter((s) => t >= s.at);
        const sent = Math.round(tween(t, 200, 1_800, 0, sentToday - EMAIL_SENDS.length)) + landed.length;
        const used = (row: number) => {
          const later = EMAIL_SENDS.filter((s) => s.row === row).length;
          return Math.round(tween(t, 300 + 160 * row, 1_500, 0, rows[row].sentToday - later)) + landed.filter((s) => s.row === row).length;
        };
        const sending = (row: number) => live && sends.some((s) => s.row === row && within(t, s.at, 900));
        return (
          <div className="relative flex w-full max-w-[360px] flex-col items-center">
            <Slab className="relative z-10">
              <SlabLabel right="Mon–Fri · 09:00–18:00">Sending today</SlabLabel>
              <TickMeter label="Sent today" used={sent} limit={capacityToday} ticks={36} caption={`${sent} of ${capacityToday} across 5 mailboxes`} />
            </Slab>
            <Slab className="mt-2.5 space-y-3">
              {rows.map((m, i) => (
                <div key={m.id} className={vs.wash} data-on={flag(sending(i))}>
                  <CapacityMeter label={m.email.split("@")[0].replace(/^\w/, (c) => c.toUpperCase())} detail={m.email} used={used(i)} limit={m.dailyLimit} segments={15} />
                </div>
              ))}
            </Slab>
          </div>
        );
      }}
    </Stage>
  );
}

/*
 * LinkedIn: the funnel's bars grow in order with their numbers counting up,
 * then the day's invites tick up to 78, each one a small pulse on the account
 * that sent it.
 */
const LINKEDIN_LOOP = { cycle: 11_000, final: 4_800 };
const BAR_AT = [250, 700, 1_150];
const BAR_MS = 1_000;
const INVITES_FROM = 72;
const INVITE_AT = [2_100, 2_480, 2_860, 3_240, 3_620, 4_000];

function LinkedinVignette() {
  const stages = LINKEDIN.funnel.filter((s) => s.key !== "messaged");
  const accounts = LINKEDIN.accounts.slice(0, 3);
  return (
    <Stage {...LINKEDIN_LOOP}>
      {({ t }) => {
        // The chart formats each stage's real value; show it partway through its count instead.
        const countUp = (value: number) => {
          const i = stages.findIndex((s) => s.value === value);
          return formatCompact(i < 0 ? value : Math.round(value * easeOut((t - BAR_AT[i]) / BAR_MS)));
        };
        const sentInvites = count(t, INVITE_AT);
        const pulsing = (i: number) => INVITE_AT.some((ms, k) => k % accounts.length === i && within(t, ms, 760));
        return (
          <Slab>
            <SlabLabel right="Last 4 weeks">Invites → replies</SlabLabel>
            <div className={vs.funnel} data-grown={count(t, BAR_AT)}>
              <FunnelChart stages={stages} valueFormat={countUp} />
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-stroke-soft-200 pt-3">
              <span className="flex -space-x-1.5">
                {accounts.map((a, i) => (
                  <span key={a.id} className={vs.ping} data-on={flag(pulsing(i))}>
                    <InboxAvatar name={a.name} size="xs" className="ring-2 ring-white" />
                  </span>
                ))}
              </span>
              <span className="text-[12px] text-[#656565]">3 accounts sending · {INVITES_FROM + sentInvites} of 90 invites today</span>
            </div>
          </Slab>
        );
      }}
    </Stage>
  );
}

/*
 * WhatsApp: the call is live throughout — its timer runs and the waveform
 * moves — while the transcript writes itself: each turn appears as a
 * shimmering line, then its words; the badges land once both are in.
 */
const WHATSAPP_LOOP = { cycle: 12_000, final: 4_600 };
const CALL_SECONDS_AT_FINAL = 4 * 60 + 12;
const REP_AT = 400;
const REP_WORDS_AT = 1_500;
const LEAD_AT = 1_900;
const LEAD_WORDS_AT = 3_000;
const BADGES_AT = [3_600, 3_900];

function WhatsappVignette() {
  const wa = CHANNEL_META.whatsapp.color;
  return (
    <Stage {...WHATSAPP_LOOP}>
      {({ t }) => {
        const seconds = CALL_SECONDS_AT_FINAL + Math.floor((t - WHATSAPP_LOOP.final) / 1_000);
        const timer = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
        return (
          <div className="flex w-full max-w-[360px] flex-col gap-2.5">
            <Slab className="flex items-center gap-3 py-3 sm:py-3.5">
              <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: wa }}>
                <RiPhoneFill className="size-4" aria-hidden="true" />
                <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full opacity-30 motion-reduce:hidden" style={{ backgroundColor: wa }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[#141414]">Aiko Tanaka · Kestrel Health</span>
                <span className="flex items-center gap-1.5 text-[12px] text-[#656565]">
                  <RiMicLine className="size-3.5 text-[#fb3748]" aria-hidden="true" /> Recording · {timer}
                </span>
              </span>
              <Waveform color={wa} />
            </Slab>
            <Slab className="space-y-2 py-3.5">
              <SlabLabel right={t >= LEAD_WORDS_AT ? "Transcribed" : "Transcribing…"}>Transcript</SlabLabel>
              <div className={cn(vs.rise, "flex flex-col items-end")} data-on={at(t, REP_AT)}>
                <MessageCaption outbound who="Rep" time="0:08" />
                <Bubble outbound className="relative text-[13px]">
                  <TranscribedWords on={t >= REP_WORDS_AT}>Is now still a good time? Two minutes on how you handle follow-ups.</TranscribedWords>
                </Bubble>
              </div>
              <div className={cn(vs.rise, "flex flex-col items-start")} data-on={at(t, LEAD_AT)}>
                <MessageCaption outbound={false} who="Lead" time="0:15" />
                <Bubble outbound={false} className="relative text-[13px]">
                  <TranscribedWords on={t >= LEAD_WORDS_AT}>Sure — honestly, most of ours never get sent.</TranscribedWords>
                </Bubble>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className={vs.pop} data-on={at(t, BADGES_AT[0])}>
                  <StatusDotBadge status="good">Connected</StatusDotBadge>
                </span>
                <span className={vs.pop} data-on={at(t, BADGES_AT[1])}>
                  <StatusDotBadge status="info">Transcript ready</StatusDotBadge>
                </span>
              </div>
            </Slab>
          </div>
        );
      }}
    </Stage>
  );
}

/** A transcript turn's words, over a shimmer that holds their place until they arrive. */
function TranscribedWords({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <>
      <span className={vs.words} data-on={flag(on)}>
        {children}
      </span>
      <span aria-hidden="true" className={vs.skeleton} data-on={flag(on)}>
        <span className="w-[92%]" />
        <span className="w-[58%]" />
      </span>
    </>
  );
}

// Heights are the static shape; each bar breathes on its own period and depth.
const WAVE = [6, 12, 18, 9, 14, 22, 11, 16, 8, 13, 19, 7];
const WAVE_MS = [820, 1_040, 760, 960, 880, 700, 1_120, 840, 980, 740, 900, 1_060];

function Waveform({ color }: { color: string }) {
  return (
    <span aria-hidden="true" className={cn(vs.wave, "flex h-6 items-center gap-[3px]")}>
      {WAVE.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full opacity-80"
          style={{ height: h, backgroundColor: color, "--wave-ms": `${WAVE_MS[i]}ms`, "--wave-delay": `${-(i * 137) % 700}ms`, "--wave-low": String(0.3 + (i % 3) * 0.15) } as CSSProperties}
        />
      ))}
    </span>
  );
}

/*
 * CRM: Hannah's reply comes in, the classifier's chip and the draft chip
 * land on it, the AI's answer types itself into the composer, and the held
 * classification proposal appears last.
 */
const CRM_LOOP = { cycle: 13_000, final: 6_200 };
const REPLY_AT = 200;
const CHIPS_AT = [1_000, 1_350];
const COMPOSER_AT = 1_900;
const TYPE_AT = 2_300;
const TYPE_MS_PER_CHAR = 21;
const REVIEW_AT = 5_600;
const DRAFT = "Thursday works — I've held 3:00pm CET and sent the invite. I'll bring the reply-rate numbers from teams your size.";
const TYPE_END = TYPE_AT + DRAFT.length * TYPE_MS_PER_CHAR;

function CrmVignette() {
  return (
    <Stage {...CRM_LOOP}>
      {({ t, live }) => {
        const typed = Math.max(0, Math.min(DRAFT.length, Math.floor((t - TYPE_AT) / TYPE_MS_PER_CHAR)));
        const caret = live && t >= COMPOSER_AT && t < TYPE_END + 900;
        return (
          <div className="flex w-full max-w-[360px] flex-col gap-2.5">
            <div className={vs.rise} data-on={at(t, REPLY_AT)}>
              <Slab className="py-3.5">
                <div className="flex items-start gap-3">
                  <InboxAvatar name="Hannah Weiss" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#141414]">
                      Hannah Weiss
                      <span className="text-[12px] font-normal text-[#707070]">· 14m</span>
                    </p>
                    <p className="mt-0.5 border-l-2 border-stroke-soft-200 pl-2.5 text-[13px] leading-5 text-[#141414]">Could you do Thursday afternoon? I&apos;ll bring our ops lead.</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className={vs.pop} data-on={at(t, CHIPS_AT[0])}>
                        <CategoryChip categoryKey="interested" label="Meeting Requested" />
                      </span>
                      <span className={vs.pop} data-on={at(t, CHIPS_AT[1])}>
                        <DraftChip />
                      </span>
                    </div>
                  </div>
                </div>
              </Slab>
            </div>
            <div className={vs.rise} data-on={at(t, COMPOSER_AT)}>
              <Slab className="overflow-hidden p-0 sm:p-0">
                <ComposerDraftBanner onClear={() => {}} note="From your knowledge base · Scheduling" />
                <p className="px-4 pb-4 pt-3 text-[13px] leading-5 text-[#141414]">
                  <span className="sr-only">{DRAFT}</span>
                  <span aria-hidden="true">
                    {DRAFT.slice(0, typed)}
                    {caret && <span className={vs.caret} />}
                    {/* The untyped rest holds the paragraph's final shape. */}
                    <span className="invisible">{DRAFT.slice(typed)}</span>
                  </span>
                </p>
              </Slab>
            </div>
            <div className={vs.rise} data-on={at(t, REVIEW_AT)}>
              <Slab className="flex items-center justify-between gap-2 py-3">
                <span className="text-[12px] text-[#656565]">Held for review</span>
                <ProposalInline label="Demo Requested" busy={false} onAccept={() => {}} onKeep={() => {}} />
              </Slab>
            </div>
          </div>
        );
      }}
    </Stage>
  );
}
