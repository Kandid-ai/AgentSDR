"use client";

import { cn } from "@/utils/cn";
import { useClock } from "./useClock";

export type RailStep = { title: string; when: string; body: string; tone?: "default" | "stop" };

/**
 * A vertical sequence: each step lights up in turn as the rail fills. Plain
 * data props only, so a server page can render it.
 */
export function SequenceRail({ steps, accent, label }: { steps: RailStep[]; accent: string; label: string }) {
  const { ref, p } = useClock(steps.length * 900);
  const lit = p * steps.length;
  return (
    <div ref={ref} className="rounded-[28px] bg-[#f4f5f7] p-4 sm:p-6" role="img" aria-label={label}>
      <ol className="relative rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_16px_40px_-20px_rgb(14_18_27/0.22)] sm:p-6">
        {steps.map((step, i) => {
          const on = lit > i + 0.2;
          const stop = step.tone === "stop";
          const last = i === steps.length - 1;
          return (
            <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
              {!last && <span className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-[#e4e6ea]" aria-hidden="true" />}
              {!last && <span className="absolute left-[11px] top-6 w-px origin-top" style={{ height: "calc(100% - 12px)", background: accent, transform: `scaleY(${Math.min(1, Math.max(0, lit - i - 0.2))})` }} aria-hidden="true" />}
              <span
                className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ background: on ? (stop ? "#141414" : accent) : "#d4d7dd", transition: "background 300ms", transform: on ? "scale(1)" : "scale(0.85)" }}
              >
                {stop ? "×" : i + 1}
              </span>
              <div className={cn("min-w-0 transition-all duration-500", on ? "translate-y-0 opacity-100" : "translate-y-1 opacity-35")}>
                <p className="text-[15px] font-medium leading-[24px] text-[#141414]">{step.title}</p>
                <p className="font-mono text-[11px] uppercase tracking-[0.06em]" style={{ color: accent }}>
                  {step.when}
                </p>
                <p className="mt-1 text-[14px] leading-[22px] text-[#656565]">{step.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
