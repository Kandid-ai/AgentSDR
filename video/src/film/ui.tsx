import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import {
  RiArrowRightUpLine,
  RiCalendarCheckLine,
  RiCheckboxCircleFill,
  RiCheckDoubleLine,
  RiCheckLine,
  RiCloseLine,
  RiFlashlightLine,
  RiLinkedinBoxFill,
  RiLoader4Line,
  RiMailFill,
  RiMapPin2Line,
  RiMicLine,
  RiPhoneFill,
  RiRecordCircleFill,
  RiSendPlane2Fill,
  RiSparkling2Line,
  RiTimeLine,
  RiUserAddLine,
  RiUserSearchLine,
  RiWhatsappFill,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import { AgentMark } from "@/components/brand/Logo";
import { CategoryChip, ConversationRow, DraftChip, InboxAvatar } from "@/components/inbox/shell/InboxShell";
import { cn } from "@/utils/cn";
import { tw, typed } from "../kit/motion";

/**
 * The product, in pieces. Each is a small, self-contained piece of the
 * AgentSDR UI on sample data, drawn with the app's tokens and — where the
 * app has one — its real component. Animated pieces take `t`, frames since
 * they appeared.
 */

export const ORANGE = "#fa7319";
export const LI_BLUE = "#0a66c2";
export const WA_GREEN = "#1fc16b";
export const PURPLE = "#7d52f4";
export const TEAL = "#1daf9c";
export const AMBER = "#e5930a";
export const BLUE = "#335cff";

export const CHANNELS = {
  email: { label: "Email", color: ORANGE, icon: RiMailFill },
  linkedin: { label: "LinkedIn", color: LI_BLUE, icon: RiLinkedinBoxFill },
  whatsapp: { label: "WhatsApp", color: WA_GREEN, icon: RiWhatsappFill },
} as const;
export type Channel = keyof typeof CHANNELS;

export type Lead = { name: string; title: string; company: string; email: string; via: string; ok: boolean; opener: string; fit: number; channel: Channel };

export const LEADS: Lead[] = [
  { name: "Maya Chen", title: "VP Sales", company: "Northwind Labs", email: "maya@northwindlabs.io", via: "apollo.io", ok: true, opener: "Saw Northwind just opened a Denver office", fit: 96, channel: "email" },
  { name: "Daniel Okafor", title: "Head of Sales", company: "Brightloop", email: "daniel@brightloop.com", via: "findymail.com", ok: true, opener: "Congrats on Brightloop's Series B", fit: 93, channel: "linkedin" },
  { name: "Priya Raman", title: "VP Revenue", company: "Ledgerly", email: "priya@ledgerly.co", via: "hunter.io", ok: true, opener: "Loved your post on SDR ramp time", fit: 91, channel: "whatsapp" },
  { name: "Lucas Meyer", title: "Head of Growth", company: "Parcelly", email: "lucas@parcelly.io", via: "lusha.com", ok: true, opener: "Parcelly is hiring four AEs — big quarter?", fit: 89, channel: "email" },
  { name: "Sofia Alvarez", title: "CRO", company: "Kestrel Health", email: "sofia@kestrelhealth.com", via: "apollo.io", ok: false, opener: "Kestrel's new payer deal looks huge", fit: 88, channel: "linkedin" },
  { name: "Ethan Brooks", title: "VP Sales", company: "Oakridge Cloud", email: "ethan@oakridge.cloud", via: "leadmagic.io", ok: true, opener: "Your SaaStr talk on pricing stuck with me", fit: 86, channel: "email" },
  { name: "Aiko Tanaka", title: "Head of Sales", company: "Lumen Freight", email: "aiko@lumenfreight.com", via: "apollo.io", ok: true, opener: "Lumen's EU launch caught my eye", fit: 85, channel: "whatsapp" },
  { name: "Grace Kim", title: "VP Sales", company: "Atlas Pay", email: "grace@atlaspay.io", via: "findymail.com", ok: true, opener: "Atlas Pay in 12 markets now — wild pace", fit: 83, channel: "linkedin" },
  { name: "Omar Haddad", title: "Head of Revenue", company: "Stackwise", email: "omar@stackwise.dev", via: "hunter.io", ok: true, opener: "Stackwise's new API pricing is clever", fit: 82, channel: "email" },
  { name: "Hannah Weiss", title: "VP Growth", company: "Copperline", email: "hannah@copperline.co", via: "apollo.io", ok: true, opener: "Copperline's rebrand looks sharp", fit: 80, channel: "linkedin" },
];

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("");

/* ------------------------------------------------------------------ */
/* Small parts                                                         */
/* ------------------------------------------------------------------ */

export function Head({ icon: Icon, color, title, right, className }: { icon: ComponentType<{ className?: string; style?: CSSProperties }>; color: string; title: string; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-12 shrink-0 items-center gap-2.5 border-b border-stroke-soft-200 px-4", className)}>
      <Icon className="size-[18px]" style={{ color }} />
      <span className="text-label-sm text-text-strong-950">{title}</span>
      <span className="ml-auto flex items-center gap-2">{right}</span>
    </div>
  );
}

/** A contact's portrait — the same fictional faces as the CRM (public/faces, tools/faces.ts). */
export function Face({ id, size, className, style }: { id: string; size: number; className?: string; style?: CSSProperties }) {
  return <Img src={staticFile(`faces/${id}.jpg`)} className={`shrink-0 rounded-full object-cover ${className ?? ""}`} style={{ width: size, height: size, ...style }} />;
}

export function Avatar({ name, color = BLUE, size = 32 }: { name: string; color?: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

export function Spinner({ t, className }: { t: number; className?: string }) {
  return <RiLoader4Line className={cn("size-4 shrink-0 text-text-soft-400", className)} style={{ transform: `rotate(${t * 16}deg)` }} />;
}

export function Caret({ t }: { t: number }) {
  return <span className="ml-px inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-current" style={{ opacity: Math.floor(t / 7) % 2 ? 0.25 : 1 }} />;
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

function Field({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex h-11 items-center gap-3 border-b border-stroke-soft-200 px-5 text-[14px]">
      <span className="w-14 text-text-soft-400">{k}</span>
      <span className="min-w-0 flex-1 truncate text-text-strong-950">{v}</span>
    </div>
  );
}

function Token({ on, raw, value }: { on: boolean; raw: string; value: string }) {
  return (
    <span className="rounded-[5px] px-1 py-px" style={{ background: on ? "rgb(250 115 25 / 0.1)" : "rgb(14 18 27 / 0.06)", color: on ? "#c2570c" : undefined }}>
      {on ? value : raw}
    </span>
  );
}

/** The sequence step's composer: merge fields resolve, then it sends. */
export function EmailCard({ t, resolveAt = 10, sendAt = 999 }: { t: number; resolveAt?: number; sendAt?: number }) {
  const r = (n: number) => t >= resolveAt + n * 4;
  const sent = t >= sendAt;
  return (
    <div className="w-[560px]">
      <Head icon={RiMailFill} color={ORANGE} title="Step 1 · Email" right={sent ? <Badge.Root size="medium" variant="lighter" color="green"><Badge.Dot />Sending</Badge.Root> : <span className="text-paragraph-xs text-text-soft-400">Day 0</span>} />
      <Field k="From" v={<span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-[#fa7319]" />alex@northstar.io <span className="text-text-soft-400">· 1 of 3 mailboxes</span></span>} />
      <Field k="To" v={<Token on={r(0)} raw="{{email}}" value="maya@northwindlabs.io" />} />
      <Field k="Subject" v={<>Quick idea for <Token on={r(1)} raw="{{company}}" value="Northwind Labs" /></>} />
      <div className="space-y-2 px-5 py-4 text-[15px] leading-[1.6] text-text-strong-950">
        <p>
          Hi <Token on={r(2)} raw="{{firstName}}" value="Maya" />,
        </p>
        <p>
          <Token on={r(3)} raw="{{opener}}" value="Saw Northwind just opened a Denver office." /> We help sales teams run email, LinkedIn and WhatsApp from one workspace.
        </p>
        <p>Worth a look this week?</p>
      </div>
      <div className="flex items-center justify-between border-t border-stroke-soft-200 px-5 py-3">
        <span className="text-paragraph-xs text-text-soft-400">40 a day per mailbox · weekdays 9–5</span>
        <Button.Root variant="primary" mode="filled" size="xsmall">
          <Button.Icon as={RiSendPlane2Fill} />
          {sent ? "Launched" : "Launch sequence"}
        </Button.Root>
      </div>
    </div>
  );
}

/** Three steps across three channels. */
export function SequenceCard({ t, doneAt = 999 }: { t: number; doneAt?: number }) {
  const steps: { ch: Channel; label: string; day: string }[] = [
    { ch: "email", label: "Personal email", day: "Day 0" },
    { ch: "linkedin", label: "Invite with a note", day: "Day 2" },
    { ch: "whatsapp", label: "WhatsApp follow-up", day: "Day 4" },
  ];
  return (
    <div className="w-[380px] p-4">
      <p className="mb-3 text-label-xs uppercase tracking-[0.04em] text-text-soft-400">Sequence · Heads of Sales</p>
      <div className="space-y-2.5">
        {steps.map((s, i) => {
          const C = CHANNELS[s.ch];
          const done = t >= doneAt + i * 8;
          return (
            <div key={s.ch} className="flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ring-stroke-soft-200" style={{ opacity: tw(t, i * 3, 8) }}>
              <span className="flex size-8 items-center justify-center rounded-lg text-white" style={{ background: C.color }}>
                <C.icon className="size-4" />
              </span>
              <span className="flex-1">
                <span className="block text-label-sm text-text-strong-950">{s.label}</span>
                <span className="block text-paragraph-xs text-text-soft-400">{s.day}</span>
              </span>
              {done ? <RiCheckboxCircleFill className="size-5 text-[#1fc16b]" /> : <RiTimeLine className="size-4 text-text-soft-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LinkedIn                                                            */
/* ------------------------------------------------------------------ */

export function ProfileCard({ t, connectAt = 999, acceptedAt = 999 }: { t: number; connectAt?: number; acceptedAt?: number }) {
  return (
    <div className="w-[420px]">
      <div className="h-20" style={{ background: "linear-gradient(120deg, #c7d7fe, #e0e7ff 55%, #f5f3ff)" }} />
      <div className="px-5 pb-5">
        <Face id="maya" size={72} className="-mt-9 block ring-4 ring-white" />
        <p className="mt-2 text-[19px] font-semibold text-text-strong-950">Maya Chen</p>
        <p className="text-[14px] text-text-sub-600">VP Sales at Northwind Labs</p>
        <p className="mt-0.5 flex items-center gap-1 text-[12px] text-text-soft-400">
          <RiMapPin2Line className="size-3.5" /> San Francisco · 500+ connections
        </p>
        <div className="mt-3 flex gap-2">
          {t >= acceptedAt ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-[#1f9d55] ring-1 ring-inset ring-[#bdeacb]">
              <RiCheckLine className="size-4" /> Connected
            </span>
          ) : t >= connectAt ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">
              <RiTimeLine className="size-4" /> Pending
            </span>
          ) : (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#0a66c2] px-4 text-[13px] font-medium text-white">
              <RiUserAddLine className="size-4" /> Connect
            </span>
          )}
          <span className="inline-flex h-8 items-center rounded-full px-4 text-[13px] font-medium text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">Message</span>
        </div>
      </div>
    </div>
  );
}

const NOTE = "Hi Maya — loved your post on ramping new SDRs. Would be great to connect.";
export function NoteCard({ t, typeAt = 0 }: { t: number; typeAt?: number }) {
  return (
    <div className="w-[400px] p-5">
      <p className="text-label-md text-text-strong-950">Add a note</p>
      <p className="text-paragraph-xs text-text-soft-400">Written from the lead&apos;s profile</p>
      <div className="mt-3 min-h-[92px] rounded-xl px-4 py-3 text-[14px] leading-[1.55] text-text-strong-950 ring-1 ring-inset ring-[#0a66c2]">
        {typed(NOTE, t, typeAt, 70)}
        <Caret t={t} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-paragraph-xs tabular-nums text-text-soft-400">Invites 19 / 25 today</span>
        <span className="inline-flex h-8 items-center rounded-full bg-[#0a66c2] px-4 text-[13px] font-medium text-white">Send</span>
      </div>
    </div>
  );
}

export function LiThread({ t }: { t: number }) {
  return (
    <div className="w-[420px] space-y-3 p-5">
      <div className="flex items-center gap-2 border-b border-stroke-soft-200 pb-3">
        <RiLinkedinBoxFill className="size-5 text-[#0a66c2]" />
        <span className="text-label-sm text-text-strong-950">Maya Chen</span>
        <span className="ml-auto text-paragraph-xs text-[#1f9d55]">Connected</span>
      </div>
      <div className="flex justify-end" style={{ opacity: tw(t, 0, 8) }}>
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary-alpha-10 px-3.5 py-2 text-[14px] text-text-strong-950 ring-1 ring-inset ring-primary-alpha-16">Thanks for connecting, Maya! Open to a quick look at how teams run every channel from one inbox?</div>
      </div>
      <div className="flex justify-start" style={{ opacity: tw(t, 14, 8) }}>
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-bg-weak-50 px-3.5 py-2 text-[14px] text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">Sure — what would that look like for us?</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* WhatsApp                                                            */
/* ------------------------------------------------------------------ */

export function WaChat({ t, width = 420 }: { t: number; width?: number }) {
  return (
    <div style={{ width }}>
      <div className="flex items-center gap-3 border-b border-stroke-soft-200 px-4 py-3">
        <Face id="priya" size={36} />
        <span className="flex-1">
          <span className="block text-label-sm text-text-strong-950">Priya Raman</span>
          <span className="block text-paragraph-xs text-text-soft-400">{t > 16 && t < 24 ? "typing…" : "online"}</span>
        </span>
        <RiWhatsappFill className="size-5 text-[#1fc16b]" />
      </div>
      <div className="space-y-2.5 px-4 py-4" style={{ background: "#f5f2ec" }}>
        <div className="flex justify-end" style={{ opacity: tw(t, 0, 8) }}>
          <div className="max-w-[86%] rounded-2xl rounded-br-md bg-[#d9fdd3] px-3.5 py-2 text-[14px] leading-[1.45] text-[#111b21]">
            Hi Priya — Alex from Northstar. Two minutes for a quick call this week?
            <span className="ml-2 inline-flex translate-y-[3px] items-center gap-0.5 text-[11px] text-[#667781]">
              10:42 <RiCheckDoubleLine className="size-4" style={{ color: t > 12 ? "#53bdeb" : "#8696a0" }} />
            </span>
          </div>
        </div>
        <div className="flex justify-start" style={{ opacity: tw(t, 24, 8) }}>
          <div className="max-w-[86%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-[14px] leading-[1.45] text-[#111b21]">
            Sure — call me now. <span className="ml-1 text-[11px] text-[#667781]">10:43</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A call placed from AgentSDR: timer, waveform, recording. */
export function CallCard({ t, width = 420 }: { t: number; width?: number }) {
  const secs = Math.floor(Math.min(252, t * 3.2));
  return (
    <div className="flex flex-col items-center px-6 py-7 text-white" style={{ width, background: "linear-gradient(180deg, #0b3b2c, #0a2a21)" }}>
      <span className="relative flex size-20 items-center justify-center">
        {[0, 1].map((i) => {
          const p = ((t + i * 12) % 24) / 24;
          return <span key={i} className="absolute inset-0 rounded-full" style={{ border: "2px solid rgb(31 193 107 / 0.6)", transform: `scale(${1 + p * 0.6})`, opacity: 1 - p }} />;
        })}
        <Face id="priya" size={80} className="relative" />
      </span>
      <p className="mt-4 text-[20px] font-semibold">Priya Raman</p>
      <p className="text-[15px] tabular-nums text-white/70">
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[rgb(251_55_72/0.18)] px-3 py-1 text-[12px] font-medium text-[#ff8a95]">
        <RiRecordCircleFill className="size-3.5" /> Recording
      </span>
      <div className="mt-5 flex h-12 items-center gap-[4px]">
        {Array.from({ length: 28 }, (_, i) => {
          const h = 6 + Math.abs(Math.sin(t / 3 + i * 0.7) * Math.sin(t / 7 + i * 0.31)) * 40;
          return <span key={i} className="w-[4px] rounded-full bg-[#1fc16b]" style={{ height: h }} />;
        })}
      </div>
      <div className="mt-5 flex gap-5">
        <span className="flex size-11 items-center justify-center rounded-full bg-white/10">
          <RiMicLine className="size-5" />
        </span>
        <span className="flex size-12 items-center justify-center rounded-full bg-[#fb3748]">
          <RiPhoneFill className="size-6 rotate-[135deg]" />
        </span>
      </div>
    </div>
  );
}

const SUMMARY = ["Wants a demo for a team of 6 SDRs", "Runs HubSpot and Apollo today", "Next step: Thursday, 10:00"];
export function SummaryCard({ t, width = 420 }: { t: number; width?: number }) {
  return (
    <div className="p-5" style={{ width }}>
      <p className="flex items-center gap-1.5 text-label-sm text-[#5b33d6]">
        <RiSparkling2Line className="size-4" /> Call summary · 4:12
      </p>
      <ul className="mt-3 space-y-2 text-[15px] text-text-strong-950">
        {SUMMARY.map((line, i) => (
          <li key={line} className="flex items-start gap-2" style={{ opacity: tw(t, i * 6, 6) }}>
            <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#1fc16b]" />
            {typed(line, t, i * 6, 80)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inbox                                                               */
/* ------------------------------------------------------------------ */

function ChannelDot({ channel }: { channel: Channel }) {
  const C = CHANNELS[channel];
  return (
    <span className="flex size-4 items-center justify-center rounded-full text-white ring-2 ring-bg-white-0" style={{ background: C.color }}>
      <C.icon className="size-2.5" />
    </span>
  );
}

const REPLIES: { name: string; company: string; channel: Channel; text: string; cat: string }[] = [
  { name: "Maya Chen", company: "Northwind Labs", channel: "email", text: "Sure — what would that look like for us?", cat: "Meeting requested" },
  { name: "Daniel Okafor", company: "Brightloop", channel: "linkedin", text: "Interesting — can you send a short deck?", cat: "Interested" },
  { name: "Priya Raman", company: "Ledgerly", channel: "whatsapp", text: "Can we do Thursday instead?", cat: "Meeting requested" },
  { name: "Lucas Meyer", company: "Parcelly", channel: "email", text: "Not this quarter, try me in January.", cat: "Follow up later" },
];

/** The unified inbox: the app's real conversation rows, each classified by AI. */
export function InboxList({ t, width = 380, classifyAt = 10 }: { t: number; width?: number; classifyAt?: number }) {
  return (
    <div style={{ width }} className="px-1.5 py-1.5">
      {REPLIES.map((m, i) => {
        const a = tw(t, i * 4, 8);
        const done = t >= classifyAt + i * 5;
        return (
          <div key={m.name} style={{ opacity: a, transform: `translateY(${(1 - a) * -10}px)` }}>
            <ConversationRow
              selected={i === 0}
              unread={i > 0}
              onSelect={() => {}}
              avatar={<InboxAvatar name={m.name} />}
              accent={<ChannelDot channel={m.channel} />}
              title={m.name}
              subtitle={m.company}
              time="now"
              snippet={m.text}
              meta={
                done ? (
                  <>
                    <CategoryChip categoryKey={i === 3 ? "other" : "interested"} label={m.cat} />
                    {i < 3 && <DraftChip />}
                  </>
                ) : (
                  <span className="inline-flex h-5 items-center gap-1 rounded-md bg-bg-weak-50 px-1.5 text-label-xs text-text-soft-400 ring-1 ring-inset ring-stroke-soft-200">
                    <RiSparkling2Line className="size-3" /> Reading…
                  </span>
                )
              }
            />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Measure                                                             */
/* ------------------------------------------------------------------ */

export function Kpi({ label, value, delta, icon: Icon, width = 220 }: { label: string; value: string; delta?: string; icon?: ComponentType<{ className?: string }>; width?: number }) {
  return (
    <div className="p-4" style={{ width }}>
      <div className="flex items-center gap-2 text-paragraph-xs text-text-sub-600">
        {Icon && (
          <span className="flex size-6 items-center justify-center rounded-md bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200">
            <Icon className="size-3.5 text-text-sub-600" />
          </span>
        )}
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-text-strong-950">{value}</span>
        {delta && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-success-lighter px-1.5 py-0.5 text-label-xs text-success-base">
            <RiArrowRightUpLine className="size-3" />
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

const SERIES = [12, 18, 15, 22, 19, 27, 24, 31, 28, 36, 33, 41, 38, 47, 44, 52, 49, 58, 55, 63, 60, 71];
/** Replies over time, drawing itself in. */
export function Chart({ t, width = 560, height = 200, drawAt = 0 }: { t: number; width?: number; height?: number; drawAt?: number }) {
  const max = 75;
  const pts = SERIES.map((v, i) => [(i / (SERIES.length - 1)) * width, height - (v / max) * height] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const p = tw(t, drawAt, 24);
  return (
    <div className="p-4" style={{ width: width + 32 }}>
      <p className="text-label-sm text-text-strong-950">Replies over time</p>
      <p className="mb-3 text-paragraph-xs text-text-soft-400">All channels · last 30 days</p>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#335cff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#335cff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="reveal">
            <rect x="0" y="-10" width={width * p} height={height + 20} />
          </clipPath>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={width} y1={height * g} y2={height * g} stroke="#ebebeb" strokeDasharray="3 4" />
        ))}
        <g clipPath="url(#reveal)">
          <path d={`${line} L${width},${height} L0,${height} Z`} fill="url(#fill)" />
          <path d={line} fill="none" stroke="#335cff" strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

/** The agents' feed: what each one has ready for you. */
export const FEED: { icon: ComponentType<{ className?: string; style?: CSSProperties }>; color: string; title: string; detail: string }[] = [
  { icon: RiUserSearchLine, color: PURPLE, title: "Lead finder", detail: "1,240 leads ready" },
  { icon: RiFlashlightLine, color: AMBER, title: "Enrichment", detail: "1,108 emails verified" },
  { icon: RiMailFill, color: ORANGE, title: "Email sequences", detail: "3 running · 412 sent today" },
  { icon: RiLinkedinBoxFill, color: LI_BLUE, title: "LinkedIn", detail: "19 invites · 7 accepted" },
  { icon: RiWhatsappFill, color: WA_GREEN, title: "WhatsApp", detail: "12 chats · 2 calls recorded" },
  { icon: RiSparkling2Line, color: BLUE, title: "Reply drafts", detail: "11 waiting for approval" },
  { icon: RiCalendarCheckLine, color: TEAL, title: "Meetings", detail: "4 booked this week" },
];

export function FeedList({ t, width = 360, every = 3 }: { t: number; width?: number; every?: number }) {
  return (
    <div style={{ width }} className="space-y-1.5 p-3">
      {FEED.map((f, i) => {
        const a = tw(t, i * every, 8);
        return (
          <div key={f.title} className="flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ring-stroke-soft-200" style={{ opacity: a, transform: `translateX(${(1 - a) * 14}px)` }}>
            <f.icon className="size-5" style={{ color: f.color }} />
            <span className="flex-1">
              <span className="block text-label-xs uppercase tracking-[0.03em] text-text-strong-950">{f.title}</span>
              <span className="block text-paragraph-xs text-text-soft-400">{f.detail}</span>
            </span>
            <span className="text-text-soft-400">›</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Talk to AI SDR                                                      */
/* ------------------------------------------------------------------ */

export function SdrMark({ size = 22 }: { size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center bg-gradient-to-b from-[#5b7bff] to-[#1f3bad]" style={{ width: size, height: size, borderRadius: "14%" }}>
      <AgentMark className="size-[62%] text-white" />
    </span>
  );
}

export function AiMsg({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={style}>
      <p className="mb-1.5 flex items-center gap-1.5 text-label-xs text-text-soft-400">
        <SdrMark size={16} /> AI SDR
      </p>
      <div className="rounded-2xl rounded-tl-md bg-white px-4 py-2.5 text-[15px] leading-[1.5] text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">{children}</div>
    </div>
  );
}

export function ChatPanel({ t, width = 420, children }: { t: number; width?: number; children?: ReactNode }) {
  return (
    <div style={{ width }} className="flex h-full flex-col">
      <Head icon={RiSparkling2Line} color={BLUE} title="Talk to AI SDR" />
      <div className="flex-1 space-y-3 p-4">
        {children ?? (
          <AiMsg style={{ opacity: tw(t, 0, 8) }}>
            Hi, I&apos;m your AI SDR. I find leads, run every channel and draft each reply — pick anything from the feed, or ask me.
          </AiMsg>
        )}
      </div>
      <div className="m-3 rounded-2xl px-4 py-3 text-[14px] text-text-soft-400 ring-1 ring-inset ring-stroke-soft-200">Ask me anything…</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Integrations                                                        */
/* ------------------------------------------------------------------ */

export function IntegrationCard({ src, name, detail, connected = false }: { src: string; name: string; detail: string; connected?: boolean }) {
  return (
    <div className="flex w-[330px] items-start gap-3 rounded-2xl bg-white p-4" style={{ boxShadow: "0 0 0 1px rgb(14 18 27 / 0.07), 0 12px 28px -14px rgb(14 18 27 / 0.2)" }}>
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-stroke-soft-200">
        <Img src={staticFile(src)} style={{ width: 30, height: 30, objectFit: "contain" }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px] font-medium text-text-strong-950">
          {name}
          {connected && <span className="rounded bg-success-lighter px-1.5 text-[11px] font-medium text-success-base">Connected</span>}
        </span>
        <span className="block truncate text-[13px] text-text-soft-400">{detail}</span>
      </span>
      <span className="mt-1 inline-flex h-7 shrink-0 items-center rounded-md bg-[#141414] px-2.5 text-[12px] font-medium text-white">Connect</span>
    </div>
  );
}

export { RiCloseLine };
