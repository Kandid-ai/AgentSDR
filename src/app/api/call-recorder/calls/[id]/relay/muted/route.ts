import type { NextRequest } from "next/server";
import { callApiErrorResponse, withRecorderScope } from "@/lib/calls/sessions";
import { assertRelayable, parseLeadMutedBody, reportLeadMuted, stationRelayCredential } from "@/lib/calls/remoteRep";
import { repRelay } from "@/lib/calls/repRelay.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** As the relay's own route: the extension's content script fetches from web.whatsapp.com, bearer token only. */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://web.whatsapp.com",
  Vary: "Origin",
} as const;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "600",
    },
  });
}

/**
 * POST { muted } — the station saw the lead mute or unmute (WhatsApp shows
 * "Muted" where the call timer was); the rep's tab is told on its relay
 * stream (contract.ts, RepRelayEvent "lead-muted").
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const id = (await params).id;
    if (!repRelay().isAuthorized(id, "station", stationRelayCredential(request))) {
      await withRecorderScope(request, id, async (row) => assertRelayable(row));
    }
    reportLeadMuted(id, parseLeadMutedBody(await request.text()));
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  } catch (error) {
    const response = callApiErrorResponse(error);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
    return new Response(response.body, { status: response.status, headers });
  }
}
