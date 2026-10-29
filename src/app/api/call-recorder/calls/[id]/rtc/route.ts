import type { NextRequest } from "next/server";
import { readCrmJson } from "@/lib/crm/categories";
import { parseRtcAnswerRequest, recordRtcAnswer } from "@/lib/calls/remoteRep";
import { callApiErrorResponse, withRecorderScope } from "@/lib/calls/sessions";

/**
 * The station's WebRTC answer to the rep's offer on a call the rep talks on
 * (contract.ts, RecorderRemoteRep), posted once by the station's extension
 * with the per-call bearer token, like the rest of this prefix. The rep's tab
 * reads it from GET /api/calls/:id (`rtcAnswer`).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withRecorderScope(request, (await params).id, async (row) => {
      await recordRtcAnswer(row, parseRtcAnswerRequest(await readCrmJson(request)));
      return Response.json({ ok: true });
    });
  } catch (error) {
    return callApiErrorResponse(error);
  }
}
