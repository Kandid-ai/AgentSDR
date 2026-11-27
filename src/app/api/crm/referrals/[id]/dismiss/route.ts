import type { NextRequest } from "next/server";
import { crmOperationErrorResponse } from "@/lib/crm/api";
import { parseUuid } from "@/lib/crm/categories";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { dismissReferral } from "@/lib/crm/referrals";
import { runInOrganization } from "@/lib/tenancy/scope";

/** Dismiss a pending referral (no body). Dismissing twice is fine; 409 once started. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCrmMutationContext(request);
    return await runInOrganization(ctx.organizationId, async () => {
      const referral = await dismissReferral(parseUuid((await params).id, "referral id"), ctx.userName?.trim() || ctx.userEmail);
      return Response.json({ referral });
    });
  } catch (error) {
    return crmOperationErrorResponse(error);
  }
}
