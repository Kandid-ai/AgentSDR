import type { Page } from "playwright-core";
import type { WorkerJob } from "../../../src/lib/calls/stationContract";
import { getCallStatus, releaseCall, reportStationState } from "./api";
import { config } from "./config";
import { stationWorker, type StationWorker } from "./extension";
import { openStationBrowser, type StationBrowser } from "./launchers";
import { log } from "./log";
import { openWhatsApp, screenshotDataUrl, startPhoneNumberLogin, waitForReady, waitForWhatsAppState } from "./whatsapp";

type CallJob = Extract<WorkerJob, { kind: "call" }>;
type LinkJob = Extract<WorkerJob, { kind: "link" }>;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Set while a call runs, so a shutdown can hang it up. */
let current: { callId: string; worker: StationWorker | null } | null = null;
let stopping = false;

export function activeCallForShutdown(): { callId: string; worker: StationWorker | null } | null {
  return current;
}

export function requestStop(): void {
  stopping = true;
}

async function safeRelease(callId: string, error: string): Promise<void> {
  try {
    await releaseCall(callId, error);
  } catch (e) {
    log(`call ${callId}: release failed: ${message(e)}`);
  }
}

async function safeState(stationId: string, body: Parameters<typeof reportStationState>[1]): Promise<void> {
  try {
    await reportStationState(stationId, body);
  } catch (e) {
    log(`station ${stationId}: state report failed: ${message(e)}`);
  }
}

async function waitDone(callId: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await getCallStatus(callId)).done) return true;
    } catch (e) {
      log(`call ${callId}: status check failed: ${message(e)}`);
    }
    await sleep(3000);
  }
  return false;
}

export async function runCall(job: CallJob): Promise<void> {
  const { station, call } = job;
  const cfg = config();
  const tag = `call ${call.id} @ ${station.name}`;
  let browser: StationBrowser | null = null;
  let released = false;
  const release = async (error: string) => {
    released = true;
    await safeRelease(call.id, error);
  };
  try {
    log(`${tag}: opening browser (${station.launcher})`);
    try {
      browser = await openStationBrowser(station);
    } catch (e) {
      log(`${tag}: browser failed: ${message(e)}`);
      await release(`Could not open the station's browser: ${message(e)}`);
      return;
    }
    const page = await openWhatsApp(browser.context);
    // The browser closing or WhatsApp's tab crashing ends the call with no
    // report from the extension; without this the worker would wait out the
    // whole call timeout with the station held busy.
    const lost = new Promise<string>((resolve) => {
      browser?.context.on("close", () => resolve("The station's browser closed during the call"));
      page.on("crash", () => resolve("WhatsApp Web crashed during the call"));
      page.on("close", () => resolve("WhatsApp Web's tab closed during the call"));
    });
    watchConsole(browser, tag);
    log(`${tag}: waiting for WhatsApp Web`);
    const state = await waitForWhatsAppState(page, 120_000);
    if (state === "logged_out") {
      log(`${tag}: WhatsApp Web is logged out`);
      const error = `WhatsApp Web on ${station.name} is logged out — link it again`;
      await safeState(station.id, { status: "logged_out", error });
      await release(error);
      return;
    }
    if (state === "timeout") {
      log(`${tag}: WhatsApp Web did not load`);
      await release(`WhatsApp Web on ${station.name} did not load in time`);
      return;
    }
    await safeState(station.id, { status: "active", error: null });

    let worker: StationWorker;
    try {
      worker = await stationWorker(browser.context);
    } catch (e) {
      await release(message(e));
      return;
    }
    current = { callId: call.id, worker };
    log(`${tag}: starting call (extension ${worker.version})`);
    const started = await worker.startCall({
      callId: call.id,
      phone: call.phone,
      recorderToken: call.recorderToken,
      apiBase: new URL(cfg.agentsdrUrl).origin,
      lead: call.lead,
      agent: { brief: call.brief },
      clickedAt: Date.now(),
    });
    if (!started.ok) {
      log(`${tag}: start refused: ${started.error}`);
      await release(started.error);
      return;
    }
    log(`${tag}: call running`);
    const outcome = await Promise.race([waitDone(call.id, cfg.callTimeoutMs), lost]);
    if (typeof outcome === "string") {
      log(`${tag}: ${outcome}`);
      // The extension may still have reported the end just before; give it a moment.
      if (!(await waitDone(call.id, 5_000))) await release(outcome);
      return;
    }
    let done = outcome;
    if (!done) {
      log(`${tag}: timed out, hanging up`);
      await worker.endCall(call.id).catch((e) => log(`${tag}: endCall failed: ${message(e)}`));
      done = await waitDone(call.id, 30_000);
      if (!done) await release("The call timed out");
    }
    log(`${tag}: finished`);
    await sleep(3000);
  } catch (e) {
    log(`${tag}: error: ${message(e)}`);
    if (!released) await release(`Call worker error: ${message(e)}`);
  } finally {
    current = null;
    if (browser) await browser.close().catch((e) => log(`${tag}: close failed: ${message(e)}`));
  }
}

export async function runLink(job: LinkJob): Promise<void> {
  const { station } = job;
  const tag = `link @ ${station.name}`;
  let browser: StationBrowser | null = null;
  try {
    log(`${tag}: opening browser (${station.launcher})`);
    browser = await openStationBrowser(station);
    const page = await openWhatsApp(browser.context);
    const state = await waitForWhatsAppState(page, 90_000);
    if (state === "ready") {
      log(`${tag}: already linked`);
      await safeState(station.id, { status: "active", linkDone: true, link: null, error: null });
      return;
    }
    if (state === "timeout") {
      await safeState(station.id, { linkDone: true, link: null, error: "WhatsApp Web did not load" });
      return;
    }
    const code = await startPhoneNumberLogin(page, station.phone);
    log(`${tag}: code ${code ?? "not found (QR only)"}`);
    const deadline = Date.now() + 4 * 60_000;
    while (Date.now() < deadline && !stopping) {
      await safeState(station.id, { link: { code, screenshot: await shot(page) } });
      // Waits the whole 8 s unless the chats appear: the login screen stays up until the code is typed.
      if (await waitForReady(page, 8_000)) {
        log(`${tag}: linked`);
        // Let WhatsApp finish storing the new session before the browser closes.
        await sleep(15_000);
        await safeState(station.id, { status: "active", link: null, linkDone: true, error: null });
        return;
      }
    }
    log(`${tag}: gave up`);
    await safeState(station.id, { linkDone: true, link: null, error: "Linking timed out" });
  } catch (e) {
    log(`${tag}: error: ${message(e)}`);
    await safeState(station.id, { linkDone: true, link: null, error: `Linking failed: ${message(e)}` });
  } finally {
    if (browser) await browser.close().catch((e) => log(`${tag}: close failed: ${message(e)}`));
  }
}

/**
 * Mirrors the extension's own messages into the worker's log: the AI agent's
 * steps and transcript ("[agentsdr agent]"), the recorder's warnings, and page
 * errors — the only record of what happened inside a cloud call.
 */
function watchConsole(browser: StationBrowser | null, tag: string): void {
  if (!browser) return;
  browser.context.on("console", (msg) => {
    const text = msg.text();
    if (/agentsdr|\[recorder\]/i.test(text) || msg.type() === "error") log(`${tag}: [${msg.type()}] ${text.slice(0, 500)}`);
  });
  browser.context.on("weberror", (error) => log(`${tag}: page error: ${error.error().message.slice(0, 300)}`));
}

async function shot(page: Page): Promise<string | null> {
  return screenshotDataUrl(page).catch(() => null);
}
