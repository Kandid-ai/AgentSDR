import type { NextRequest } from "next/server";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { callApiErrorResponse } from "@/lib/calls/sessions";
import { parseDialerWrapUpRequest, wrapUpDialerCall } from "@/lib/calls/aiCampaigns/dialer.server";
import { runInOrganization } from "@/lib/tenancy/scope";

/** POST — how a call the lead picked up went (DialerWrapUpRequest); moves the lead on at once. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCrmMutationContext(request);
    const { id } = await params;
    const body = parseDialerWrapUpRequest(await request.json().catch(() => null));
    return await runInOrganization(ctx.organizationId, async () => Response.json(await wrapUpDialerCall(id, body)));
  } catch (error) {
    return callApiErrorResponse(error);
  }
}
