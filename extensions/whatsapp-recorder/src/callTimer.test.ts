import { describe, expect, test } from "bun:test";
import { freshTimerWatch, showsMuteNotice, TIMER_FROZEN_CHECKS, TIMER_MISSING_CHECKS, watchTimer, type TimerVerdict } from "./callTimer";

function run(start: string, readings: Array<[string | null, boolean]>): TimerVerdict[] {
  let watch = freshTimerWatch(start);
  return readings.map(([text, muted]) => {
    const verdict = watchTimer(watch, text, muted);
    watch = verdict.watch;
    return verdict;
  });
}

describe("watchTimer", () => {
  test("a ticking timer keeps the call going", () => {
    expect(run("0:10", [["0:11", false], ["0:11", false], ["0:12", false]]).every((v) => v.ended === null)).toBe(true);
  });

  test("a timer that stays on screen without ticking ends the call", () => {
    const verdicts = run("0:16", Array.from({ length: TIMER_FROZEN_CHECKS }, () => ["0:16", false] as [string, boolean]));
    expect(verdicts.at(-1)!.ended).toBe("frozen");
  });

  test("the lead muting (timer replaced by a mute notice) never ends the call, however long", () => {
    const verdicts = run("0:16", Array.from({ length: TIMER_MISSING_CHECKS * 3 }, () => [null, true] as [null, boolean]));
    expect(verdicts.every((v) => v.ended === null && v.muted)).toBe(true);
  });

  test("the timer coming back after a mute carries on", () => {
    const verdicts = run("0:16", [[null, true], [null, true], ["0:20", false], ["0:21", false]]);
    expect(verdicts.map((v) => v.ended)).toEqual([null, null, null, null]);
  });

  test("a timer gone with no mute notice ends the call, but only after a long wait", () => {
    const verdicts = run("0:16", Array.from({ length: TIMER_MISSING_CHECKS }, () => [null, false] as [null, boolean]));
    expect(verdicts.slice(0, -1).every((v) => v.ended === null)).toBe(true);
    expect(verdicts.at(-1)!.ended).toBe("missing");
    expect(TIMER_MISSING_CHECKS).toBeGreaterThan(TIMER_FROZEN_CHECKS * 5);
  });
});

describe("showsMuteNotice", () => {
  test("reads WhatsApp's mute notices", () => {
    expect(showsMuteNotice(["Arjun Bhatia", "Muted"])).toBe(true);
    expect(showsMuteNotice(["Arjun muted their microphone"])).toBe(true);
    expect(showsMuteNotice(["Microphone off"])).toBe(true);
  });

  test("not the Mute button or ordinary call text", () => {
    expect(showsMuteNotice(["Mute", "Unmute", "End call", "0:16", "End-to-end encrypted"])).toBe(false);
  });
});
