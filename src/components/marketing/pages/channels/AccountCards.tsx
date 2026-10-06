"use client";

import { cn } from "@/utils/cn";
import { useClock } from "./useClock";

/**
 * Three LinkedIn accounts and the statuses the Accounts page shows
 * (Connected, Limit reached, Disconnected) with requests sent today against
 * each account's limit. Sample accounts, fictional names.
 */

const ACCOUNTS = [
  { name: "Ana Rivera", plan: "Premium", sent: 30, limit: 30, status: "Limit reached" },
  { name: "Ben Hollis", plan: "Sales Navigator", sent: 18, limit: 30, status: "Connected" },
  { name: "Chloe Marsh", plan: "Free", sent: 0, limit: 5, status: "Disconnected" },
] as const;

const TONE = {
  Connected: { dot: "#1fc16b", bg: "#e8f8ef", text: "#0e7a43" },
  "Limit reached": { dot: "#fa7319", bg: "#fff4e5", text: "#a35200" },
  Disconnected: { dot: "#8a8f98", bg: "#eef0f3", text: "#525866" },
} as const;

export function AccountCards({ accent = "#335cff" }: { accent?: string }) {
  const { ref, p } = useClock(4000);
  return (
    <div ref={ref} className="rounded-[28px] bg-[#f4f5f7] p-4 sm:p-6" role="img" aria-label="Three LinkedIn accounts with their status and connection requests sent today. An illustration with sample data.">
      <ul className="space-y-3">
        {ACCOUNTS.map((a, i) => {
          const on = p > i * 0.22;
          const fill = Math.min(1, Math.max(0, (p - i * 0.22) / 0.5));
          const shown = Math.round(a.sent * fill);
          const tone = TONE[a.status];
          return (
            <li key={a.name} className={cn("rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_12px_30px_-18px_rgb(14_18_27/0.22)] transition-all duration-500", on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium leading-[24px] text-[#141414]">{a.name}</p>
                  <p className="text-[12px] text-[#8a8f98]">{a.plan}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: tone.bg, color: tone.text }}>
                  <span className="size-1.5 rounded-full" style={{ background: tone.dot }} />
                  {a.status}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eceef1]">
                  <div className="h-full rounded-full" style={{ width: `${(shown / a.limit) * 100}%`, background: a.status === "Limit reached" ? "#fa7319" : accent }} />
                </div>
                <span className="font-mono text-[12px] tabular-nums text-[#656565]">
                  {shown} / {a.limit} today
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 px-1 text-[12px] text-[#8a8f98]">Sample accounts. Illustration.</p>
    </div>
  );
}
