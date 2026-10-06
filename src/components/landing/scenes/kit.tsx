"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import styles from "./scenes.module.css";

/**
 * The building blocks every capability scene shares.
 *
 * A scene is a small, self-contained animation drawn in a fixed
 * SCENE_W × SCENE_H box; the stage scales that box uniformly to fit (up on a
 * wide screen, down on a phone), so a scene lays itself out in plain pixels
 * and never has to be responsive. It plays once when it mounts — the stage
 * remounts it each time its capability comes up — and holds its final frame.
 * With reduced motion it renders that final frame straight away.
 */

export const SCENE_W = 440;
export const SCENE_H = 400;

export type SceneProps = { reduced: boolean };
export type Scene = ComponentType<SceneProps>;

/**
 * One dial for the pace of every scene: timelines, appear transitions, the
 * cursor and count-ups are all scaled by it, so a scene speeds up as a whole
 * and still reaches its final frame (Channels' CAPABILITY_MS is sized to it).
 */
export const SCENE_SPEED = 0.65;
const pace = (ms: number) => Math.round(ms * SCENE_SPEED);

/** The house easing for scene motion: a quick start that settles softly. */
export const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * How far a scene has got: 0 on mount, then 1, 2, … as each of `times` (ms
 * from mount, ascending) passes. Reduced motion jumps to the last step.
 * `times` must be a stable (module-level) array.
 */
export function useTimeline(times: readonly number[], reduced: boolean): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const ids = times.map((t, i) => window.setTimeout(() => setStep(i + 1), pace(t)));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [times, reduced]);
  return reduced ? times.length : step;
}

/** A white surface, the same as the app screens the stage shows. */
export function SceneCard({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl bg-bg-white-0 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_16px_40px_-16px_rgb(14_18_27/0.22)]", className)} style={style}>
      {children}
    </div>
  );
}

/**
 * Fades (and optionally lifts or scales) its children in when `show` turns
 * true. A transition, not a keyframe, so it also runs backwards if a scene
 * hides something again.
 */
export function Appear({
  show,
  from = "up",
  delay = 0,
  duration = 600,
  className,
  style,
  children,
}: {
  show: boolean;
  from?: "up" | "down" | "left" | "right" | "scale" | "none";
  delay?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const hidden: Record<typeof from, string> = {
    up: "translateY(10px)",
    down: "translateY(-10px)",
    left: "translateX(-14px)",
    right: "translateX(14px)",
    scale: "scale(0.94)",
    none: "none",
  };
  return (
    <div
      className={className}
      style={{
        ...style,
        opacity: show ? 1 : 0,
        transform: show ? "none" : hidden[from],
        transition: `opacity ${pace(duration)}ms ${EASE} ${pace(delay)}ms, transform ${pace(duration)}ms ${EASE} ${pace(delay)}ms`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A pointer that glides between points in the scene box, for the scenes
 * where something is clicked. `pressed` gives it a brief press.
 */
export function Cursor({ x, y, pressed = false, show = true, duration = 900 }: { x: number; y: number; pressed?: boolean; show?: boolean; duration?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-30"
      style={{
        transform: `translate(${x}px, ${y}px)`,
        opacity: show ? 1 : 0,
        transition: `transform ${pace(duration)}ms ${EASE}, opacity 300ms ${EASE}`,
      }}
    >
      <svg width="20" height="22" viewBox="0 0 20 22" style={{ transform: pressed ? "scale(0.86)" : "none", transformOrigin: "3px 3px", transition: "transform 140ms ease-out", filter: "drop-shadow(0 2px 3px rgb(14 18 27 / 0.25))" }}>
        <path d="M3 2.5v15.2l4.1-3.9 2.7 6.1 2.9-1.3-2.7-6h5.6L3 2.5Z" fill="#141414" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** A soft ring that pulses once where a click lands. Remount (key) it per click. */
export function ClickRipple({ x, y }: { x: number; y: number }) {
  return <span aria-hidden="true" className={cn(styles.ripple, "pointer-events-none absolute z-20 size-8 rounded-full")} style={{ left: x - 13, top: y - 13 }} />;
}

/** Counts from `from` to `to` over `duration` ms once `run` is true (reduced: shows `to`). */
export function useCountUp(from: number, to: number, run: boolean, duration: number, reduced: boolean): number {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (reduced || !run) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / pace(duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, run, duration, reduced]);
  return reduced ? to : value;
}

/**
 * Scales a SCENE_W × SCENE_H scene to fit its container, centred, never more
 * than `max` (text would only get bigger, not clearer). Hidden until the
 * first measurement so a phone never sees it at desktop size first.
 */
export function SceneFit({ children, max = 1.25, padding = 32 }: { children: ReactNode; max?: number; padding?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(max, (width - padding) / SCENE_W, (height - padding) / SCENE_H));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [max, padding]);
  return (
    <div ref={ref} className="absolute inset-0">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: SCENE_W,
          height: SCENE_H,
          transform: `translate(-50%, -50%) scale(${scale ?? 1})`,
          visibility: scale === null ? "hidden" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
