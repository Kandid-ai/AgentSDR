"use client";

import { Stage } from "@/components/landing/motion/Stage";
import { Showcase } from "@/components/landing/Showcase";
import { tween } from "@/components/landing/motion/timeline";

/**
 * The Overview's conversion funnel (Reached, Replied, Positive, Meeting,
 * Customer) drawn in the site's style, bars growing in turn. Sample numbers
 * for one fictional small team over 30 days.
 */

const STAGES = [
  { label: "Reached", value: 1240, color: "#335cff" },
  { label: "Replied", value: 118, color: "#335cff" },
  { label: "Positive", value: 41, color: "#1daf9c" },
  { label: "Meeting", value: 17, color: "#1daf9c" },
  { label: "Customer", value: 5, color: "#7d52f4" },
] as const;

const CYCLE = 9500;
const FINAL = 5200;

export function FunnelChart() {
  return (
    <Showcase label="A conversion funnel from reached to customer, drawn with sample data.">
      <Stage cycle={CYCLE} final={FINAL} className="w-full">
        {({ t }) => (
          <div className="w-full rounded-3xl bg-white p-5 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_24px_60px_-24px_rgb(14_18_27/0.28)] sm:p-7">
            <div className="flex items-baseline justify-between">
              <p className="text-[14px] font-medium text-[#141414]">Conversion funnel</p>
              <p className="text-[12px] text-[#8a8a8a]">Last 30 days, sample data</p>
            </div>
            <ol className="mt-5 grid gap-3.5">
              {STAGES.map((s, i) => {
                const at = 400 + i * 700;
                const grow = tween(t, at, 900, 0, 1);
                // A log-ish scale keeps the small stages visible next to 1,240.
                const width = Math.max(4, (Math.sqrt(s.value) / Math.sqrt(STAGES[0].value)) * 100) * grow;
                const prev = i === 0 ? null : Math.round((s.value / STAGES[i - 1].value) * 100);
                return (
                  <li key={s.label} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 sm:grid-cols-[5.5rem_1fr]">
                    <span className="text-[13px] text-[#525866]">{s.label}</span>
                    <div className="flex items-center gap-3">
                      <div className="h-8 rounded-lg" style={{ width: `${width}%`, background: s.color, opacity: 0.18 + 0.82 * grow }} />
                      <span className="whitespace-nowrap text-[14px] font-medium tabular-nums text-[#141414]" style={{ opacity: grow }}>
                        {Math.round(s.value * grow).toLocaleString("en-US")}
                        {prev !== null && <span className="ml-2 text-[12px] font-normal text-[#8a8a8a]">{prev}% of previous</span>}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-5 text-[12px] leading-5 text-[#8a8a8a]">Bar length is square-root scaled so small stages stay visible. Counts are for the period, not one cohort followed from first touch.</p>
          </div>
        )}
      </Stage>
    </Showcase>
  );
}
