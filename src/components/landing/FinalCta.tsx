"use client";

import { useState } from "react";
import { RiGithubFill, RiRocketLine } from "@remixicon/react";
import type { AnalyticsView } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { AppWindow } from "./AppWindow";
import styles from "./landing.module.css";
import { Reveal } from "./Reveal";
import { AnalyticsScreen } from "./screens";
import { Showcase } from "./Showcase";
import { AppIcon, Cta, displayFont, Eyebrow, LINKS } from "./ui";

/**
 * The closing call to action: the hero's sky folded into a rounded card,
 * left-aligned copy, both CTAs, and the product once more — this time in the
 * app's own dark mode.
 */
export function FinalCta() {
  const [view, setView] = useState<AnalyticsView>("overview");
  return (
    <section aria-labelledby="cta-title" className="bg-white px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-12">
      <Reveal>
        <div className={cn(styles.ctaSky, "relative mx-auto max-w-[1080px] overflow-hidden rounded-[28px] pt-14 sm:rounded-[32px] sm:pt-20")}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[12%] w-px bg-white/[0.07]" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-[12%] w-px bg-white/[0.07]" />
          <div className="relative px-6 sm:px-[17%]">
            <Eyebrow tone="dark" icon={RiRocketLine} className="mx-0">
              Get started
            </Eyebrow>
            <h2 id="cta-title" className={cn(displayFont, "mt-5 text-[38px] leading-[1.12] tracking-[-0.03em] sm:text-[48px] sm:leading-[60px]")}>
              <span className={styles.skyText}>Own your outbound</span>
              <br />
              <span className={styles.skyText}>from</span> <AppIcon className="mx-0.5 -mt-1.5 size-[38px] align-middle sm:size-[46px]" walk="waddle" />{" "}
              <span className={styles.skyText}>day one</span>
            </h2>
            <p className="mt-5 max-w-[34rem] text-[16px] leading-[1.6] text-white/75">
              Clone the repo, point it at Postgres, connect the channels you sell on. Your leads, your conversations and your model key never leave your infrastructure.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href={LINKS.github} external variant="primary" icon={RiGithubFill} size="lg">
                Star on GitHub
              </Cta>
              <Cta href={LINKS.selfHost} external variant="glass" size="lg">
                Self-host it
              </Cta>
            </div>
          </div>

          <div className="relative mt-14 px-3 sm:mt-16 sm:px-10">
            <p aria-hidden="true" className="absolute -top-10 right-6 hidden rotate-[4deg] font-[family-name:var(--font-landing-hand)] text-[24px] text-white/85 sm:block">
              dark mode, too ↓
            </p>
            <Showcase label="AgentSDR Analytics in dark mode, with sample data">
              <AppWindow dark path="/analytics" active="/analytics" sidebar={false} height="h-[420px] sm:h-[460px]" className="rounded-b-none sm:rounded-b-none">
                <div className="h-full overflow-hidden">
                  <AnalyticsScreen view={view} onView={setView} />
                </div>
              </AppWindow>
            </Showcase>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
