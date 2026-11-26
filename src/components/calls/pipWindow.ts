"use client";

/**
 * The call's pop-out: a small always-on-top window (Document Picture-in-Picture,
 * Chrome 116+) so the rep can work in another app and still see the call and
 * the dialer. Module-level, like remoteRepCall.ts: DialerOverlay renders into
 * the window's body with a portal; this file opens it, copies the page's
 * styles and theme into it, and notices when the rep closes it. Closing it
 * never stops a call or the dialer: the page's own bar and wrap-up take over.
 */

import { useSyncExternalStore } from "react";

type DocumentPictureInPicture = {
  requestWindow(options?: { width?: number; height?: number; disallowReturnToOpener?: boolean; preferInitialWindowPlacement?: boolean }): Promise<Window>;
  readonly window: Window | null;
};

function api(): DocumentPictureInPicture | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture ?? null;
}

/** The size it opens at; the rep can resize it, and Chrome remembers their size. */
const WIDTH = 380;
const HEIGHT = 230;
/** Tall enough for the wrap-up form. */
export const PIP_WRAP_UP_HEIGHT = 560;

let current: Window | null = null;
let opening: Promise<Window | null> | null = null;
let cleanup: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit(next: Window | null) {
  current = next;
  for (const listener of listeners) listener();
}

export function subscribePip(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pipSnapshot(): Window | null {
  return current;
}

export const isPipSupported = (): boolean => api() !== null;

const subscribeNothing = () => () => {};

/** Whether this browser can pop the call out (false on the server, so the first render matches). */
export function usePipSupported(): boolean {
  return useSyncExternalStore(subscribeNothing, isPipSupported, () => false);
}

export function usePipWindow(): Window | null {
  return useSyncExternalStore(subscribePip, pipSnapshot, () => null);
}

/** Copies one stylesheet node (<link rel=stylesheet> or <style>) into the pop-out. */
function copyStyle(node: Node, into: Document) {
  if (node instanceof HTMLLinkElement && node.rel === "stylesheet") {
    const link = into.createElement("link");
    link.rel = "stylesheet";
    link.href = node.href;
    if (node.media) link.media = node.media;
    if (node.crossOrigin !== null) link.crossOrigin = node.crossOrigin;
    into.head.appendChild(link);
  } else if (node instanceof HTMLStyleElement) {
    const style = into.createElement("style");
    if (node.media) style.media = node.media;
    style.textContent = node.textContent;
    into.head.appendChild(style);
  }
}

/** The page's <html> class (dark, the font variables), data-theme and color scheme. */
function copyTheme(into: Document) {
  const from = document.documentElement;
  const to = into.documentElement;
  to.className = from.className;
  const theme = from.getAttribute("data-theme");
  if (theme === null) to.removeAttribute("data-theme");
  else to.setAttribute("data-theme", theme);
  to.style.colorScheme = from.style.colorScheme;
}

function prepare(pip: Window): () => void {
  const doc = pip.document;
  for (const node of Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))) copyStyle(node, doc);
  copyTheme(doc);
  doc.title = "AgentSDR call";
  doc.body.className = "bg-bg-white-0 text-text-strong-950 antialiased";
  doc.body.style.margin = "0";

  // Styles a later page brings (route chunks) and a theme switch follow it there.
  const styles = new MutationObserver((records) => {
    for (const record of records) for (const node of Array.from(record.addedNodes)) copyStyle(node, doc);
  });
  styles.observe(document.head, { childList: true });
  const theme = new MutationObserver(() => copyTheme(doc));
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
  return () => {
    styles.disconnect();
    theme.disconnect();
  };
}

/**
 * Opens the pop-out, or brings back the open one. Must run inside a click
 * (the browser requires a user gesture): call it synchronously from the
 * handler, before any await. Resolves with the window, or null where it is
 * not supported or the browser refused.
 */
export function openPip(): Promise<Window | null> {
  if (current && !current.closed) {
    current.focus();
    return Promise.resolve(current);
  }
  if (opening) return opening;
  const pipApi = api();
  if (!pipApi) return Promise.resolve(null);
  let request: Promise<Window>;
  try {
    request = pipApi.requestWindow({ width: WIDTH, height: HEIGHT });
  } catch {
    return Promise.resolve(null);
  }
  opening = request
    .then((pip) => {
      cleanup = prepare(pip);
      pip.addEventListener("pagehide", () => {
        cleanup?.();
        cleanup = null;
        if (current === pip) emit(null);
      }, { once: true });
      emit(pip);
      return pip;
    })
    .catch((error: unknown) => {
      console.info("Pop-out window refused:", error instanceof Error ? error.message : error);
      return null;
    })
    .finally(() => { opening = null; });
  return opening;
}

export function closePip() {
  current?.close();
}

/** Grows the pop-out to at least `height` (for the wrap-up). Chrome may refuse without a click in it; the content scrolls then. */
export function growPip(height: number) {
  const pip = current;
  if (!pip || pip.closed || pip.innerHeight >= height) return;
  try {
    pip.resizeTo(Math.max(pip.outerWidth, WIDTH), height + (pip.outerHeight - pip.innerHeight));
  } catch {
    // Not allowed now; the window scrolls.
  }
}
