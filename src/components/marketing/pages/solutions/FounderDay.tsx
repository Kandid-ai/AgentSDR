"use client";

import { RiCheckLine, RiLinkedinBoxFill, RiMailFill, RiSparkling2Line, RiTimeLine, RiWhatsappFill } from "@remixicon/react";
import { Stage } from "@/components/landing/motion/Stage";
import { Showcase } from "@/components/landing/Showcase";
import { cn } from "@/utils/cn";
import { Fade, MonoLabel } from "./Fade";

/**
 * "A day of founder-led outbound": a timeline from the first send to an empty
 * Action required queue. Every person and company is fictional; the pacing
 * (sending hours from 09:00, an 18 to 24 minute gap per mailbox) follows the
 * default Sending rules.
 */

type Channel = "email" | "linkedin" | "whatsapp" | "ai";
type Event = { at: number; time: string; channel: Channel; title: string; detail: string; tag?: string; tone?: "blue" | "green" | "orange" };

const EVENTS: readonly Event[] = [
  { at: 500, time: "09:00", channel: "email", title: "Sending hours open", detail: "The first email goes out. The next from this mailbox follows 18 to 24 minutes later." },
  { at: 1700, time: "10:40", channel: "email", title: "Dana Whitfield, Ledgerly, replies", detail: "“Can you send pricing?” The remaining emails in her sequence are cancelled.", tag: "Information Requested", tone: "blue" },
  { at: 2900, time: "10:41", channel: "ai", title: "Draft ready in Action required", detail: "Classified and answered from your knowledge base. Nothing sends until you approve." },
  { at: 4100, time: "13:15", channel: "linkedin", title: "Tomas Reyes accepted your invite", detail: "The first follow-up is queued inside his account's working hours." },
  { at: 5300, time: "15:30", channel: "whatsapp", title: "Aisha Khan, Brightpath, replies", detail: "“Tuesday works for a call.” Her email and LinkedIn steps stop.", tag: "Meeting Requested", tone: "green" },
  { at: 6500, time: "16:05", channel: "ai", title: "You work the queue", detail: "Review the drafts, edit or approve them, and send." },
];
const COUNT_STEPS = [
  { at: 1700, n: 1 },
  { at: 5300, n: 2 },
  { at: 6500, n: 0 },
] as const;

const ICON = { email: RiMailFill, linkedin: RiLinkedinBoxFill, whatsapp: RiWhatsappFill, ai: RiSparkling2Line };
const COLOR: Record<Channel, string> = { email: "#fa7319", linkedin: "#335cff", whatsapp: "#1fc16b", ai: "#7d52f4" };
const TAG: Record<NonNullable<Event["tone"]>, string> = { blue: "bg-[#335cff]/10 text-[#2547d0]", green: "bg-[#1fc16b]/12 text-[#178c4e]", orange: "bg-[#fa7319]/12 text-[#c2570c]" };

export function FounderDay() {
  return (
    <Showcase label="A day of founder-led outbound as a timeline. An illustration with sample data.">
      <Stage cycle={10500} final={8400}>
        {({ t }) => {
          const pending = COUNT_STEPS.reduce((n, s) => (t >= s.at ? s.n : n), 0);
          const done = t >= 7700;
          const progress = Math.min(1, Math.max(0, (t - 300) / 6400));
          return (
            <div className="w-full overflow-hidden rounded-[28px] bg-[#f7f7f8] p-4 ring-1 ring-black/[0.05] sm:p-8">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
                <ol className="relative grid gap-4">
                  <span aria-hidden="true" className="absolute bottom-3 left-[19px] top-3 w-px bg-black/[0.08]" />
                  <span aria-hidden="true" className="absolute left-[19px] top-3 w-px bg-[#335cff] transition-[height] duration-300 ease-out" style={{ height: `calc((100% - 24px) * ${progress})` }} />
                  {EVENTS.map((e) => {
                    const Icon = ICON[e.channel];
                    return (
                      <li key={e.time + e.title}>
                        <Fade on={t >= e.at} from="left" className="relative flex gap-4">
                          <span className="relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.07)]" style={{ color: COLOR[e.channel] }}>
                            <Icon className="size-[18px]" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1 rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.05)]">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <MonoLabel className="text-[#8a8a8a]">{e.time}</MonoLabel>
                              <p className="text-[15px] font-medium leading-5 text-[#141414]">{e.title}</p>
                              {e.tag && e.tone && <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", TAG[e.tone])}>{e.tag}</span>}
                            </div>
                            <p className="mt-1.5 text-[14px] leading-[21px] text-[#656565]">{e.detail}</p>
                          </div>
                        </Fade>
                      </li>
                    );
                  })}
                </ol>
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <div className="rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.05)]">
                    <MonoLabel className="text-[#8a8a8a]">Action required</MonoLabel>
                    <p className="mt-3 font-[family-name:var(--font-brand-display)] text-[64px] font-medium leading-none tracking-[-0.04em] text-[#141414] tabular-nums">{pending}</p>
                    <p className="mt-2 min-h-[44px] text-[14px] leading-[22px] text-[#656565]">{done ? "Queue empty. Sequences keep sending on their own." : pending > 0 ? "Replies waiting on you, drafts attached." : "Nothing waiting yet."}</p>
                    <div className={cn("mt-3 flex items-center gap-2 text-[13px] font-medium transition-opacity duration-500", done ? "text-[#178c4e] opacity-100" : "opacity-0")}>
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#1fc16b] text-white">
                        <RiCheckLine className="size-3.5" aria-hidden="true" />
                      </span>
                      Done for the day
                    </div>
                  </div>
                  <p className="mt-3 flex items-start gap-2 text-[12px] leading-[18px] text-[#8a8a8a]">
                    <RiTimeLine className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    An illustration with sample data. Sending hours default to Monday to Friday, 09:00 to 18:00.
                  </p>
                </div>
              </div>
            </div>
          );
        }}
      </Stage>
    </Showcase>
  );
}
