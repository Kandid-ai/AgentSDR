import { NextRequest, NextResponse } from "next/server";
import { authContextErrorResponse } from "@/lib/auth/context";
import { resetDailyLimits } from "@/jobs/resetDailyLimits";
import { withJobTracking } from "@/lib/linkedin/jobTracker";
import { resolveJobCaller } from "@/lib/linkedin/organizations.server";

export async function POST(req: NextRequest) {
  try {
    // The cron resets every organization; a signed-in member only their own.
    const { organizationId } = await resolveJobCaller(req);
    const runId = await withJobTracking("reset-daily-limits", () =>
      resetDailyLimits({ organizationId: organizationId ?? undefined })
    );
    return NextResponse.json({ ok: true, runId });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
