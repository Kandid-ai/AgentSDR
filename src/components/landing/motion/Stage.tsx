"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { flag } from "./timeline";
import styles from "./vignettes.module.css";

/**
 * The loop clock behind a feature-card vignette.
 *
 * A vignette renders as a pure function of `t`, the milliseconds into a loop
 * of `cycle` ms whose build-up settles at `final` — the frame that matches the
 * static card exactly. That frame is what the server renders, what first
 * paint shows, and all that prefers-reduced-motion ever shows, so hydration
 * always agrees and nothing is hidden without JavaScript.
 *
 * After mount, a card still below the fold rewinds to 0 (unseen) and plays
 * from the start when it scrolls in; one already on screen carries on from
 * `final`. The clock runs only while the card is at least 30% in view and the
 * tab is visible, and resumes where it paused. Each loop ends with a soft fade
 * out, a reset under `data-instant` (transitions off, so nothing visibly
 * rewinds), and a fade back in.
 */

const FRAME_MS = 33; // ~30 renders a second is plenty: CSS transitions do the smoothing.
const FADE_IN_AT = 200; // hidden (and transitions off) for [0, FADE_IN_AT)
const FADE_OUT_MS = 600; // hidden for the last FADE_OUT_MS of the loop

export type Clock = {
  /** Milliseconds into the loop. */
  t: number;
  /** True once the clock has taken over from the static frame (mounted, motion allowed). */
  live: boolean;
};

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

export function Stage({ cycle, final, className, children }: { cycle: number; final: number; className?: string; children: (clock: Clock) => ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const [t, setT] = useState(final);
  const [live, setLive] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let elapsed = final;
    let last = 0;
    let raf = 0;
    let inView = false;
    let first = true;

    const tick = (now: number) => {
      // Cap the step so a dropped frame or a backgrounded tab never skips a beat.
      if (last) elapsed = (elapsed + Math.min(now - last, 64)) % cycle;
      last = now;
      setT(Math.floor(elapsed / FRAME_MS) * FRAME_MS);
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      const run = inView && document.visibilityState === "visible";
      setRunning(run);
      if (run && !raf) {
        last = 0;
        raf = requestAnimationFrame(tick);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (first) {
          first = false;
          // Below the fold: rewind while nobody is looking, so it plays from the top.
          if (!inView) {
            elapsed = 0;
            setT(0);
          }
          setLive(true);
        }
        sync();
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      cancelAnimationFrame(raf);
      raf = 0;
    };
  }, [cycle, final, reduced]);

  const motion = live && !reduced;
  const now = motion ? t : final;
  const hidden = motion && (now < FADE_IN_AT || now >= cycle - FADE_OUT_MS);
  return (
    <div
      ref={ref}
      className={cn(styles.stage, "flex w-full justify-center", className)}
      data-hidden={flag(hidden)}
      data-instant={flag(motion && now < FADE_IN_AT)}
      data-paused={flag(motion && !running)}
    >
      {children({ t: now, live: motion })}
    </div>
  );
}
