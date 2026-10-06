import { NextRequest, NextResponse } from "next/server";
import { authContextErrorResponse } from "@/lib/auth/context";
import { replayLinkedinWebhooks } from "@/jobs/replayLinkedinWebhooks";
import { withJobTracking } from "@/lib/linkedin/jobTracker";
import { resolveJobCaller } from "@/lib/linkedin/organizations.server";

export async function POST(req: NextRequest) {
  try {
    // The cron replays every organization's deliveries; a signed-in member only their own.
    const { organizationId } = await resolveJobCaller(req);
    let summary: Awaited<ReturnType<typeof replayLinkedinWebhooks>> | null = null;
    const runId = await withJobTracking("replay-linkedin-webhooks", async () => {
      summary = await replayLinkedinWebhooks(100, organizationId ?? undefined);
    });
    return NextResponse.json({ ok: true, runId, summary });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
