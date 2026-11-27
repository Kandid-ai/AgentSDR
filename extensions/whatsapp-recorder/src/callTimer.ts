/**
 * How a running call's timer tells wa-hook the call is over, kept pure so it
 * is tested on its own.
 *
 * A timer that stays on screen but stops ticking is a call that ended. A
 * timer that is simply gone is not the same thing: when the lead mutes,
 * WhatsApp shows a mute notice where the timer was, and reading that as a
 * hang-up cut live calls at 0:16 and 0:31 (27 Nov 2026). So a missing timer
 * never ends the call while a mute notice shows, and otherwise only after
 * much longer than a frozen one. A real hang-up normally closes the call
 * screen, which ends the call on its own (END_BUTTON_GONE_CHECKS in wa-hook).
 */

/** Checks a visible timer must stay unchanged before the call counts as ended. */
export const TIMER_FROZEN_CHECKS = 4;
/** Checks the timer must be missing, with no mute notice, before the call counts as ended (~15 s at 0.5 s). */
export const TIMER_MISSING_CHECKS = 30;

/** WhatsApp's notice that someone on the call is muted ("Muted", "Asha muted", "Microphone off"). */
const MUTE_NOTICE = /\bmuted\b|\bon mute\b|\bmic(rophone)?( is)? off\b/i;

export function showsMuteNotice(texts: readonly string[]): boolean {
  return texts.some((text) => MUTE_NOTICE.test(text));
}

export type TimerWatch = { lastText: string | null; frozen: number; missing: number };

export const freshTimerWatch = (lastText: string | null): TimerWatch => ({ lastText, frozen: 0, missing: 0 });

export type TimerVerdict = {
  watch: TimerWatch;
  /** Why the call is over, or null while it runs. */
  ended: "frozen" | "missing" | null;
  /** The timer is missing but a mute notice explains it. */
  muted: boolean;
};

export function watchTimer(watch: TimerWatch, timerText: string | null, muteShown: boolean): TimerVerdict {
  if (timerText !== null && timerText !== watch.lastText) {
    return { watch: freshTimerWatch(timerText), ended: null, muted: false };
  }
  if (timerText !== null) {
    const next = { ...watch, frozen: watch.frozen + 1, missing: 0 };
    return { watch: next, ended: next.frozen >= TIMER_FROZEN_CHECKS ? "frozen" : null, muted: false };
  }
  if (muteShown) return { watch: { ...watch, frozen: 0, missing: 0 }, ended: null, muted: true };
  const next = { ...watch, frozen: 0, missing: watch.missing + 1 };
  return { watch: next, ended: next.missing >= TIMER_MISSING_CHECKS ? "missing" : null, muted: false };
}
