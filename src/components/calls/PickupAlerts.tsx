"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { remoteRepCallSnapshot, subscribeRemoteRepCall } from "./remoteRepCall";
import {
  PICKUP_FLASH_MS,
  PICKUP_PULSE_MS,
  callTabTitle,
  glowState,
  isPickupTransition,
  pickupNotification,
  type GlowState,
} from "./pickupAlert";
import type { RemoteRepStage } from "./remoteRepStage";

const green = (percent: number) => `color-mix(in srgb, var(--color-success-base) ${percent}%, transparent)`;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(listener: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const reducedMotionNow = () => window.matchMedia(REDUCED_MOTION).matches;

/** Two short tones (A5 then E6), generated here: no asset. Blocked autoplay or no Web Audio: silent. */
function playChime() {
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    void context.resume().catch(() => {});
    const start = context.currentTime + 0.02;
    [[880, 0], [1318.5, 0.17]].forEach(([frequency, offset]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const at = start + offset;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.32);
    });
    window.setTimeout(() => void context.close().catch(() => {}), 900);
  } catch {
    // The chime is a nicety; never break the call for it.
  }
}

/**
 * Makes a pick-up impossible to miss, from any page: a green flash then a
 * glow around the viewport, a chime, the tab title, and (tab hidden, permission
 * already granted) a system notification. Mounted with the call bar. A pick-up
 * is the call's stage arriving at on-call from another stage (isPickupTransition);
 * the previous stage lives in a ref seeded at mount, so a re-render, a poll
 * that repeats on-call, or a remount mid-call never re-triggers it.
 */
export function PickupAlerts() {
  const call = useSyncExternalStore(subscribeRemoteRepCall, remoteRepCallSnapshot, () => null);
  const stage = call?.stage ?? null;
  const leadName = call?.leadName ?? "";
  const leadCompany = call?.leadCompany ?? null;
  const previous = useRef<RemoteRepStage | null>(stage);
  const glow = usePickupGlow(stage);

  // The chime and the notification: once per arrival at on-call.
  useEffect(() => {
    const before = previous.current;
    previous.current = stage;
    if (!isPickupTransition(before, stage)) return;
    playChime();
    let permission: NotificationPermission | "unsupported" = "unsupported";
    try {
      if (typeof Notification !== "undefined") permission = Notification.permission;
      const shown = pickupNotification({ leadName, leadCompany }, document.hidden, permission);
      if (shown) {
        const notification = new Notification(shown.title, { body: shown.body, tag: "agentsdr-pickup" });
        notification.onclick = () => { window.focus(); notification.close(); };
      }
    } catch {
      // Some browsers refuse `new Notification` (mobile): ignore.
    }
  }, [stage, leadName, leadCompany]);

  // The tab title, put back afterwards.
  const title = callTabTitle(stage, leadName);
  useEffect(() => {
    if (title === null) return;
    const original = document.title;
    document.title = title;
    return () => { document.title = original; };
  }, [title]);

  return <PickupGlow glow={glow} />;
}

/**
 * The glow for a call's stage: the flash, the pulse, then the steady edge,
 * timed from the pick-up seen by this hook (each user — the page, the
 * pop-out — times its own).
 */
export function usePickupGlow(stage: RemoteRepStage | null): GlowState {
  const previous = useRef<RemoteRepStage | null>(stage);
  const [pickupAt, setPickupAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);

  useEffect(() => {
    const before = previous.current;
    previous.current = stage;
    if (!isPickupTransition(before, stage)) return;
    const at = Date.now();
    setPickupAt(at);
    setNow(at);
  }, [stage]);

  // Move the glow on at the end of the flash and the pulse.
  useEffect(() => {
    if (stage !== "on-call" || pickupAt === null) return;
    const timers = [PICKUP_FLASH_MS, PICKUP_FLASH_MS + PICKUP_PULSE_MS].map((ms) => window.setTimeout(() => setNow(Date.now()), Math.max(0, pickupAt + ms - Date.now()) + 5));
    return () => timers.forEach(window.clearTimeout);
  }, [stage, pickupAt]);

  return glowState(stage, pickupAt === null ? Infinity : now - pickupAt, reduced);
}

/** The green layers over the viewport it renders in (the page, or the pop-out window). */
export function PickupGlow({ glow }: { glow: GlowState }) {
  if (glow === "none") return null;
  return (
    <>
      <style>{`
        @keyframes agentsdr-pickup-flash { from { opacity: 1 } to { opacity: 0 } }
        @keyframes agentsdr-pickup-pulse {
          0%, 100% { box-shadow: inset 0 0 40px 8px ${green(45)}, inset 0 0 0 4px ${green(70)} }
          50% { box-shadow: inset 0 0 120px 36px ${green(80)}, inset 0 0 0 6px ${green(100)} }
        }
      `}</style>
      {glow === "flash" && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[80]"
          style={{ background: green(35), animation: `agentsdr-pickup-flash ${PICKUP_FLASH_MS}ms ease-out forwards` }}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[80]"
        style={
          glow === "pulse" || glow === "flash"
            ? { animation: "agentsdr-pickup-pulse 1.2s ease-in-out infinite" }
            : { boxShadow: `inset 0 0 70px 14px ${green(40)}, inset 0 0 0 3px ${green(60)}` }
        }
      />
    </>
  );
}
