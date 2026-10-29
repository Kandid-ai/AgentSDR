import "server-only";

import { generateTurnIceServers, REP_LINK_TURN_TTL_SECONDS } from "@/lib/platform/cloudflareTurn";
import { requirePlatformCredentials } from "@/lib/platform/credentials";
import type { RepLinkIceServer } from "./contract";

/**
 * Fresh ICE servers (STUN + Cloudflare TURN, credentials valid
 * REP_LINK_TURN_TTL_SECONDS) for one side of a rep call's link (contract.ts,
 * RecorderRemoteRep), for the organization in scope. Throws
 * PlatformNotConnectedError when Cloudflare TURN is not connected, and
 * TurnCredentialsError when Cloudflare refuses or fails. Never stored.
 */
export async function repLinkIceServers(): Promise<RepLinkIceServer[]> {
  return generateTurnIceServers(await requirePlatformCredentials("turn"), REP_LINK_TURN_TTL_SECONDS);
}
