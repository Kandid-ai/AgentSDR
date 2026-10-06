"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/utils/cn";
import { Showcase } from "../../../landing/Showcase";
import { Stage, type Clock } from "../../../landing/motion/Stage";
import { monoFont } from "../../../landing/ui";
import styles from "../../marketing.module.css";

/**
 * Shared pieces for the data pages' visuals. Each visual is a pure function
 * of `t` (ms into a loop, from the landing page's Stage); `Show` fades and
 * lifts its children in once `t` passes `when`. At rest, and under reduced
 * motion, Stage renders the `final` frame, where everything is shown.
 */

export function DataStage({ label, accent = "#0b8a7a", cycle, final, className, children }: { label: string; accent?: string; cycle: number; final: number; className?: string; children: (clock: Clock) => ReactNode }) {
  return (
    <div className={cn(styles.stage, "relative overflow-hidden rounded-[28px] px-3 py-6 sm:px-8 sm:py-10", className)} style={{ "--accent": accent } as CSSProperties}>
      <Showcase label={label}>
        <Stage cycle={cycle} final={final}>
          {children}
        </Stage>
      </Showcase>
    </div>
  );
}

/** The white window every visual sits in. */
export function Panel({ title, right, className, children }: { title?: string; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn("w-full overflow-hidden rounded-2xl bg-white text-left shadow-[0_0_0_1px_rgb(20_20_20/0.06),0_2px_4px_rgb(14_18_27/0.04),0_24px_48px_-24px_rgb(14_18_27/0.22)]", className)}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-3">
          {title && <span className={cn(monoFont, "text-[11px] font-medium uppercase tracking-[0.04em] text-[#656565]")}>{title}</span>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Show({ when, children, className, y = 6, style }: { when: boolean; children: ReactNode; className?: string; y?: number; style?: CSSProperties }) {
  return (
    <div className={cn("transition-[opacity,transform] duration-500 ease-[cubic-bezier(.22,1,.36,1)]", className)} style={{ opacity: when ? 1 : 0, transform: when ? "none" : `translateY(${y}px)`, ...style }}>
      {children}
    </div>
  );
}

export type Tone = "neutral" | "blue" | "green" | "orange" | "red" | "purple";
const TONES: Record<Tone, string> = {
  neutral: "bg-black/[0.05] text-[#525866]",
  blue: "bg-[#335cff]/10 text-[#2547d0]",
  green: "bg-[#1fc16b]/12 text-[#178c4e]",
  orange: "bg-[#fa7319]/12 text-[#c2570c]",
  red: "bg-[#fb3748]/10 text-[#c4202f]",
  purple: "bg-[#7d52f4]/10 text-[#5b34d6]",
};

export function Chip({ tone = "neutral", mono = false, className, children }: { tone?: Tone; mono?: boolean; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4", mono && monoFont, TONES[tone], className)}>{children}</span>;
}

/** Linear 0..1 progress of `t` between `start` and `start + ms`. */
export function progress(t: number, start: number, ms: number) {
  return Math.min(1, Math.max(0, (t - start) / ms));
}
