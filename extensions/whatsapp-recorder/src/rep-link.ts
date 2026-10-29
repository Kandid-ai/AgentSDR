/**
 * A rep call's link between the rep's AgentSDR tab and a calling station's
 * WhatsApp Web (contract.ts, RecorderRemoteRep): the pieces that are not
 * audio plumbing, kept apart from wa-hook so they can be tested.
 */

import { MAX_RTC_SDP_CHARS, type RecorderRemoteRep, type RepLinkControl } from "../../../src/lib/calls/contract";

/** The rep call a station request asks for; null when it asks for none, "invalid" for an unusable offer. */
export function requestRemoteRep(value: unknown): RecorderRemoteRep | null | "invalid" {
  if (value === null || value === undefined) return null;
  const offer = (value as { offer?: unknown }).offer;
  if (typeof offer !== "string" || !offer.trim() || offer.length > MAX_RTC_SDP_CHARS) return "invalid";
  return { offer };
}

/** A message on the link's data channel, if it is one we know. */
export function parseRepLinkControl(data: unknown): RepLinkControl | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data) as { type?: unknown } | null;
    return parsed?.type === "hangup" ? { type: "hangup" } : null;
  } catch {
    return null;
  }
}

/** The part of RTCPeerConnection that waitForIceGathering needs. */
type Gathering = Pick<RTCPeerConnection, "iceGatheringState" | "addEventListener" | "removeEventListener">;

/**
 * Resolves once ICE gathering completes, or after `timeoutMs` with what was
 * gathered by then — no trickle: the description is sent once, whole.
 */
export function waitForIceGathering(pc: Gathering, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const timer = setTimeout(done, timeoutMs);
    function onChange() {
      if (pc.iceGatheringState === "complete") done();
    }
    function done() {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}
