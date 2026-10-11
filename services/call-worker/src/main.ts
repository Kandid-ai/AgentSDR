import { claim } from "./api";
import { config } from "./config";
import { activeCallForShutdown, requestStop, runCall, runLink } from "./jobs";
import { log } from "./log";

let stopping = false;
let wake: (() => void) | null = null;

function interruptibleSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    wake = () => {
      clearTimeout(t);
      resolve();
    };
  });
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  requestStop();
  log(`${signal}: stopping; no new jobs`);
  wake?.();
  const active = activeCallForShutdown();
  if (active?.worker) {
    log(`hanging up call ${active.callId}`);
    await active.worker.endCall(active.callId).catch(() => {});
    // runCall's own loop notices the call is done; give it up to 60 s.
    setTimeout(() => {
      log("shutdown grace period over; exiting");
      process.exit(0);
    }, 60_000).unref();
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

async function main(): Promise<void> {
  const cfg = config();
  log(`call worker ${cfg.workerId} -> ${cfg.agentsdrUrl}, launchers: ${cfg.launchers.join(", ")}, headless: ${cfg.headless}`);
  let backoff = 0;
  while (!stopping) {
    try {
      const { job } = await claim({ workerId: cfg.workerId, launchers: cfg.launchers });
      backoff = 0;
      if (!job) {
        await interruptibleSleep(cfg.claimIntervalMs);
        continue;
      }
      log(`claimed ${job.kind} job for station ${job.station.name}`);
      if (job.kind === "call") await runCall(job);
      else await runLink(job);
    } catch (e) {
      backoff = Math.min(backoff ? backoff * 2 : 1000, 30_000);
      log(`error: ${e instanceof Error ? e.message : String(e)} (retry in ${backoff / 1000}s)`);
      await interruptibleSleep(backoff);
    }
  }
  log("stopped");
  process.exit(0);
}

void main();
