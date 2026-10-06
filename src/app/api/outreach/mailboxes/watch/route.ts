import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mailboxes } from "@/lib/outreach/schema";
import { registerWatch } from "@/lib/outreach/gmail";
import { getPlatformCredentials } from "@/lib/platform/credentials";
import { inOrg, runInOrganization } from "@/lib/tenancy/scope";

// POST /api/outreach/mailboxes/watch — (re)registers Gmail Pub/Sub push
// notifications for every connected mailbox. Watches expire after ~7 days,
// so an external cron should hit this daily. Same OUTREACH_TICK_SECRET
// protection as /api/outreach/tick (both are cron-triggered, not
// cookie-authenticated).
export async function POST(req: NextRequest) {
  const expected = process.env.OUTREACH_TICK_SECRET;
  const provided = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-tick-secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // No session: group the connected mailboxes by organization and renew each
  // organization's watches in its own scope. Google is connected per
  // organization, so one without it is skipped rather than failing the run.
  const connected = await db.select().from(mailboxes).where(eq(mailboxes.status, "connected"));
  const byOrganization = new Map<string, (typeof connected)[number][]>();
  for (const mailbox of connected) {
    byOrganization.set(mailbox.organizationId, [...(byOrganization.get(mailbox.organizationId) ?? []), mailbox]);
  }

  const results: { emailAddress: string; ok: boolean; error?: string }[] = [];
  const skipped: { organizationId: string; reason: string }[] = [];

  for (const [organizationId, organizationMailboxes] of byOrganization) {
    await runInOrganization(organizationId, async () => {
      const google = await getPlatformCredentials("google");
      if (!google) {
        console.log(`[outreach/watch] Google Workspace is not connected for organization ${organizationId}; watch renewal skipped`);
        skipped.push({ organizationId, reason: "google_not_connected" });
        return;
      }
      const topic = google.gmailWatchTopic;
      if (!topic) {
        skipped.push({ organizationId, reason: "gmail_watch_topic_not_configured" });
        return;
      }
      for (const mailbox of organizationMailboxes) {
        const result = await registerWatch(mailbox.emailAddress, topic);
        if (result.ok) {
          await db
            .update(mailboxes)
            .set({ lastHistoryId: result.historyId ?? mailbox.lastHistoryId })
            .where(and(inOrg(mailboxes), eq(mailboxes.id, mailbox.id)));
          results.push({ emailAddress: mailbox.emailAddress, ok: true });
        } else {
          results.push({ emailAddress: mailbox.emailAddress, ok: false, error: result.error });
        }
      }
    });
  }

  return NextResponse.json({ results, skipped });
}
