import type { NextRequest } from "next/server";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { callApiErrorResponse } from "@/lib/calls/sessions";
import { parseDialerMessageRequest, sendDialerMessage } from "@/lib/calls/aiCampaigns/dialer.server";
import { runInOrganization } from "@/lib/tenancy/scope";

/** POST — a WhatsApp the rep writes to a lead, from the lead's own calling number (outside the sequence). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCrmMutationContext(request);
    const { id } = await params;
    const body = parseDialerMessageRequest(await request.json().catch(() => null));
    return await runInOrganization(ctx.organizationId, async () => Response.json(await sendDialerMessage(id, body)));
  } catch (error) {
    return callApiErrorResponse(error);
  }
}
