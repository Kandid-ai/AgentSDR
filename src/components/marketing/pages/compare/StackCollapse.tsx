"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RiCheckLine } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { useReducedMotion } from "../../../landing/motion/Stage";

/**
 * The hub's hero visual: the separate tools of a typical outbound stack
 * slide into one AgentSDR card, which ticks off what each of them did.
 * Plain data in, no tool names or logos. Plays once when scrolled into view;
 * reduced motion shows the final state.
 */

type Tool = { label: string; note: string };

export function StackCollapse({ tools, result, resultNote }: { tools: ReadonlyArray<Tool>; result: string; resultNote: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const [merged, setMerged] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => setMerged(true), 900);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const done = merged || reduced;
  const ease = "cubic-bezier(.22,1,.36,1)";

  return (
    <div ref={ref} className="grid items-center gap-6 rounded-[20px] bg-white/90 p-5 shadow-[0_24px_60px_-30px_rgb(10_20_60/0.45)] ring-1 ring-black/[0.06] sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
      <ul className="grid gap-2.5" aria-label="A typical outbound stack">
        {tools.map((t, i) => (
          <li
            key={t.label}
            className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f7f8] px-4 py-3 ring-1 ring-black/[0.05]"
            style={
              {
                opacity: done ? 0.6 : 1,
                transform: done ? "translateX(18px) scale(0.97)" : "none",
                transition: reduced ? "none" : `opacity 700ms ${ease} ${i * 90}ms, transform 800ms ${ease} ${i * 90}ms`,
              } as CSSProperties
            }
          >
            <span className="text-[14px] font-medium text-[#141414]">{t.label}</span>
            <span className="text-right text-[12px] text-[#525866]">{t.note}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-2xl bg-[#0b1020] p-5 text-white sm:p-6">
        <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-white/55">One app</p>
        <p className="mt-2 font-[family-name:var(--font-brand-display)] text-[28px] leading-[1.1] tracking-[-0.03em]">{result}</p>
        <p className="mt-2 text-[13px] leading-5 text-white/65">{resultNote}</p>
        <ul className="mt-5 grid gap-2">
          {tools.map((t, i) => (
            <li
              key={t.label}
              className="flex items-center gap-2.5 text-[13px] text-white/85"
              style={
                {
                  opacity: done ? 1 : 0.25,
                  transition: reduced ? "none" : `opacity 500ms ease ${400 + i * 140}ms`,
                } as CSSProperties
              }
            >
              <span aria-hidden="true" className={cn("flex size-4 shrink-0 items-center justify-center rounded-full", done ? "bg-[#1fc16b] text-white" : "bg-white/15 text-transparent")} style={{ transition: reduced ? "none" : `background-color 400ms ease ${400 + i * 140}ms` }}>
                <RiCheckLine className="size-3" />
              </span>
              {t.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
