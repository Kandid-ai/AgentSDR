/**
 * In-process replacement for external cron hitting /api/outreach/tick.
 * Safe ONLY because this app always runs as a single long-lived instance
 * (confirmed — no horizontal scaling); with more than one instance this
 * would double-tick and double-send, since nothing here claims a
 * distributed lock. If that ever changes, revert to external cron
 * per-instance or add a DB-based "only one instance runs this" claim.
 *
 * Started once from instrumentation.ts at process boot. Only the send tick
 * runs in-process (every TICK_INTERVAL_MS, default 1 min) — the daily queue
 * rebuild deliberately stays on an EXTERNAL cron hitting
 * /api/outreach/build-queue at a fixed wall-clock time instead. An
 * in-process "every 24h since boot" timer was tried and rejected: a
 * container restart resets that clock, so the rebuild time silently drifts
 * with every deploy — an external cron pinned to a fixed time doesn't have
 * that problem, and gives you a place to see whether it actually ran today.
 *
 * Guards against overlapping tick runs and swallows/logs errors so one bad
 * tick can't kill the loop or crash the process.
 */
import { runSchedulerTick } from "./scheduler";

const TICK_INTERVAL_MS = Number(process.env.OUTREACH_TICK_INTERVAL_MS ?? 60_000);

let started = false;
let tickRunning = false;
let tickCount = 0;

async function safeTick() {
  if (tickRunning) {
    console.warn("[outreach/internalScheduler] previous tick still running — skipping this cycle");
    return;
  }
  tickRunning = true;
  try {
    const result = await runSchedulerTick();
    tickCount += 1;
    // One-line heartbeat every 10 ticks (~10 min at the default interval)
    // instead of every tick, so logs stay readable but liveness is still visible.
    if (tickCount % 10 === 0 || result.sent > 0 || result.failed > 0) {
      console.log(`[outreach/internalScheduler] tick #${tickCount}:`, result);
    }
  } catch (err) {
    console.error("[outreach/internalScheduler] tick threw:", err);
  } finally {
    tickRunning = false;
  }
}

/** Starts the tick loop. Idempotent — safe to call more than once (e.g. Next.js may invoke register() more than once in some setups); only the first call has any effect. */
export function startInternalOutreachScheduler() {
  if (started) return;
  started = true;

  console.log(`[outreach/internalScheduler] starting — tick every ${TICK_INTERVAL_MS}ms`);

  setInterval(safeTick, TICK_INTERVAL_MS);

  // Fire an initial tick shortly after boot instead of waiting a full
  // interval, so a restart doesn't leave sends idle for up to a minute.
  setTimeout(safeTick, 5_000);
}
