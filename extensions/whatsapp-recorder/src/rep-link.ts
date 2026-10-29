/**
 * A rep call's link between the rep's AgentSDR tab and a calling station's
 * WhatsApp Web (contract.ts, RecorderRemoteRep): the pieces that are not
 * audio plumbing, kept apart from wa-hook so they can be tested.
 */

import {
  MAX_REP_LINK_ICE_SERVERS,
  MAX_RTC_SDP_CHARS,
  type RecorderRemoteRep,
  type RepLinkControl,
  type RepLinkIceServer,
} from "../../../src/lib/calls/contract";

/** Longest ICE server URL, username or credential accepted. */
const MAX_ICE_FIELD_CHARS = 1_000;

/**
 * The rep call a station request asks for; null when it asks for none,
 * "invalid" for an unusable offer or ICE server list (the call needs its
 * relay: contract.ts, RecorderRemoteRep).
 */
export function requestRemoteRep(value: unknown): RecorderRemoteRep | null | "invalid" {
  if (value === null || value === undefined) return null;
  const { offer, iceServers } = value as { offer?: unknown; iceServers?: unknown };
  if (typeof offer !== "string" || !offer.trim() || offer.length > MAX_RTC_SDP_CHARS) return "invalid";
  const servers = requestIceServers(iceServers);
  if (!servers) return "invalid";
  return { offer, iceServers: servers };
}

/** A list of 1–MAX_REP_LINK_ICE_SERVERS ICE servers with stun:/turn:/turns: URLs, or null. */
export function requestIceServers(value: unknown): RepLinkIceServer[] | null {
  if (!Array.isArray(value) || !value.length || value.length > MAX_REP_LINK_ICE_SERVERS) return null;
  const servers: RepLinkIceServer[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const { urls, username, credential } = entry as { urls?: unknown; username?: unknown; credential?: unknown };
    const list = Array.isArray(urls) ? urls : [urls];
    if (!list.length || list.length > MAX_REP_LINK_ICE_SERVERS || !list.every(isIceUrl)) return null;
    if (username !== undefined && !isIceField(username)) return null;
    if (credential !== undefined && !isIceField(credential)) return null;
    servers.push({
      urls: Array.isArray(urls) ? (list as string[]) : (urls as string),
      ...(username !== undefined ? { username: username as string } : {}),
      ...(credential !== undefined ? { credential: credential as string } : {}),
    });
  }
  return servers;
}

function isIceUrl(url: unknown): url is string {
  return typeof url === "string" && url.length <= MAX_ICE_FIELD_CHARS && /^(stun|turns?):\S+$/i.test(url);
}

function isIceField(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_ICE_FIELD_CHARS;
}

/**
 * The kinds of ICE candidates in an SDP, for the logs — never addresses:
 * e.g. "host/udp×1 srflx/udp×1 relay/udp×2", or "none". (A relay
 * candidate is always UDP here; how it reaches the TURN server is not in the
 * SDP — see summarizeLocalCandidates.)
 */
export function summarizeSdpCandidates(sdp: string): string {
  const kinds: string[] = [];
  for (const line of sdp.split(/\r?\n/)) {
    // a=candidate:<foundation> <component> <transport> <priority> <address> <port> typ <type> …
    const match = /^a=candidate:\S+ \d+ (\S+) \d+ \S+ \d+ typ (\S+)/i.exec(line.trim());
    if (match) kinds.push(`${match[2]}/${match[1]}`);
  }
  return countKinds(kinds);
}

/** The part of an RTCStatsReport local-candidate entry the summary reads. */
type LocalCandidateStats = { type?: string; candidateType?: string; protocol?: string; relayProtocol?: string };

/**
 * The local candidates gathered (from getStats), never addresses: a relay
 * candidate is labelled with how this browser reaches the TURN server —
 * "relay/tls×1" is the one that works through a station's proxy.
 */
export function summarizeLocalCandidates(stats: Iterable<LocalCandidateStats>): string {
  const kinds: string[] = [];
  for (const entry of stats) {
    if (entry.type !== "local-candidate" || !entry.candidateType) continue;
    const transport = entry.candidateType === "relay" && entry.relayProtocol ? entry.relayProtocol : entry.protocol;
    kinds.push(`${entry.candidateType}/${transport ?? "?"}`);
  }
  return countKinds(kinds);
}

function countKinds(kinds: string[]): string {
  if (!kinds.length) return "none";
  const counts = new Map<string, number>();
  for (const kind of kinds) counts.set(kind.toLowerCase(), (counts.get(kind.toLowerCase()) ?? 0) + 1);
  return [...counts].map(([kind, count]) => `${kind}×${count}`).join(" ");
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
