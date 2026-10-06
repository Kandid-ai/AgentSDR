"use client";

import type { ComponentType, CSSProperties } from "react";
import { cn } from "@/utils/cn";
import s from "./landing.module.css";

/**
 * The hero's Reach / Triage / Measure switcher on desktop: columns between
 * hairline rules, each titled beside its bare icon, the head of the product frame. One rail runs under
 * all three and fills continuously — through the first column while it plays,
 * on through the second, and so on — so progress reads as one journey rather
 * than three separate bars. A chosen step fills the rail to its own end.
 */

export type StepItem = { key: string; title: string; body: string; icon: ComponentType<{ className?: string }> };

export function HeroSteps({
  steps,
  step,
  auto,
  stepMs,
  onChoose,
}: {
  steps: StepItem[];
  step: number;
  auto: boolean;
  stepMs: number;
  onChoose: (i: number) => void;
}) {
  const from = step / steps.length;
  const to = (step + 1) / steps.length;
  return (
    <div role="tablist" aria-label="What AgentSDR does" className={s.index}>
      {steps.map((item, i) => {
        const Icon = item.icon;
        const on = i === step;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`hero-tab-${item.key}`}
            aria-selected={on}
            aria-controls="hero-panel"
            onClick={() => onChoose(i)}
            className={cn(s.indexItem, on && s.on)}
          >
            <span className={s.indexHead}>
              <Icon className={s.indexIcon} aria-hidden="true" />
              <span className={s.indexTitle}>{item.title}</span>
            </span>
            <span className={s.indexBody}>{item.body}</span>
          </button>
        );
      })}
      <span aria-hidden="true" className={s.indexRail}>
        {/* Auto-advancing, each step remounts the fill to run its own stretch; once chosen, one fill eases between ends. */}
        <span
          key={auto ? `auto-${step}` : "chosen"}
          className={cn(s.indexFill, auto && s.indexFilling)}
          style={{ "--from": from, "--to": to, "--step-ms": `${stepMs}ms` } as CSSProperties}
        />
      </span>
    </div>
  );
}
