import { NextRequest, NextResponse } from "next/server";
import { authContextErrorResponse } from "@/lib/auth/context";
import { runOutreach } from "@/jobs/runOutreach";
import { withJobTracking } from "@/lib/linkedin/jobTracker";
import { resolveJobCaller } from "@/lib/linkedin/organizations.server";

export async function POST(req: NextRequest) {
  try {
    // The cron runs every organization; a signed-in member runs their own.
    const { organizationId } = await resolveJobCaller(req);
    const runId = await withJobTracking("run-outreach", () =>
      runOutreach({ organizationId: organizationId ?? undefined })
    );
    return NextResponse.json({ ok: true, runId });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
