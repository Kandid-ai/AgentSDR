import type { NextRequest } from "next/server";
import { crmOperationErrorResponse } from "@/lib/crm/api";
import { parseUuid, readCrmJson } from "@/lib/crm/categories";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { updateReferral } from "@/lib/crm/referrals";
import { runInOrganization } from "@/lib/tenancy/scope";

/**
 * Edit a pending referral (ReferralUpdateRequest; null clears a field). 400 for
 * an invalid field or one that would leave nothing identifying them, 404 for
 * another organization's referral, 409 once started or dismissed.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCrmMutationContext(request);
    return await runInOrganization(ctx.organizationId, async () => {
      const referral = await updateReferral(
        parseUuid((await params).id, "referral id"),
        await readCrmJson(request),
        ctx.userName?.trim() || ctx.userEmail,
      );
      return Response.json({ referral });
    });
  } catch (error) {
    return crmOperationErrorResponse(error);
  }
}
