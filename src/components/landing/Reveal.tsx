"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ElementType, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import styles from "./landing.module.css";

/**
 * Fades its children up once they scroll into view (once). The CSS keeps it
 * visible under prefers-reduced-motion, and it renders visible on the server
 * so nothing is hidden without JavaScript: the hidden state is applied only
 * after hydration, and only to elements still below the fold.
 */
export function Reveal({ children, delay = 0, as: Tag = "div", className }: { children: ReactNode; delay?: number; as?: ElementType; className?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"ssr" | "hidden" | "shown">("ssr");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      // Already on screen at hydration: leave it be rather than blink it out and back.
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
      setState("hidden");
    });
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState((s) => (s === "hidden" ? "shown" : s));
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <Tag ref={ref} className={cn(state !== "ssr" && styles.reveal, state === "shown" && styles.shown, className)} style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}>
      {children}
    </Tag>
  );
}

const noop = () => () => {};

/** True once hydrated. Showcases whose rows print "2h ago" render after mount so server and client agree. */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
