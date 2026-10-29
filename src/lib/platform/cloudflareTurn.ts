import "server-only";

import { MAX_REP_LINK_ICE_SERVERS, type RepLinkIceServer } from "@/lib/calls/contract";
import type { PlatformCredentials } from "./catalog";

/**
 * Cloudflare Realtime TURN (the `turn` platform integration): short-lived
 * TURN credentials minted from the organization's TURN key, for the WebRTC
 * link of a rep talking through a calling station (contract.ts,
 * RecorderRemoteRep). Docs:
 * https://developers.cloudflare.com/realtime/turn/generate-credentials/
 *
 *   POST https://rtc.live.cloudflare.com/v1/turn/keys/<key id>/credentials/generate-ice-servers
 *   Authorization: Bearer <key API token>   { "ttl": <seconds> }
 *   → 201 { "iceServers": [{ "urls": [stun…] }, { "urls": [turn…, turns…], "username", "credential" }] }
 *
 * The credentials are handed straight to the browser that uses them and are
 * never stored or logged.
 */

/** One call's worth, with room for a long wait in the queue (Cloudflare allows up to 48 h). */
export const REP_LINK_TURN_TTL_SECONDS = 2 * 60 * 60;

/** How long Cloudflare has to answer. */
const TURN_TIMEOUT_MS = 10_000;

/** A failed mint, with a message safe to show (no credentials in it). */
export class TurnCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TurnCredentialsError";
  }
}

/**
 * The usable servers in Cloudflare's answer: stun:/turn:/turns: URLs only,
 * none on port 53 (browsers block it, and without trickle ICE it only adds a
 * timeout — Cloudflare's own advice), at most MAX_REP_LINK_ICE_SERVERS.
 * Returns [] for anything that is not the documented shape.
 */
export function usableIceServers(body: unknown): RepLinkIceServer[] {
  const list = (body as { iceServers?: unknown } | null)?.iceServers;
  if (!Array.isArray(list)) return [];
  const servers: RepLinkIceServer[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const { urls, username, credential } = entry as Record<string, unknown>;
    const kept = (Array.isArray(urls) ? urls : [urls]).filter(
      (url): url is string => typeof url === "string" && /^(stun|turns?):/i.test(url) && !usesPort53(url),
    );
    if (!kept.length) continue;
    servers.push({
      urls: kept.slice(0, MAX_REP_LINK_ICE_SERVERS),
      ...(typeof username === "string" ? { username } : {}),
      ...(typeof credential === "string" ? { credential } : {}),
    });
    if (servers.length === MAX_REP_LINK_ICE_SERVERS) break;
  }
  return servers;
}

function usesPort53(url: string): boolean {
  // turn:host:53?transport=udp, stun:host:53, turn:[v6]:53
  return /:53(?:[?/]|$)/.test(url.replace(/^[a-z]+:/i, ""));
}

/** Whether the list has a relay — a TURN URL with credentials. */
export function hasTurnRelay(servers: RepLinkIceServer[]): boolean {
  return servers.some(
    (server) =>
      typeof server.username === "string" &&
      typeof server.credential === "string" &&
      (Array.isArray(server.urls) ? server.urls : [server.urls]).some((url) => /^turns?:/i.test(url)),
  );
}

/** Mints ICE servers with these credentials; throws TurnCredentialsError. */
export async function generateTurnIceServers(
  { keyId, apiToken }: PlatformCredentials["turn"],
  ttlSeconds: number,
): Promise<RepLinkIceServer[]> {
  let response: Response;
  try {
    response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ttl: ttlSeconds }),
        signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
      },
    );
  } catch {
    throw new TurnCredentialsError("Could not reach Cloudflare TURN");
  }
  if (response.status === 401 || response.status === 403) {
    throw new TurnCredentialsError("Cloudflare TURN didn't accept this key ID and API token");
  }
  if (response.status === 404) throw new TurnCredentialsError("Cloudflare TURN has no key with this ID");
  if (!response.ok) throw new TurnCredentialsError(`Cloudflare TURN answered ${response.status}`);
  const servers = usableIceServers(await response.json().catch(() => null));
  if (!hasTurnRelay(servers)) throw new TurnCredentialsError("Cloudflare TURN answered without a relay");
  return servers;
}
