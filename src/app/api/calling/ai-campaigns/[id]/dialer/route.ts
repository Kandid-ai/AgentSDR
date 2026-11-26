import type { NextRequest } from "next/server";
import { withOrgContext } from "@/lib/auth/context";
import { callApiErrorResponse } from "@/lib/calls/sessions";
import { getDialerOverview } from "@/lib/calls/aiCampaigns/dialer.server";

/** GET — the rep dialer's header: script, numbers, calls due, today's counts (DialerOverview). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return await withOrgContext(request, async () => Response.json(await getDialerOverview(id)));
  } catch (error) {
    return callApiErrorResponse(error);
  }
}
