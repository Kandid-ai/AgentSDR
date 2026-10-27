import type { NextRequest } from "next/server";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { callApiErrorResponse } from "@/lib/calls/sessions";
import { callAiLeadNow } from "@/lib/calls/aiCampaigns/campaigns.server";
import { runInOrganization } from "@/lib/tenancy/scope";

type Params = { params: Promise<{ id: string; contactId: string }> };

/**
 * POST — a trial call to this lead now, from the campaign's number, with the
 * campaign's agent and instructions (and the lead's own). Outside the
 * sequence; works on a draft campaign. Places a real WhatsApp call.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireCrmMutationContext(request);
    const { id, contactId } = await params;
    return await runInOrganization(ctx.organizationId, async () => Response.json(await callAiLeadNow(id, contactId)));
  } catch (error) {
    return callApiErrorResponse(error);
  }
}
