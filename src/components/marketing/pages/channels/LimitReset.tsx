"use client";

import { RiReplay5Line } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { useClock } from "./useClock";

/**
 * What happens when LinkedIn refuses an invitation over a limit: the account
 * becomes Limit reached, the lead returns to Pending, and the daily reset
 * clears it (docs/linkedin/campaigns, "When LinkedIn pushes back").
 */

const STAGES = [
  { account: "Connected", lead: "Invite sent", note: "Ana Rivera is sending as usual." },
  { account: "Limit reached", lead: "Back to Pending", note: "LinkedIn refused an invitation over a limit. The account stops for the day and the lead returns to Pending." },
  { account: "Limit reached", lead: "Pending", note: "Another account, or tomorrow, can send it. Nothing for you to do." },
  { account: "Connected", lead: "Invite sent", note: "The daily reset clears the flag and the account resumes by itself." },
] as const;

const TONE: Record<string, { bg: string; text: string }> = {
  Connected: { bg: "#e8f8ef", text: "#0e7a43" },
  "Limit reached": { bg: "#fff4e5", text: "#a35200" },
};

export function LimitReset({ accent = "#335cff" }: { accent?: string }) {
  const { ref, p, reduced, replay } = useClock(8000);
  const i = Math.min(STAGES.length - 1, Math.floor(p * STAGES.length));
  const s = STAGES[i];
  return (
    <div ref={ref} className="rounded-[28px] bg-[#f4f5f7] p-4 sm:p-6" role="img" aria-label="An account hits Limit reached, its lead returns to Pending, and the daily reset clears the limit. An illustration.">
      <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_16px_40px_-20px_rgb(14_18_27/0.22)] sm:p-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#f7f7f8] p-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#8a8f98]">Account</p>
            <span className="mt-2 inline-block rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors duration-500" style={{ background: TONE[s.account].bg, color: TONE[s.account].text }}>
              {s.account}
            </span>
          </div>
          <div className="rounded-xl bg-[#f7f7f8] p-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#8a8f98]">Lead: Dana Whitfield</p>
            <span className="mt-2 inline-block rounded-full px-2.5 py-1 text-[12px] font-medium text-white transition-colors duration-500" style={{ background: s.lead === "Invite sent" ? accent : "#525866" }}>
              {s.lead}
            </span>
          </div>
        </div>
        <p className="mt-4 min-h-[66px] text-[14px] leading-[22px] text-[#141414]">{s.note}</p>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {STAGES.map((_, n) => (
            <span key={n} className={cn("h-1 flex-1 rounded-full transition-colors duration-500", n <= i ? "" : "bg-[#e4e6ea]")} style={n <= i ? { background: accent } : undefined} />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between px-1 text-[12px] text-[#8a8f98]">
        <span>Illustration with sample data.</span>
        {!reduced && (
          <button type="button" onClick={replay} aria-label="Replay" className="flex items-center gap-1 rounded-full px-2 py-1 hover:text-[#141414]">
            <RiReplay5Line className="size-4" aria-hidden="true" /> Replay
          </button>
        )}
      </div>
    </div>
  );
}
