import type { NextRequest } from "next/server";
import { withOrgContext } from "@/lib/auth/context";
import type { RepLinkIceServersResponse } from "@/lib/calls/contract";
import { repLinkIceServers } from "@/lib/calls/repLinkIce.server";
import { callApiErrorResponse } from "@/lib/calls/sessions";
import { TurnCredentialsError } from "@/lib/platform/cloudflareTurn";

/**
 * GET /api/calls/rep-link/ice-servers — ICE servers (Cloudflare TURN, fresh
 * short-lived credentials) for the rep's tab, minted before it makes the
 * offer for a call it talks on through a calling number (contract.ts,
 * RecorderRemoteRep). Proxy-gated like every GET under /api/calls; 409 while
 * the organization has not connected Cloudflare TURN.
 */
export async function GET(request: NextRequest) {
  try {
    return await withOrgContext(request, async () => {
      const body: RepLinkIceServersResponse = { iceServers: await repLinkIceServers() };
      return Response.json(body, { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) {
    if (error instanceof TurnCredentialsError) return Response.json({ error: error.message }, { status: 502 });
    return callApiErrorResponse(error);
  }
}
