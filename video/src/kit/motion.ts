import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./time";

/**
 * Frame maths. Every animation in the video is a pure function of the frame,
 * so a render is exact and repeatable — no CSS transitions or timers, which
 * run on the wall clock and would drift from the frames Remotion captures.
 */

/** The landing page's motion curve: a quick start that settles softly. */
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
/** For camera moves and hand-offs, which should ease both ways. */
export const GLIDE = Easing.bezier(0.65, 0, 0.35, 1);

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 over [start, start + duration], eased; clamped outside. */
export function tw(frame: number, start: number, duration: number, easing: (t: number) => number = EASE): number {
  if (!Number.isFinite(start)) return start > 0 ? 0 : 1;
  return interpolate(frame, [start, start + duration], [0, 1], { ...CLAMP, easing });
}

/** `from` → `to` over [start, start + duration]. */
export function between(frame: number, start: number, duration: number, from: number, to: number, easing: (t: number) => number = EASE): number {
  return from + (to - from) * tw(frame, start, duration, easing);
}

/** A springy 0 → 1 from `start` — for things that pop (chips, toasts, badges). */
export function pop(frame: number, start: number, stiffness = 170, damping = 15): number {
  return spring({ frame: frame - start, fps: FPS, config: { stiffness, damping, mass: 0.8 } });
}

/**
 * A value moving through keyframes `[frame, value]`, eased between each pair.
 * Before the first it holds the first value, after the last the last.
 */
export function keys(frame: number, frames: ReadonlyArray<readonly [number, number]>, easing: (t: number) => number = GLIDE): number {
  if (frame <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [f1, v1] = frames[i];
    const [f0, v0] = frames[i - 1];
    if (frame <= f1) return v0 + (v1 - v0) * easing((frame - f0) / Math.max(1, f1 - f0));
  }
  return frames[frames.length - 1][1];
}

/** The first `n` characters of `text` typed from `start` at `cps` characters a second. */
export function typed(text: string, frame: number, start: number, cps = 38): string {
  const n = Math.max(0, Math.floor(((frame - start) / FPS) * cps));
  return text.slice(0, n);
}

/** A number counting up from 0 to `to`. */
export function count(frame: number, start: number, duration: number, to: number, from = 0): number {
  return Math.round(from + (to - from) * tw(frame, start, duration));
}

export const fmt = (n: number) => n.toLocaleString("en-US");

/** Seconds → frames. */
export const s = (seconds: number) => Math.round(seconds * FPS);
