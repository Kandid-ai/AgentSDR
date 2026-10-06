"use client";

import { RiCheckLine } from "@remixicon/react";
import { Stage } from "@/components/landing/motion/Stage";
import { Showcase } from "@/components/landing/Showcase";
import { cn } from "@/utils/cn";
import { Fade, MonoLabel } from "./Fade";

/**
 * How a LinkedIn account's daily invitation limit is resolved: the account's
 * own limit, else the organization's rule, else the built-in default (30 for
 * Premium or Sales Navigator accounts). Three accounts, fictional names.
 */

type Row = { account: string; own: number | null; org: number | null; fallback: number; kind: "Premium" };
const DEFAULT_PREMIUM = 30;
const ROWS: readonly Row[] = [
  { account: "Priya Nair", own: 20, org: 25, fallback: DEFAULT_PREMIUM, kind: "Premium" },
  { account: "Marcus Bell", own: null, org: 25, fallback: DEFAULT_PREMIUM, kind: "Premium" },
  { account: "Elena Ruiz", own: null, org: null, fallback: DEFAULT_PREMIUM, kind: "Premium" },
];
const PHASE = 3000;

export function LimitStack({ className }: { className?: string }) {
  return (
    <Showcase label="A LinkedIn account's daily invite limit resolved in order: its own limit, then the organization's rule, then the default. An illustration with sample data." className={className}>
      <Stage cycle={PHASE * 3 + 900} final={PHASE * 3 - 600}>
        {({ t }) => {
          const i = Math.min(2, Math.max(0, Math.floor(t / PHASE)));
          const lt = t - i * PHASE;
          const row = ROWS[i];
          const winner = row.own !== null ? 0 : row.org !== null ? 1 : 2;
          const steps = [
            { label: "Account's own limit", value: row.own, note: "Set on LinkedIn, Accounts" },
            { label: "Organization rule", value: row.org, note: "Settings, LinkedIn, Sending rules" },
            { label: "Built-in default", value: row.fallback, note: "Premium or Sales Navigator" },
          ];
          return (
            <div className="w-full rounded-[22px] bg-white p-4 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_24px_60px_-24px_rgb(14_18_27/0.35)] sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <MonoLabel className="text-[#8a8a8a]">Invitations per day</MonoLabel>
                  <p className="mt-1 text-[18px] font-medium tracking-[-0.01em] text-[#141414]">{row.account}</p>
                </div>
                <div className="flex gap-1.5" aria-hidden="true">
                  {ROWS.map((r, n) => (
                    <span key={r.account} className={cn("h-1.5 w-6 rounded-full transition-colors duration-300", n === i ? "bg-[#335cff]" : "bg-black/10")} />
                  ))}
                </div>
              </div>
              <ol className="mt-5 grid gap-2.5">
                {steps.map((s, n) => {
                  const checked = lt >= 400 + n * 450;
                  const skipped = s.value === null;
                  const won = lt >= 1700 && n === winner;
                  return (
                    <li key={s.label}>
                      <Fade on={checked} from="left" className={cn("flex items-center gap-3 rounded-2xl p-3.5 ring-1 transition-colors duration-300", won ? "bg-[#335cff]/[0.07] ring-[#335cff]/40" : "bg-[#f7f7f8] ring-transparent", lt >= 1700 && !won && "opacity-60")}>
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white font-[family-name:var(--font-landing-mono)] text-[12px] text-[#525866] shadow-[0_0_0_1px_rgb(0_0_0/0.07)]">{n + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-medium leading-5 text-[#141414]">{s.label}</p>
                          <p className="text-[12px] leading-4 text-[#8a8a8a]">{s.note}</p>
                        </div>
                        <span className={cn("text-[14px] tabular-nums", skipped ? "text-[#a0a0a0]" : "font-medium text-[#141414]")}>{skipped ? "not set" : s.value}</span>
                        {won && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-[#335cff] text-white">
                            <RiCheckLine className="size-3.5" aria-hidden="true" />
                          </span>
                        )}
                      </Fade>
                    </li>
                  );
                })}
              </ol>
              <Fade on={lt >= 1900} className="mt-4 flex items-baseline gap-2 rounded-2xl bg-[#141414] px-4 py-3 text-white">
                <span className="font-[family-name:var(--font-brand-display)] text-[28px] font-medium leading-none tracking-[-0.03em] tabular-nums">{steps[winner].value}</span>
                <span className="text-[13px] text-white/70">invitations a day for {row.account.split(" ")[0]}</span>
              </Fade>
              <p className="mt-3 text-[12px] leading-[18px] text-[#8a8a8a]">The organization&rsquo;s value of 25 is an example, not a default. An illustration with sample data.</p>
            </div>
          );
        }}
      </Stage>
    </Showcase>
  );
}
