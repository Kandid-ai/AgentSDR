"use client";

import { useEffect, useState } from "react";

/**
 * How the Funnel page and the sidebar keep each other current. The page
 * holds the views (useFunnelViews); the sidebar lists them under Funnel.
 * They meet through window events rather than the URL, because the page
 * keeps `?view=` with history.replaceState, which Next's router does not see.
 */

const OPEN = "agentsdr:funnel-view-open";
const CHANGED = "agentsdr:funnel-views-changed";
const SELECT = "agentsdr:funnel-view-select";
export const LAST_VIEW_KEY = "agentsdr.funnel.view";

/** The page now shows this view. */
export function announceOpenView(id: string) {
  window.dispatchEvent(new CustomEvent(OPEN, { detail: id }));
}

/** A view was created, renamed or deleted. */
export function announceViewsChanged() {
  window.dispatchEvent(new Event(CHANGED));
}

/** The sidebar asks an open Funnel page to switch view. */
export function requestOpenView(id: string) {
  window.dispatchEvent(new CustomEvent(SELECT, { detail: id }));
}

export function onViewRequested(handler: (id: string) => void) {
  const listener = (event: Event) => { const id = (event as CustomEvent<string>).detail; if (id) handler(id); };
  window.addEventListener(SELECT, listener);
  return () => window.removeEventListener(SELECT, listener);
}

type ViewItem = { id: string; name: string };

/**
 * The sidebar's copy: the organization's views (names only) and the one last
 * opened. Read once, again whenever the page says the list changed.
 */
export function useFunnelViewList(enabled: boolean) {
  const [views, setViews] = useState<ViewItem[] | null>(null);
  const [openId, setOpenId] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      fetch("/api/crm/views", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { views?: Array<{ id?: unknown; name?: unknown }> } | null) => {
          if (cancelled || !body?.views) return;
          setViews(body.views.filter((view) => typeof view.id === "string").map((view) => ({ id: String(view.id), name: String(view.name ?? "Untitled") })));
        })
        .catch(() => undefined);
    };
    load();
    const onOpen = (event: Event) => setOpenId((event as CustomEvent<string>).detail ?? "");
    window.addEventListener(CHANGED, load);
    window.addEventListener(OPEN, onOpen);
    const frame = window.requestAnimationFrame(() => {
      try { setOpenId(window.localStorage.getItem(LAST_VIEW_KEY) ?? ""); } catch { /* storage unavailable */ }
    });
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGED, load);
      window.removeEventListener(OPEN, onOpen);
      window.cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return { views, openId };
}
