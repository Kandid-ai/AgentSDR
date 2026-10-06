"use client";

import { useState } from "react";
import { RiReplay5Line } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { useClock } from "./useClock";

/**
 * One working day (09:00 to 18:00) of a LinkedIn account sending invitations
 * in short runs with long rests, stopping at its daily limit. The run sizes
 * and rests are a sample inside the default ranges in
 * src/lib/channels/rules.ts (3 to 4 invitations a run, 30 to 60 minutes of
 * rest); the limits are the real defaults (30 Premium, 5 free).
 */

const DAY_START = 9 * 60;
const DAY_MINUTES = 9 * 60;
const RUN_SIZES = [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4];
const RESTS = [40, 55, 35, 50, 45, 60, 30, 45, 55, 40, 50];
const SPACING = 0.75; // minutes between invitations in a run (about 45 s)

type Invite = { at: number; run: number; index: number };

const INVITES: Invite[] = (() => {
  const out: Invite[] = [];
  let clock = 0;
  let index = 0;
  RUN_SIZES.forEach((size, run) => {
    for (let i = 0; i < size; i++) out.push({ at: clock + i * SPACING, run, index: index++ });
    clock += size * SPACING + (RESTS[run] ?? 45);
  });
  return out.filter((inv) => inv.at < DAY_MINUTES);
})();

const PLANS = {
  premium: { label: "Premium or Sales Navigator", limit: 30 },
  free: { label: "Free account", limit: 5 },
} as const;
type PlanKey = keyof typeof PLANS;

function clockLabel(minutes: number) {
  const m = Math.floor(DAY_START + minutes);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function PacingTimeline({ accent = "#335cff" }: { accent?: string }) {
  const [plan, setPlan] = useState<PlanKey>("premium");
  const { ref, p, reduced, replay, started } = useClock(9000);
  const limit = PLANS[plan].limit;
  const now = p * DAY_MINUTES;
  const sent = INVITES.filter((inv) => inv.index < limit && inv.at <= now).length;
  const total = Math.min(limit, INVITES.length);
  const capped = sent >= limit;

  return (
    <div ref={ref} className="rounded-[28px] bg-[#f4f5f7] p-4 sm:p-6" role="img" aria-label={`A sample working day: invitations go out in short runs with long rests, and stop at the daily limit of ${limit}. An illustration.`}>
      <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_16px_40px_-20px_rgb(14_18_27/0.22)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Account type" className="inline-flex rounded-full bg-[#f1f2f4] p-1 text-[13px] font-medium">
            {(Object.keys(PLANS) as PlanKey[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={plan === key}
                onClick={() => {
                  setPlan(key);
                  replay();
                }}
                className={cn("rounded-full px-3 py-1.5 transition-colors", plan === key ? "bg-white text-[#141414] shadow-[0_1px_2px_rgb(0_0_0/0.12)]" : "text-[#656565] hover:text-[#141414]")}
              >
                {key === "premium" ? "Premium" : "Free"}
              </button>
            ))}
          </div>
          <span className="font-mono text-[12px] tabular-nums text-[#656565]">{started ? clockLabel(now) : "09:00"}</span>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-brand-display)] text-[48px] font-medium leading-none tracking-[-0.04em] text-[#141414] tabular-nums">
              {sent}
              <span className="text-[#a1a1a1]"> / {limit}</span>
            </p>
            <p className="mt-2 text-[14px] leading-[22px] text-[#656565]">connection requests today, {PLANS[plan].label.toLowerCase()}</p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-[12px] font-medium transition-colors", capped ? "bg-[#fff4e5] text-[#a35200]" : "bg-[#eef2ff] text-[#335cff]")} style={capped ? undefined : { color: accent }}>
            {capped ? "Daily limit reached" : "Sending in runs"}
          </span>
        </div>

        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[#eceef1]">
          <div className="h-full rounded-full" style={{ width: `${(sent / total) * 100}%`, background: accent, transition: "width 200ms linear" }} />
        </div>

        <div className="relative mt-7 h-[44px]">
          <div className="absolute inset-x-0 top-1/2 h-px bg-[#e4e6ea]" />
          {INVITES.map((inv) => {
            const beyond = inv.index >= limit;
            const done = inv.at <= now;
            return (
              <span
                key={inv.index}
                className="absolute top-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${(inv.at / DAY_MINUTES) * 100}%`,
                  background: beyond ? "#d4d7dd" : done ? accent : "#c9cdd4",
                  transform: `translate(-50%, -50%) scale(${done && !beyond ? 1.5 : 1})`,
                  transition: "background 200ms, transform 200ms",
                }}
              />
            );
          })}
          <div className="absolute inset-y-0 w-px bg-[#141414]/70" style={{ left: `${p * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[11px] text-[#8a8f98]">
          <span>09:00</span>
          <span>12:00</span>
          <span>15:00</span>
          <span>18:00</span>
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-[#eceef1] pt-5 text-[13px] leading-[20px]">
          <div>
            <dt className="text-[#8a8f98]">Per run</dt>
            <dd className="font-medium text-[#141414]">3 to 4 invites</dd>
          </div>
          <div>
            <dt className="text-[#8a8f98]">Between invites</dt>
            <dd className="font-medium text-[#141414]">30 to 60 s</dd>
          </div>
          <div>
            <dt className="text-[#8a8f98]">Rest after a run</dt>
            <dd className="font-medium text-[#141414]">30 to 60 min</dd>
          </div>
        </dl>
      </div>
      <div className="mt-3 flex items-center justify-between px-1 text-[12px] text-[#8a8f98]">
        <span>Sample day inside the default ranges. Illustration.</span>
        {!reduced && (
          <button type="button" onClick={replay} aria-label="Replay the sample day" className="flex items-center gap-1 rounded-full px-2 py-1 hover:text-[#141414]">
            <RiReplay5Line className="size-4" aria-hidden="true" /> Replay
          </button>
        )}
      </div>
    </div>
  );
}
