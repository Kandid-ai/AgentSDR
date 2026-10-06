"use client";

import { RiCheckLine, RiHandHeartLine, RiSparkling2Line } from "@remixicon/react";
import { CRM_CATEGORY_COLOR } from "@/components/analytics/theme";
import { Stage } from "@/components/landing/motion/Stage";
import { Showcase } from "@/components/landing/Showcase";
import { clamp01, tween, within } from "@/components/landing/motion/timeline";
import { cn } from "@/utils/cn";

/**
 * The AI CRM's confidence rules, as they run: each proposal is read against
 * the 85% default threshold and the funnel-stage rules in
 * src/lib/crm/stateMachine.ts, then applied or held for a person. Sample
 * people, all fictional. A pure function of the Stage clock `t`.
 */

const THRESHOLD = 0.85;
const START = 600;
const GAP = 1100;
const CYCLE = 10_500;
const FINAL = START + GAP * 4 + 1800;

type Proposal = {
  name: string;
  company: string;
  from: string;
  to: string;
  category: keyof typeof CRM_CATEGORY_COLOR;
  confidence: number;
  verdict: "applied" | "held";
  reason: string;
};

const PROPOSALS: readonly Proposal[] = [
  { name: "Hannah Weiss", company: "Lumen Freight", from: "Information Requested", to: "Meeting Requested", category: "interested", confidence: 0.94, verdict: "applied", reason: "Forward move, confident" },
  { name: "Tom Okafor", company: "Brightwell", from: "No stage yet", to: "Demo Request", category: "interested", confidence: 0.71, verdict: "held", reason: "Below the 85% threshold" },
  { name: "Priya Nair", company: "Fernhill", from: "Meeting Done", to: "Out of Office", category: "other", confidence: 0.92, verdict: "held", reason: "Backward move on the funnel" },
  { name: "Diego Alvarez", company: "Northbay", from: "Trial User", to: "Customer", category: "customer", confidence: 0.97, verdict: "held", reason: "A new Customer is always reviewed" },
  { name: "Sam Reyes", company: "Quillworks", from: "Meeting Requested", to: "Do Not Contact", category: "not_interested", confidence: 0.99, verdict: "applied", reason: "Asked to stop: applied at once" },
];

export function ConfidenceGate() {
  return (
    <Showcase label="AI classification proposals being applied or held for review. An illustration with sample data.">
      <Stage cycle={CYCLE} final={FINAL} className="w-full">
        {({ t }) => (
          <div className="w-full rounded-3xl bg-white p-3 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_24px_60px_-24px_rgb(14_18_27/0.28)] sm:p-4">
            <div className="flex items-center gap-2 px-2 pb-3 pt-1 text-[13px] text-[#525866]">
              <RiSparkling2Line className="size-4 text-[#7d52f4]" aria-hidden="true" />
              <span className="font-medium text-[#141414]">AI proposals</span>
              <span className="ml-auto rounded-md bg-black/[0.05] px-2 py-0.5 text-[12px]">Apply at {Math.round(THRESHOLD * 100)}% or more</span>
            </div>
            <ul className="grid gap-2">
              {PROPOSALS.map((p, i) => {
                const at = START + i * GAP;
                const shown = clamp01((t - at) / 400);
                const bar = tween(t, at + 250, 700, 0, p.confidence);
                const decided = t >= at + 1000;
                const applied = p.verdict === "applied";
                return (
                  <li key={p.name} className="rounded-2xl bg-[#f7f7f8] p-3 ring-1 ring-black/[0.04]" style={{ opacity: shown, transform: `translateY(${(1 - shown) * 8}px)` }}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[14px] font-medium text-[#141414]">{p.name}</span>
                      <span className="text-[13px] text-[#6b6b6b]">{p.company}</span>
                      <span className="ml-auto inline-flex min-h-6 items-center">
                        <span
                          className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium transition-[opacity,transform] duration-300", applied ? "bg-[#1fc16b]/12 text-[#178c4e]" : "bg-[#e5930a]/14 text-[#9a6206]")}
                          style={{ opacity: decided ? 1 : 0, transform: decided ? "none" : "scale(0.9)" }}
                        >
                          {applied ? <RiCheckLine className="size-3.5" aria-hidden="true" /> : <RiHandHeartLine className="size-3.5" aria-hidden="true" />}
                          {applied ? "Applied" : "Held for you"}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[13px] text-[#525866]">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: CRM_CATEGORY_COLOR[p.category] }} aria-hidden="true" />
                      <span className="min-w-0 truncate">
                        {p.from} <span aria-hidden="true">→</span> <span className="font-medium text-[#141414]">{p.to}</span>
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.07]">
                        <div className="h-full rounded-full" style={{ width: `${bar * 100}%`, background: applied ? "#1fc16b" : "#e5930a" }} />
                        <span aria-hidden="true" className="absolute inset-y-0 w-px bg-[#141414]/40" style={{ left: `${THRESHOLD * 100}%` }} />
                      </div>
                      <span className="w-9 text-right text-[12px] tabular-nums text-[#525866]">{Math.round(bar * 100)}%</span>
                    </div>
                    <p className={cn("mt-2 text-[12px] text-[#6b6b6b] transition-opacity duration-300", within(t, at + 1000, 1e9) ? "opacity-100" : "opacity-0")}>{p.reason}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Stage>
    </Showcase>
  );
}
