"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../../landing/motion/Stage";

/**
 * A 0 → 1 progress value that runs once over `durationMs` each time the
 * returned `ref` element scrolls into view, and again on `replay()`.
 * Reduced motion returns 1 (the final frame) straight away.
 */
export function useClock(durationMs: number, threshold = 0.3) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const [visits, setVisits] = useState(0);
  const [replays, setReplays] = useState(0);
  const [p, setP] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisits((v) => v + 1);
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  useEffect(() => {
    if (reduced || visits === 0) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setP(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visits, replays, reduced, durationMs]);

  const replay = useCallback(() => setReplays((r) => r + 1), []);
  return { ref, p: reduced ? 1 : p, reduced, replay, started: visits > 0 || reduced };
}
