"use client";

import { RiLinkedinBoxFill, RiMailFill, RiWhatsappFill } from "@remixicon/react";
import { Stage } from "@/components/landing/motion/Stage";
import { Showcase } from "@/components/landing/Showcase";
import { tween } from "@/components/landing/motion/timeline";

/**
 * The Overview's Channels table (Reached, Replied, Reply rate, Positive)
 * as animated bars. Sample numbers; reply rate here is replied divided by reached.
 */

const ROWS = [
  { label: "Email", icon: RiMailFill, color: "#fa7319", reached: 760, replied: 62, positive: 21 },
  { label: "LinkedIn", icon: RiLinkedinBoxFill, color: "#335cff", reached: 380, replied: 41, positive: 15 },
  { label: "WhatsApp", icon: RiWhatsappFill, color: "#1fc16b", reached: 100, replied: 15, positive: 5 },
] as const;

const CYCLE = 9000;
const FINAL = 4200;

export function ChannelRates() {
  return (
    <Showcase label="Reach and reply rate compared across email, LinkedIn and WhatsApp, drawn with sample data.">
      <Stage cycle={CYCLE} final={FINAL} className="w-full">
        {({ t }) => (
          <div className="w-full rounded-3xl bg-white p-5 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_24px_60px_-24px_rgb(14_18_27/0.28)] sm:p-7">
            <div className="flex items-baseline justify-between">
              <p className="text-[14px] font-medium text-[#141414]">Channels</p>
              <p className="text-[12px] text-[#8a8a8a]">Sample data</p>
            </div>
            <ul className="mt-5 grid gap-5">
              {ROWS.map((r, i) => {
                const g = tween(t, 400 + i * 600, 1000, 0, 1);
                const rate = (r.replied / r.reached) * 100;
                const Icon = r.icon;
                return (
                  <li key={r.label}>
                    <div className="flex items-center gap-2 text-[14px]">
                      <Icon className="size-4" style={{ color: r.color }} aria-hidden="true" />
                      <span className="font-medium text-[#141414]">{r.label}</span>
                      <span className="ml-auto text-[13px] tabular-nums text-[#525866]">
                        {Math.round(r.reached * g)} reached · {Math.round(r.replied * g)} replied · {Math.round(r.positive * g)} positive
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (rate / 20) * 100) * g}%`, background: r.color }} />
                      </div>
                      <span className="w-14 text-right text-[14px] font-medium tabular-nums text-[#141414]">{(rate * g).toFixed(1)}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 text-[12px] leading-5 text-[#8a8a8a]">Reply rate is people who replied divided by people reached, on a 0 to 20% scale.</p>
          </div>
        )}
      </Stage>
    </Showcase>
  );
}
