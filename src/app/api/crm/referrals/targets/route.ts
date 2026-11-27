import type { NextRequest } from "next/server";
import { withOrgContext } from "@/lib/auth/context";
import { crmOperationErrorResponse } from "@/lib/crm/api";
import { listReferralTargets } from "@/lib/crm/referrals";

/** The campaigns a referral can be enrolled in, per channel (ReferralTargetsResponse). */
export async function GET(request: NextRequest) {
  try {
    return await withOrgContext(request, async () => Response.json(await listReferralTargets()));
  } catch (error) {
    return crmOperationErrorResponse(error);
  }
}
