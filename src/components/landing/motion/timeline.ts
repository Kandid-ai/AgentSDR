/**
 * Pure helpers for the feature-card vignettes' timelines. A vignette is a
 * function of `t`, the milliseconds into its loop; these turn `t` into the
 * values and flags it renders.
 */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Cubic ease-out: quick start, soft landing — the page's motion curve, in JS. */
export const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;

/** `from` → `to` between `start` and `start + duration`, eased; clamped outside it. */
export function tween(t: number, start: number, duration: number, from: number, to: number): number {
  return from + (to - from) * easeOut((t - start) / duration);
}

/** How many of `times` have passed. */
export function count(t: number, times: readonly number[]): number {
  let n = 0;
  for (const at of times) if (t >= at) n++;
  return n;
}

/** True while `t` is inside [at, at + duration). */
export function within(t: number, at: number, duration: number): boolean {
  return t >= at && t < at + duration;
}

/**
 * A boolean as a data attribute: present when true, absent when false, so CSS
 * can key transitions off `[data-on]`.
 */
export function flag(on: boolean): "" | undefined {
  return on ? "" : undefined;
}

/** `[data-on]` once `t` reaches `at`. */
export function at(t: number, ms: number): "" | undefined {
  return flag(t >= ms);
}
