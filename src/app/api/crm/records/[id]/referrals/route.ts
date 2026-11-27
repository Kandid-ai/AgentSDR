import type { NextRequest } from "next/server";
import { withOrgContext } from "@/lib/auth/context";
import { crmOperationErrorResponse } from "@/lib/crm/api";
import { parseUuid, readCrmJson } from "@/lib/crm/categories";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { createManualReferral, listRecordReferrals } from "@/lib/crm/referrals";
import { runInOrganization } from "@/lib/tenancy/scope";

/** The record's referrals, newest first. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withOrgContext(request, async () => {
      const referrals = await listRecordReferrals(parseUuid((await params).id, "record id"));
      return Response.json({ referrals });
    });
  } catch (error) {
    return crmOperationErrorResponse(error);
  }
}

/** A person adds a referral the AI missed (ReferralCreateRequest); source "human". 404 for another organization's record. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCrmMutationContext(request);
    return await runInOrganization(ctx.organizationId, async () => {
      const referral = await createManualReferral(
        parseUuid((await params).id, "record id"),
        await readCrmJson(request),
        ctx.userName?.trim() || ctx.userEmail,
      );
      return Response.json({ referral }, { status: 201 });
    });
  } catch (error) {
    return crmOperationErrorResponse(error);
  }
}
