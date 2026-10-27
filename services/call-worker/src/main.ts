import { LEASE_RENEW_MS } from "../../../src/lib/calls/stationContract";
import { claim, leaseStations, reportStationState } from "./api";
import { config } from "./config";
import { activeCallForShutdown, prepareWhatsApp, requestStop, runCall, runLink, watchConsole } from "./jobs";
import { openStationBrowser } from "./launchers";
import { OpenStations } from "./openStations";
import { isLoginScreen } from "./whatsapp";
import { log } from "./log";

let stopping = false;
/** Numbers kept open between calls (KEEP_OPEN > 0). */
let openStations: OpenStations | null = null;

function startOpenStations(): OpenStations {
  const cfg = config();
  const manager = new OpenStations(cfg.keepOpen, {
    lease: (held, capacity) =>
      leaseStations({ workerId: cfg.workerId, launchers: cfg.launchers, capacity, held, ...(cfg.stations.length ? { stations: cfg.stations } : {}) }),
    open: async (station) => {
      const note = (text: string) => log(`open @ ${station.name}: ${text}`);
      const browser = await openStationBrowser(station, { note });
      watchConsole(browser, `open @ ${station.name}`);
      const prepared = await prepareWhatsApp(station, browser, note).catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }));
      if ("error" in prepared) {
        await browser.close().catch(() => {});
        return prepared;
      }
      return { browser, page: prepared.page };
    },
    close: (ready) => ready.browser.close(),
    health: async (ready, station) => {
      if (ready.page.isClosed()) return "gone";
      if (await isLoginScreen(ready.page)) {
        await reportStationState(station.id, { status: "logged_out", error: `WhatsApp Web on ${station.name} is logged out — link it again` }).catch(() => {});
        return "logged_out";
      }
      return "ok";
    },
    log,
    now: () => Date.now(),
  });
  const tick = () => void manager.tick();
  tick();
  setInterval(tick, LEASE_RENEW_MS).unref();
  return manager;
}
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
  log(
    `call worker ${cfg.workerId} -> ${cfg.agentsdrUrl}, launchers: ${cfg.launchers.join(", ")}, headless: ${cfg.headless}, keeps open: ${cfg.keepOpen}` +
      `${cfg.stations.length ? `, only: ${cfg.stations.join(", ")}` : ""}`,
  );
  if (cfg.keepOpen > 0) openStations = startOpenStations();
  let backoff = 0;
  while (!stopping) {
    try {
      const { job } = await claim({ workerId: cfg.workerId, launchers: cfg.launchers, ...(cfg.stations.length ? { stations: cfg.stations } : {}) });
      backoff = 0;
      if (!job) {
        await interruptibleSleep(cfg.claimIntervalMs);
        continue;
      }
      log(`claimed ${job.kind} job for station ${job.station.name}`);
      if (job.kind === "call") {
        const open = (await openStations?.acquire(job.station.id)) ?? null;
        try {
          await runCall(job, open);
        } finally {
          await openStations?.done(job.station.id);
        }
      } else {
        // Its profile must not be open twice.
        await openStations?.closeFor(job.station.id);
        await runLink(job);
      }
    } catch (e) {
      backoff = Math.min(backoff ? backoff * 2 : 1000, 30_000);
      log(`error: ${e instanceof Error ? e.message : String(e)} (retry in ${backoff / 1000}s)`);
      await interruptibleSleep(backoff);
    }
  }
  // Close the open numbers, saving their profiles, and give their leases back.
  await openStations?.shutdown();
  log("stopped");
  process.exit(0);
}

void main();
