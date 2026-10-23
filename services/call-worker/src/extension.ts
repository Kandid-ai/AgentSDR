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

export async function stationWorker(context: BrowserContext): Promise<StationWorker> {
  let worker = context.serviceWorkers().find(isRecorderWorker);
  if (!worker) {
    worker = await context
      .waitForEvent("serviceworker", { predicate: isRecorderWorker, timeout: 30_000 })
      .catch(() => {
        throw new Error("The recorder extension's service worker did not start — is the extension installed in this browser profile?");
      });
  }
  const w = worker;
  let drainFailed = false;
  // The station object is set when the worker script finishes evaluating; allow a moment.
  let version: string | null = null;
  for (let i = 0; i < 20 && !version; i++) {
    version = await w
      .evaluate(() => (globalThis as unknown as { agentsdrStation?: { version: string } }).agentsdrStation?.version ?? null)
      .catch(() => null);
    if (!version) await new Promise((r) => setTimeout(r, 500));
  }
  if (!version) throw new Error("The recorder extension has no station mode (agentsdrStation missing) — update the extension");
  if (!versionAtLeast(version, MIN_EXTENSION_VERSION)) {
    throw new Error(`The recorder extension is ${version}; station mode needs ${MIN_EXTENSION_VERSION} or newer`);
  }

  type Station = {
    startCall(r: unknown): Promise<unknown>;
    endCall(id: string): Promise<unknown>;
    activeCall(): Promise<unknown>;
    drainLog?(): string[];
  };
  return {
    version,
    startCall: (req) => w.evaluate((r) => (globalThis as unknown as { agentsdrStation: Station }).agentsdrStation.startCall(r), req) as Promise<StationResult>,
    endCall: (callId) => w.evaluate((id) => (globalThis as unknown as { agentsdrStation: Station }).agentsdrStation.endCall(id), callId),
    activeCall: () => w.evaluate(() => (globalThis as unknown as { agentsdrStation: Station }).agentsdrStation.activeCall()) as Promise<ActiveCall>,
    drainLog: async () => {
      // Chrome stops and restarts an extension's service worker as it likes;
      // a handle to a stopped one fails, so the current one is looked up.
      const live = context.serviceWorkers().filter(isRecorderWorker).at(-1) ?? w;
      try {
        return await live.evaluate(() => (globalThis as unknown as { agentsdrStation: Station }).agentsdrStation.drainLog?.() ?? []);
      } catch (error) {
        if (!drainFailed) console.warn(`[worker] could not read the extension's call log: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
        drainFailed = true;
        return [];
      }
    },
  };
}
