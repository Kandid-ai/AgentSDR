import type { BrowserContext, Worker } from "playwright-core";
import type { RecorderCallRequest } from "../../../src/lib/calls/contract";

export const MIN_EXTENSION_VERSION = "0.17.0";

export type StationCallRequest = Omit<RecorderCallRequest, "source" | "type" | "requestId">;
export type StationResult = { ok: true } | { ok: false; error: string };
export type ActiveCall = { callId: string; dialedAt: number | null; answeredAt: number | null } | null;

export type StationWorker = {
  version: string;
  startCall(req: StationCallRequest): Promise<StationResult>;
  endCall(callId: string): Promise<unknown>;
  activeCall(): Promise<ActiveCall>;
  /** The extension's call log since the last drain (empty on extensions before 0.17.4). */
  drainLog(): Promise<string[]>;
};

function versionAtLeast(version: string, min: string): boolean {
  const a = version.split(".").map((n) => parseInt(n, 10) || 0);
  const b = min.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

const isRecorderWorker = (w: Worker) => w.url().startsWith("chrome-extension://") && w.url().endsWith("/background.js");

type Probe = { version: string | null; api: boolean };

/** The extension's station version in this worker, and whether its chrome.* calls work. */
async function probe(worker: Worker): Promise<Probe> {
  return worker
    .evaluate(async () => {
      const version = (globalThis as unknown as { agentsdrStation?: { version: string } }).agentsdrStation?.version ?? null;
      try {
        await chrome.storage.session.get(null);
        return { version, api: true };
      } catch {
        return { version, api: false };
      }
    })
    .catch(() => ({ version: null, api: false }));
}

/**
 * The recorder's background worker that is actually running. Reopening a
 * GoLogin profile lists two of them (23 Oct 2026): a stale one carried over
 * from the last session, which still evaluates — even reports its version —
 * but whose every chrome.* call fails "No SW", and the live one. Taking the
 * first found failed every call on a relinked number, so each candidate is
 * tested with a real API call, newest first.
 */
async function liveWorker(context: BrowserContext, timeoutMs: number): Promise<{ worker: Worker; version: string } | null> {
  const deadline = Date.now() + timeoutMs;
  do {
    for (const worker of context.serviceWorkers().filter(isRecorderWorker).reverse()) {
      const { version, api } = await probe(worker);
      if (version && api) return { worker, version };
    }
    await new Promise((r) => setTimeout(r, 500));
  } while (Date.now() < deadline);
  return null;
}

export async function stationWorker(context: BrowserContext): Promise<StationWorker> {
  if (!context.serviceWorkers().some(isRecorderWorker)) {
    await context.waitForEvent("serviceworker", { predicate: isRecorderWorker, timeout: 30_000 }).catch(() => {
      throw new Error("The recorder extension's service worker did not start — is the extension installed in this browser profile?");
    });
  }
  // The station object is set when the worker script finishes evaluating; allow a moment.
  const found = await liveWorker(context, 10_000);
  if (!found) throw new Error("The recorder extension has no working station mode (agentsdrStation missing, or its worker is not running) — update the extension");
  const { version } = found;
  let current = found.worker;
  if (!versionAtLeast(version, MIN_EXTENSION_VERSION)) {
    throw new Error(`The recorder extension is ${version}; station mode needs ${MIN_EXTENSION_VERSION} or newer`);
  }
  let drainFailed = false;
  /** Chrome stops and restarts an extension's worker as it likes; a stale handle is swapped for the live one. */
  const live = async (): Promise<Worker> => {
    if ((await probe(current)).api) return current;
    current = (await liveWorker(context, 5_000))?.worker ?? current;
    return current;
  };

  type Station = {
    startCall(r: unknown): Promise<unknown>;
    endCall(id: string): Promise<unknown>;
    activeCall(): Promise<unknown>;
    drainLog?(): string[] | Promise<string[]>;
  };
  return {
    version,
    startCall: async (req) => (await live()).evaluate((r) => (globalThis as unknown as { agentsdrStation: Station }).agentsdrStation.startCall(r), req) as Promise<StationResult>,
    endCall: async (callId) => (await live()).evaluate((id) => (globalThis as unknown as { agentsdrStation: Station }).agentsdrStation.endCall(id), callId),
    activeCall: async () => (await live()).evaluate(() => (globalThis as unknown as { agentsdrStation: Station }).agentsdrStation.activeCall()) as Promise<ActiveCall>,
    drainLog: async () => {
      try {
        return await (await live()).evaluate(() => (globalThis as unknown as { agentsdrStation: Station }).agentsdrStation.drainLog?.() ?? []);
      } catch (error) {
        if (!drainFailed) console.warn(`[worker] could not read the extension's call log: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
        drainFailed = true;
        return [];
      }
    },
  };
}
