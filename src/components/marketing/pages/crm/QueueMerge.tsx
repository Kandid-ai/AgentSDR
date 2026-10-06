"use client";

import type { ReactNode } from "react";
import { RiLinkedinBoxFill, RiMailFill, RiSparkling2Line, RiWhatsappFill } from "@remixicon/react";
import { CRM_CATEGORY_COLOR } from "@/components/analytics/theme";
import { Stage } from "@/components/landing/motion/Stage";
import { Showcase } from "@/components/landing/Showcase";
import { clamp01, easeOut } from "@/components/landing/motion/timeline";

/**
 * One queue, three channels: a reply arrives on email, LinkedIn and WhatsApp,
 * each travels into a single Action required list with an AI draft ready, and
 * the lead's other pending steps are cancelled. Sample people, all fictional.
 */

const CYCLE = 10_500;
const START = 500;
const GAP = 1400;
const FINAL = START + GAP * 2 + 3600;
const ROW_H = 76;

type Msg = { channel: "email" | "linkedin" | "whatsapp"; name: string; text: string; category: keyof typeof CRM_CATEGORY_COLOR; label: string };

const MSGS: readonly Msg[] = [
  { channel: "email", name: "Nadia Ferreira", text: "Can you send pricing for ten seats?", category: "interested", label: "Information Requested" },
  { channel: "linkedin", name: "Hannah Weiss", text: "Sounds good. Thursday afternoon?", category: "interested", label: "Meeting Requested" },
  { channel: "whatsapp", name: "Omar Haddad", text: "Not now, try us again in spring.", category: "not_interested", label: "Not Required Right Now" },
];

const ICON: Record<Msg["channel"], { node: ReactNode; label: string }> = {
  email: { node: <RiMailFill className="size-4 text-[#fa7319]" aria-hidden="true" />, label: "Email" },
  linkedin: { node: <RiLinkedinBoxFill className="size-4 text-[#335cff]" aria-hidden="true" />, label: "LinkedIn" },
  whatsapp: { node: <RiWhatsappFill className="size-4 text-[#1fc16b]" aria-hidden="true" />, label: "WhatsApp" },
};

const H = ROW_H * 3 + 16;
const MID = H / 2;
const rowY = (i: number) => 8 + ROW_H * i + ROW_H / 2;

/** A point along the cubic from the left row to the merge point. */
function along(i: number, p: number) {
  const y0 = rowY(i);
  const u = 1 - p;
  const x = 3 * u * u * p * 48 + 3 * u * p * p * 48 + p * p * p * 96;
  const y = u * u * u * y0 + 3 * u * u * p * y0 + 3 * u * p * p * MID + p * p * p * MID;
  return { x, y };
}

export function QueueMerge() {
  return (
    <Showcase label="Replies from email, LinkedIn and WhatsApp merging into one Action required queue. An illustration with sample data.">
      <Stage cycle={CYCLE} final={FINAL} className="w-full">
        {({ t }) => {
          const arrived = MSGS.filter((_, i) => t >= START + i * GAP + 1100).length;
          const stopAt = START + GAP * 2 + 2300;
          return (
            <div className="w-full rounded-3xl bg-white p-3 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_24px_60px_-24px_rgb(14_18_27/0.28)] sm:p-5">
              <div className="flex items-stretch gap-0">
                <div className="w-[34%] min-w-0 shrink-0" style={{ paddingTop: 8 }}>
                  {MSGS.map((m, i) => {
                    const shown = clamp01((t - (START + i * GAP)) / 450);
                    const sent = clamp01((t - (START + i * GAP + 700)) / 500);
                    return (
                      <div key={m.name} className="flex items-center" style={{ height: ROW_H, opacity: shown * (1 - sent * 0.55), transform: `translateX(${(1 - shown) * -12}px)` }}>
                        <div className="min-w-0 rounded-xl bg-[#f7f7f8] p-2.5 ring-1 ring-black/[0.04]">
                          <p className="flex items-center gap-1.5 text-[12px] font-medium text-[#141414]">
                            {ICON[m.channel].node}
                            <span className="truncate">{ICON[m.channel].label}</span>
                          </p>
                          <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-[#525866]">{m.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <svg aria-hidden="true" width="96" height={H} viewBox={`0 0 96 ${H}`} className="shrink-0">
                  {MSGS.map((_, i) => (
                    <path key={i} d={`M0 ${rowY(i)} C48 ${rowY(i)} 48 ${MID} 96 ${MID}`} fill="none" stroke="rgb(14 18 27 / 0.12)" strokeWidth="1.5" strokeDasharray="3 4" />
                  ))}
                  {MSGS.map((m, i) => {
                    const p = easeOut((t - (START + i * GAP + 600)) / 800);
                    if (p <= 0 || p >= 1) return null;
                    const { x, y } = along(i, p);
                    return <circle key={m.name} cx={x} cy={y} r="4.5" fill={["#fa7319", "#335cff", "#1fc16b"][i]} />;
                  })}
                </svg>

                <div className="min-w-0 flex-1 rounded-2xl bg-[#f7f7f8] p-2 ring-1 ring-black/[0.04]">
                  <div className="flex items-center justify-between px-2 pb-1.5 pt-1 text-[12px]">
                    <span className="font-medium text-[#141414]">Action required</span>
                    <span className="rounded-full bg-[#7d52f4]/12 px-2 py-0.5 text-[12px] font-medium tabular-nums text-[#5b36c9]">{arrived}</span>
                  </div>
                  <ul className="grid gap-1.5" style={{ minHeight: ROW_H * 3 - 8 }}>
                    {MSGS.map((m, i) => {
                      const p = clamp01((t - (START + i * GAP + 1100)) / 500);
                      return (
                        <li key={m.name} className="rounded-xl bg-white p-2.5 ring-1 ring-black/[0.05]" style={{ opacity: p, transform: `translateX(${(1 - p) * -18}px)`, minHeight: ROW_H - 8 }}>
                          <div className="flex items-center gap-1.5 text-[12px]">
                            {ICON[m.channel].node}
                            <span className="truncate font-medium text-[#141414]">{m.name}</span>
                            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-[#335cff]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#2547d0]">
                              <RiSparkling2Line className="size-3" aria-hidden="true" />
                              <span className="hidden sm:inline">AI draft ready</span>
                              <span className="sm:hidden">Draft</span>
                            </span>
                          </div>
                          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#525866]">
                            <span className="size-1.5 shrink-0 rounded-full" style={{ background: CRM_CATEGORY_COLOR[m.category] }} aria-hidden="true" />
                            <span className="truncate">{m.label}</span>
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-dashed border-black/[0.12] px-3 py-2.5 text-[12px] text-[#525866]" style={{ opacity: clamp01((t - stopAt + 300) / 400) }}>
                <span className="font-medium text-[#141414]">Hannah Weiss replied on LinkedIn.</span> Her other steps stop:
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {["Email follow-up 2", "WhatsApp message 1"].map((s, i) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[12px]" style={{ textDecoration: t >= stopAt + 500 + i * 250 ? "line-through" : "none", opacity: t >= stopAt + 500 + i * 250 ? 0.6 : 1 }}>
                      {s}
                      {t >= stopAt + 500 + i * 250 && <span className="font-medium text-[#c2570c] no-underline">cancelled</span>}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          );
        }}
      </Stage>
    </Showcase>
  );
}
