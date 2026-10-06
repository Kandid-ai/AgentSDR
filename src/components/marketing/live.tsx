"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RiReplay5Line } from "@remixicon/react";
import type { AnalyticsView } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { AppWindow } from "../landing/AppWindow";
import { useReducedMotion } from "../landing/motion/Stage";
import { SCENES, SceneFit } from "../landing/scenes";
import { ActionsScreen, AnalyticsScreen, CallsScreen, CampaignsScreen, InboxScreen } from "../landing/screens";
import { Showcase } from "../landing/Showcase";
import styles from "./marketing.module.css";

/**
 * The client half of the page blocks: everything that animates on a clock or
 * holds state. Props are plain data (names, numbers), so server pages can
 * render these directly.
 */

/** Fires once each time the element scrolls into view (and again after it leaves). */
function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T | null>(null);
  const [visits, setVisits] = useState(0);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setVisits((v) => v + 1);
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView, visits };
}

export type SceneChannel = keyof typeof SCENES;

/**
 * One of the landing page's capability scenes (src/components/landing/scenes:
 * email, linkedin, whatsapp and crm, four each), on a soft stage tinted with
 * the channel's colour. It plays when scrolled into view, replays each time
 * it comes back, and has a replay button. Reduced motion shows the final frame.
 */
export function SceneStage({ channel, index, label, accent = "#335cff", className }: { channel: SceneChannel; index: number; label: string; accent?: string; className?: string }) {
  const { ref, visits } = useInView<HTMLDivElement>();
  const reduced = useReducedMotion();
  const [replays, setReplays] = useState(0);
  const Scene = SCENES[channel][index];
  return (
    <div ref={ref} className={cn(styles.stage, "group relative h-[340px] overflow-hidden rounded-[28px] sm:h-[440px]", className)} style={{ "--accent": accent } as CSSProperties}>
      {visits > 0 || reduced ? (
        <Showcase label={label} className="absolute inset-0">
          <SceneFit>
            <Scene key={`${visits}-${replays}`} reduced={reduced} />
          </SceneFit>
        </Showcase>
      ) : null}
      {!reduced && (
        <button
          type="button"
          data-showcase-allow
          onClick={() => setReplays((r) => r + 1)}
          aria-label={`Replay: ${label}`}
          className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/80 text-[#525866] opacity-0 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] backdrop-blur transition-opacity duration-200 hover:text-[#141414] focus-visible:opacity-100 group-hover:opacity-100"
        >
          <RiReplay5Line className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export type ScreenKey = "campaigns" | "actions" | "analytics" | "inbox" | "calls";

const SCREENS: Record<ScreenKey, { path: string; active: string; title: string }> = {
  campaigns: { path: "/outreach/campaigns", active: "/outreach/campaigns", title: "Campaigns" },
  actions: { path: "/crm/actions", active: "/crm/actions", title: "Action required" },
  analytics: { path: "/analytics", active: "/analytics", title: "Analytics" },
  inbox: { path: "/linkedin/messages", active: "/linkedin/messages", title: "Inbox" },
  calls: { path: "/calling/campaigns", active: "/calling/campaigns", title: "Calls" },
};

/**
 * A real AgentSDR screen on sample data, in the app window: the same
 * components the landing hero shows. `rail` collapses the sidebar to icons.
 */
export function ProductShot({ screen, rail = true, height = "h-[480px] sm:h-[580px]", dark = false, initialView = "overview" }: { screen: ScreenKey; rail?: boolean; height?: string; dark?: boolean; initialView?: AnalyticsView }) {
  const [view, setView] = useState<AnalyticsView>(initialView);
  const s = SCREENS[screen];
  return (
    <Showcase label={`AgentSDR ${s.title} screen with sample data`}>
      <AppWindow rail={rail} path={s.path} active={s.active} height={height} dark={dark}>
        <div className="h-full overflow-hidden">
          {screen === "campaigns" && <CampaignsScreen />}
          {screen === "actions" && <ActionsScreen />}
          {screen === "analytics" && <AnalyticsScreen view={view} onView={setView} />}
          {screen === "inbox" && <InboxScreen showDetails={false} />}
          {screen === "calls" && <CallsScreen />}
        </div>
      </AppWindow>
    </Showcase>
  );
}

/** Big numbers that count up the first time they scroll into view. */
export function StatBand({ items, className }: { items: ReadonlyArray<{ value: number; prefix?: string; suffix?: string; label: string }>; className?: string }) {
  const { ref, visits } = useInView<HTMLDListElement>(0.4);
  const reduced = useReducedMotion();
  const started = visits > 0;
  return (
    <dl ref={ref} className={cn("grid overflow-hidden rounded-3xl bg-black/[0.06] [gap:1px] ring-1 ring-black/[0.06] sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col-reverse bg-white px-6 py-7 sm:px-8">
          <dt className="mt-2 text-[14px] leading-[22px] text-[#656565]">{item.label}</dt>
          <dd className="font-[family-name:var(--font-brand-display)] text-[44px] font-medium leading-none tracking-[-0.04em] text-[#141414] tabular-nums">
            {item.prefix}
            <CountUp to={item.value} run={started} reduced={reduced} />
            {item.suffix}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CountUp({ to, run, reduced }: { to: number; run: boolean; reduced: boolean }) {
  const [value, setValue] = useState(to);
  useEffect(() => {
    if (!run || reduced) return;
    let frame = 0;
    const start = performance.now();
    const duration = 1400;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, reduced, to]);
  // Server and first paint show the real number, so it is never wrong without JavaScript.
  return <>{value.toLocaleString("en-US")}</>;
}
