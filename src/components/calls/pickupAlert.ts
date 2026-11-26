/**
 * The pure half of the pick-up alerts (PickupAlerts.tsx): when a pick-up
 * happened, what the tab title says, and which glow applies. No browser here,
 * so it is tested on its own.
 */
import { isRemoteRepOver, type RemoteRepStage } from "./remoteRepStage";

/** The flash, then the strong pulse, then the calm steady edge. */
export const PICKUP_FLASH_MS = 700;
export const PICKUP_PULSE_MS = 6_000;

/** A pick-up is the call arriving at on-call from anything else; staying on-call is not one. */
export function isPickupTransition(previous: RemoteRepStage | null, next: RemoteRepStage | null): boolean {
  return next === "on-call" && previous !== "on-call";
}

/** The tab title while a call rings or is on; null means leave the page's own title. */
export function callTabTitle(stage: RemoteRepStage | null, leadName: string): string | null {
  if (stage === "on-call") return `● Picked up — ${leadName}`;
  if (stage === "ringing") return `Ringing… ${leadName}`;
  return null;
}

export type GlowState = "none" | "flash" | "pulse" | "steady";

/**
 * The glow around the viewport. `sincePickupMs`: time since the pick-up was
 * seen here. Reduced motion skips the flash and the pulse.
 */
export function glowState(stage: RemoteRepStage | null, sincePickupMs: number, reducedMotion: boolean): GlowState {
  if (stage !== "on-call") return "none";
  if (reducedMotion) return "steady";
  if (sincePickupMs < PICKUP_FLASH_MS) return "flash";
  if (sincePickupMs < PICKUP_FLASH_MS + PICKUP_PULSE_MS) return "pulse";
  return "steady";
}

/** The system notification's text, or null when none should show (visible tab, or no permission). */
export function pickupNotification(
  call: { leadName: string; leadCompany: string | null },
  tabHidden: boolean,
  permission: NotificationPermission | "unsupported",
): { title: string; body: string } | null {
  if (!tabHidden || permission !== "granted") return null;
  return { title: `${call.leadName} picked up`, body: call.leadCompany ?? "Go back to AgentSDR and talk now." };
}

/** The bar's headline: whether it is green (picked up) and what it says. */
export function barTone(stage: RemoteRepStage): "live" | "over" | "normal" {
  if (stage === "on-call") return "live";
  return isRemoteRepOver(stage) ? "over" : "normal";
}

/** "Vivaan Joshi · Kesar Labs": the lead and, when known, their company. */
export function leadLine(leadName: string, leadCompany: string | null): string {
  return leadCompany?.trim() ? `${leadName} · ${leadCompany.trim()}` : leadName;
}
