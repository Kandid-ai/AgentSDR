import { NextRequest, NextResponse } from "next/server";
import { buildMailboxQueues } from "@/lib/outreach/buildQueue";

// POST /api/outreach/build-queue — rebuilds today's per-mailbox send queue:
// wipes yesterday's leftovers, resets daily send counters (idempotent per
// mailbox-local day — safe to call more than once), then fills each
// connected mailbox's queue with due follow-ups first (most-overdue and
// deepest-into-sequence first), and brand-new leads round-robin filling
// whatever capacity is left over. Matches AgentSDR-app's
// make-mailbox-queues cron. Deliberately kept on an EXTERNAL cron (unlike
// /api/outreach/tick, which runs in-process) so it fires at a fixed
// wall-clock time every day — an in-process "every 24h since boot" timer
// would drift with every deploy/restart instead of running at a predictable
// hour. Set up an external cron to POST here once daily. Same shared-secret
// auth as /api/outreach/tick.
export async function POST(req: NextRequest) {
  const expected = process.env.OUTREACH_TICK_SECRET;
  const provided = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-tick-secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await buildMailboxQueues();
  return NextResponse.json(result);
}
