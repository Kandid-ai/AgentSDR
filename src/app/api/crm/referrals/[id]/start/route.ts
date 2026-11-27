import type { NextRequest } from "next/server";
import { crmOperationErrorResponse } from "@/lib/crm/api";
import { parseUuid, readCrmJson } from "@/lib/crm/categories";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { startReferral } from "@/lib/crm/referrals";
import { runInOrganization } from "@/lib/tenancy/scope";

/**
 * Start outreach (ReferralStartRequest → ReferralStartResponse): creates the
 * referred person as a lead and enrolls them in the chosen campaign of each
 * channel; a channel that fails or skips is reported in `results`, never
 * failing the others. 400 for no usable channel, 404 unknown referral or
 * campaign-less request, 409 when already decided or the person is Do Not Contact.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCrmMutationContext(request);
    return await runInOrganization(ctx.organizationId, async () => {
      const result = await startReferral(
        parseUuid((await params).id, "referral id"),
        await readCrmJson(request),
        ctx.userName?.trim() || ctx.userEmail,
      );
      return Response.json(result);
    });
  } catch (error) {
    return crmOperationErrorResponse(error);
  }
}
