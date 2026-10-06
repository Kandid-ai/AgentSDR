"use client";

import { RiReplay5Line } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { useClock } from "./useClock";

/**
 * Seven send attempts meeting the four WhatsApp guards. Names and numbers
 * are fictional; the outcomes follow docs/whatsapp (warm-up 24 h, 25 new
 * chats a rolling day, 10 s between sends, Do Not Contact), and a held new
 * chat does not stop follow-ups from the same number.
 */

type Outcome = "sent" | "waits" | "held" | "stopped";
type Attempt = { number: string; kind: string; lead: string; outcome: Outcome; note: string };

const ATTEMPTS: Attempt[] = [
  { number: "Number A", kind: "Follow-up", lead: "Marta Keller", outcome: "sent", note: "Sent" },
  { number: "Number A", kind: "New chat", lead: "Joel Brandt", outcome: "waits", note: "Waits: 10 s gap, tries next round" },
  { number: "Number B", kind: "New chat", lead: "Tomas Weiss", outcome: "held", note: "Held: linked 2 h ago, warm-up ends in 22 h" },
  { number: "Number A", kind: "New chat", lead: "Priya Nair", outcome: "sent", note: "Sent: new chat 25 of 25" },
  { number: "Number A", kind: "New chat", lead: "Lena Ortiz", outcome: "held", note: "Held: 25 new chats in 24 h" },
  { number: "Number A", kind: "Follow-up", lead: "Sam Okoye", outcome: "sent", note: "Sent: follow-ups still go out" },
  { number: "Number A", kind: "New chat", lead: "Ravi Shah", outcome: "stopped", note: "Stopped: Do Not Contact" },
];

const TONE: Record<Outcome, { dot: string; text: string; bg: string }> = {
  sent: { dot: "#1fc16b", text: "#0e7a43", bg: "#e8f8ef" },
  waits: { dot: "#8a8f98", text: "#525866", bg: "#eef0f3" },
  held: { dot: "#fa7319", text: "#a35200", bg: "#fff4e5" },
  stopped: { dot: "#141414", text: "#141414", bg: "#e9eaec" },
};

export function SendGuard({ accent = "#1fc16b" }: { accent?: string }) {
  const { ref, p, reduced, replay } = useClock(8000);
  const shown = Math.min(ATTEMPTS.length, Math.floor(p * (ATTEMPTS.length + 0.6)));
  const base = shown >= 4 ? 25 : 24;
  return (
    <div ref={ref} className="rounded-[28px] bg-[#f4f5f7] p-4 sm:p-6" role="img" aria-label="Send attempts passing through the WhatsApp guards: some are sent, some wait, some are held and one is stopped. An illustration with sample data.">
      <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_16px_40px_-20px_rgb(14_18_27/0.22)] sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#8a8f98]">Number A, new chats in 24 h</p>
            <p className="mt-1 font-[family-name:var(--font-brand-display)] text-[36px] font-medium leading-none tracking-[-0.04em] text-[#141414] tabular-nums">
              {base}
              <span className="text-[#a1a1a1]"> / 25</span>
            </p>
          </div>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-[#eceef1] sm:w-48">
            <div className="h-full rounded-full" style={{ width: `${(base / 25) * 100}%`, background: base >= 25 ? "#fa7319" : accent, transition: "width 400ms, background 400ms" }} />
          </div>
        </div>
        <ul className="mt-5 divide-y divide-[#eceef1]">
          {ATTEMPTS.map((a, i) => {
            const on = i < shown;
            const tone = TONE[a.outcome];
            return (
              <li key={a.lead} className={cn("flex items-start gap-3 py-3 transition-all duration-500", on ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0")}>
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: tone.dot }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-[22px] text-[#141414]">
                    {a.lead} <span className="font-normal text-[#8a8f98]">· {a.kind} · {a.number}</span>
                  </p>
                  <p className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[12px] leading-[18px]" style={{ background: tone.bg, color: tone.text }}>
                    {a.note}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-3 flex items-center justify-between px-1 text-[12px] text-[#8a8f98]">
        <span>Sample attempts, fictional leads. Illustration.</span>
        {!reduced && (
          <button type="button" onClick={replay} aria-label="Replay the send attempts" className="flex items-center gap-1 rounded-full px-2 py-1 hover:text-[#141414]">
            <RiReplay5Line className="size-4" aria-hidden="true" /> Replay
          </button>
        )}
      </div>
    </div>
  );
}
