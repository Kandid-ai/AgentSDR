import type { NextRequest } from "next/server";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { callApiErrorResponse } from "@/lib/calls/sessions";
import { dialNext, parseDialerNextRequest } from "@/lib/calls/aiCampaigns/dialer.server";
import { runInOrganization } from "@/lib/tenancy/scope";

/**
 * POST — the rep dialer's next call (DialerNextResponse): claims the most
 * urgent due call on a free number and queues it for the rep to talk on from
 * this tab. Places a real WhatsApp call.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCrmMutationContext(request);
    const { id } = await params;
    const body = parseDialerNextRequest(await request.json().catch(() => null));
    return await runInOrganization(ctx.organizationId, async () => Response.json(await dialNext(id, body)));
  } catch (error) {
    return callApiErrorResponse(error);
  }
}
