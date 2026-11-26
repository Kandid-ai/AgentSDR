"use client";

/**
 * What a running rep dialer publishes so the call bar (mounted once in the
 * root layout) can show it between calls, on any page. Module-level, like
 * remoteRepCall.ts. DialerTab owns it: publish while running, clear on
 * unmount or when stopped.
 */
export type DialerSession = {
  campaignId: string;
  campaignName: string;
  text: string;
  canPause: boolean;
  /** A stopped dialer's notice: the bar offers a close button. */
  dismissible: boolean;
  /** Pauses the dialer (only meaningful while canPause). */
  pause: () => void;
};

let current: DialerSession | null = null;
const listeners = new Set<() => void>();

export function subscribeDialerSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dialerSessionSnapshot(): DialerSession | null {
  return current;
}

export function publishDialerSession(next: DialerSession) {
  const same = current && current.campaignId === next.campaignId && current.campaignName === next.campaignName && current.text === next.text && current.canPause === next.canPause && current.dismissible === next.dismissible && current.pause === next.pause;
  if (same) return;
  current = next;
  for (const listener of listeners) listener();
}

export function clearDialerSession() {
  if (!current) return;
  current = null;
  for (const listener of listeners) listener();
}

export function dialerCampaignHref(campaignId: string): string {
  return `/calling/campaigns/ai/${campaignId}?tab=dialer`;
}
