"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { RiBarChartBoxLine, RiGithubFill, RiSendPlaneLine, RiServerLine, RiSparkling2Line } from "@remixicon/react";
import type { AnalyticsView } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { AppWindow } from "./AppWindow";
import { Converge, ConvergeTarget } from "./Converge";
import { HeroSteps } from "./HeroSteps";
import styles from "./landing.module.css";
import { ActionsScreen, AnalyticsScreen, CampaignsScreen } from "./screens";
import { Showcase } from "./Showcase";
import { AppIcon, Cta, displayFont, Eyebrow, LINKS } from "./ui";

/**
 * The hero: promise, calls to action, and the product doing the three things
 * it is for — reach, triage, measure — as tabs that cycle on their own (the
 * reference's "Upload / Bulletproof / Distribute" row), each showing the real
 * screen for that step in a window below.
 */

type Step = { key: string; title: string; body: string; icon: ComponentType<{ className?: string }>; path: string; active: string };

const STEPS: Step[] = [
  { key: "reach", title: "Reach", body: "Sequences on email, LinkedIn and WhatsApp, inside each channel's limits.", icon: RiSendPlaneLine, path: "/outreach/campaigns", active: "/outreach/campaigns" },
  { key: "triage", title: "Triage", body: "Every reply classified by AI, with the answer already drafted.", icon: RiSparkling2Line, path: "/crm/actions", active: "/crm/actions" },
  { key: "measure", title: "Measure", body: "Replies, meetings and customers, by channel, in one view.", icon: RiBarChartBoxLine, path: "/analytics", active: "/analytics" },
];

const STEP_MS = 4000;

export function Hero() {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const [view, setView] = useState<AnalyticsView>("overview");
  const targetRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!auto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => window.clearTimeout(id);
  }, [auto, step]);

  const current = STEPS[step];

  const choose = (i: number) => {
    setStep(i);
    setAuto(false);
  };

  return (
    <section aria-labelledby="hero-title" className="relative isolate pb-8 sm:pb-12">
      <div aria-hidden="true" className={cn(styles.heroGlow, "pointer-events-none absolute inset-0 -z-10")} />
      {/* The rails at either edge, and the tools travelling from them into the headline's icon. */}
      <Converge target={targetRef} />

      <div className={cn(styles.heroCopy, "relative z-[1] mx-auto max-w-[1128px] px-4 pb-12 pt-32 text-center sm:px-6 sm:pt-40 lg:pt-44")}>
        <Eyebrow tone="dark" icon={RiServerLine}>
          Open source · self-hosted
        </Eyebrow>
        <h1 id="hero-title" className={cn(displayFont, "mx-auto mt-6 max-w-[15ch] text-balance text-[44px] leading-[1.1] tracking-[-0.03em] sm:max-w-none sm:text-[60px] lg:text-[74px] lg:leading-[84px] lg:tracking-[-0.015em]")}>
          <span className={styles.skyText}>Reach, reply and close</span>
          <br className="hidden sm:block" />{" "}
          <span className={styles.skyText}>from single</span>{" "}
          {/* The tools it replaces fly into this icon (see Converge). */}
          <ConvergeTarget ref={targetRef} className="mx-1 -mt-2 size-[46px] align-middle sm:size-[58px] lg:size-[68px]">
            <AppIcon className="size-full" walk="bounce" />
          </ConvergeTarget>{" "}
          <span className={styles.skyText}>workspace</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[40rem] text-pretty text-[16px] leading-[1.6] text-white/75 sm:text-[17px]">
          AgentSDR runs your email sequences, LinkedIn campaigns and WhatsApp calls, and an AI CRM that reads every reply and drafts the answer. On your server, with your own model key.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Cta href={LINKS.github} external variant="primary" icon={RiGithubFill}>
            Star on GitHub
          </Cta>
          <Cta href={LINKS.selfHost} external variant="glass">
            Self-host it
          </Cta>
        </div>

        {/* Phone: the three steps as icon pills under the calls to action. */}
        <div role="tablist" aria-label="What AgentSDR does" className="mx-auto mt-14 grid max-w-[968px] grid-cols-3 gap-1.5 rounded-[26px] p-1 ring-1 ring-inset ring-white/10 sm:hidden">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const on = i === step;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="hero-panel"
                onClick={() => choose(i)}
                className={cn("group relative flex flex-col items-center rounded-[22px] px-2 py-2.5 text-center outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white/50", on ? "bg-white/[0.08]" : "hover:bg-white/[0.04]")}
              >
                <span
                  className={cn(
                    "relative flex size-11 items-center justify-center overflow-hidden rounded-xl ring-1 ring-inset transition-[background,color,box-shadow] duration-300 ease-[cubic-bezier(.6,.6,0,1)]",
                    on
                      ? "bg-[#335cff] text-white ring-white/25 shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_8px_24px_-6px_rgb(51_92_255/0.9)]"
                      : "bg-white/[0.06] text-white/70 ring-white/12 group-hover:bg-white/[0.1] group-hover:text-white",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {on && auto && <span key={step} aria-hidden="true" className={cn(styles.progress, "absolute inset-x-0 bottom-0 h-[2px] bg-white/80")} style={{ "--step-ms": `${STEP_MS}ms` } as React.CSSProperties} />}
                </span>
                <span className="sr-only">{s.title}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 sm:hidden" aria-hidden="true">
          <p className="text-[15px] font-medium text-white">{current.title}</p>
          <p className="mx-auto mt-1 max-w-[18rem] text-[14px] leading-[1.55] text-white/65">{current.body}</p>
        </div>
      </div>

      {/* The product. From 640px up the three steps are the glass frame's header, the window below them in the same frame. */}
      <div className="mx-auto max-w-[1300px] px-2 sm:px-6">
        <div className={cn(styles.skyFrame, "rounded-[26px] p-1.5 sm:rounded-[34px] sm:p-2.5")}>
          {/* From 640px up the steps head the frame; phones use the pills above. */}
          <div className="hidden sm:block">
            <HeroSteps steps={STEPS} step={step} auto={auto} stepMs={STEP_MS} onChoose={choose} />
          </div>
          <div className={cn(styles.wallpaper, "overflow-hidden rounded-[20px] p-2 pt-8 sm:rounded-[26px] sm:p-8")}>
            <div id="hero-panel" role="tabpanel" aria-labelledby={`hero-tab-${current.key}`}>
              <Showcase label={`AgentSDR ${current.title} screen with sample data`}>
                <AppWindow rail path={current.path} active={current.active} height="h-[540px] sm:h-[600px]">
                  <div key={current.key} className={cn("h-full overflow-hidden", styles.screenIn)}>
                    {current.key === "reach" && <CampaignsScreen />}
                    {current.key === "triage" && <ActionsScreen />}
                    {current.key === "measure" && <AnalyticsScreen view={view} onView={setView} />}
                  </div>
                </AppWindow>
              </Showcase>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
