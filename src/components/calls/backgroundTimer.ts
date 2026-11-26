"use client";

/**
 * setTimeout that keeps time while the tab is in the background.
 *
 * Chrome throttles a hidden tab's timers: at most once a second, and after
 * five minutes hidden, chained timers can be held to once a minute unless the
 * page is audible. A rep working in another app with the dialer's pop-out
 * open is exactly that case. A dedicated worker's timers are not intensively
 * throttled, and its messages are ordinary tasks on this page, so the timers
 * run in a tiny inline worker that posts back when each one is due. Where a
 * worker cannot be made (no Worker, a CSP refusing blob: workers), this falls
 * back to the page's own setTimeout.
 */

const WORKER_SOURCE = `
const timers = new Map();
self.onmessage = (event) => {
  const { type, id, ms } = event.data;
  if (type === "set") {
    timers.set(id, setTimeout(() => { timers.delete(id); self.postMessage(id); }, ms));
  } else {
    clearTimeout(timers.get(id));
    timers.delete(id);
  }
};
`;

let worker: Worker | null | undefined;
let nextId = 1;
const callbacks = new Map<number, { callback: () => void; due: number }>();
/** Fallback timers by our id, when there is no worker. */
const fallbacks = new Map<number, ReturnType<typeof setTimeout>>();

function timerWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  try {
    if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL.createObjectURL !== "function") return null;
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    // The URL is kept (one tiny blob for the page's life): revoking it at once can race the worker's script load.
    const created = new Worker(url);
    created.onmessage = (event: MessageEvent<number>) => {
      const pending = callbacks.get(event.data);
      callbacks.delete(event.data);
      pending?.callback();
    };
    created.onerror = () => {
      // The worker died (or never started): run what is pending on the page's own timers from now on.
      worker = null;
      created.terminate();
      for (const [id, { callback, due }] of callbacks) fallbacks.set(id, setTimeout(() => { fallbacks.delete(id); callbacks.delete(id); callback(); }, Math.max(0, due - Date.now())));
    };
    worker = created;
  } catch {
    worker = null;
  }
  return worker;
}

/** Calls `callback` after `ms`, even in a hidden tab. Returns an id for clearBackgroundTimeout. */
export function setBackgroundTimeout(callback: () => void, ms: number): number {
  const id = nextId++;
  callbacks.set(id, { callback, due: Date.now() + ms });
  const target = timerWorker();
  if (target) {
    target.postMessage({ type: "set", id, ms: Math.max(0, ms) });
  } else {
    fallbacks.set(id, setTimeout(() => { fallbacks.delete(id); callbacks.delete(id); callback(); }, ms));
  }
  return id;
}

export function clearBackgroundTimeout(id: number | undefined) {
  if (id === undefined) return;
  callbacks.delete(id);
  const fallback = fallbacks.get(id);
  if (fallback !== undefined) {
    clearTimeout(fallback);
    fallbacks.delete(id);
  }
  worker?.postMessage({ type: "clear", id });
}
