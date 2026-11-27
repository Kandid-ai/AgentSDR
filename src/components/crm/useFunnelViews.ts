"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_VIEW_CONFIG, normalizeViewConfig, sameViewConfig, type BoardView, type BoardViewConfig } from "@/lib/crm/boardViews";
import { asList, asObject, crmFetch, errorMessage } from "./crm-utils";
import { LAST_VIEW_KEY, announceOpenView, announceViewsChanged, onViewRequested } from "./funnelViewEvents";

function asView(value: unknown): BoardView {
  const raw = asObject(value);
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Untitled"),
    position: Number(raw.position ?? 0),
    config: normalizeViewConfig(raw.config),
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function rememberView(id: string) {
  try { window.localStorage.setItem(LAST_VIEW_KEY, id); } catch { /* storage unavailable */ }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("view", id);
    window.history.replaceState(window.history.state, "", url);
  } catch { /* not in a browser */ }
}

/**
 * The organization's saved Funnel views and the one being looked at. Every
 * change to the page edits a draft of the current view; the saved view only
 * changes on Save. Drafts are kept per view while the page is open, so
 * switching away and back does not lose unsaved filters.
 */
export function useFunnelViews() {
  const [views, setViews] = useState<BoardView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [currentId, setCurrentId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, BoardViewConfig>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const list = asList(asObject(await crmFetch("/views")).views).map(asView).filter((view) => view.id);
      setViews(list);
      setCurrentId((current) => {
        if (current && list.some((view) => view.id === current)) return current;
        let wanted = "";
        try { wanted = new URLSearchParams(window.location.search).get("view") ?? window.localStorage.getItem(LAST_VIEW_KEY) ?? ""; } catch { /* storage unavailable */ }
        return list.find((view) => view.id === wanted)?.id ?? list[0]?.id ?? "";
      });
      setLoaded(true);
    } catch (cause) { setError(errorMessage(cause)); setLoaded(true); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (currentId) { rememberView(currentId); announceOpenView(currentId); } }, [currentId]);
  // A view picked in the sidebar while this page is open.
  useEffect(() => onViewRequested((id) => { if (views.some((view) => view.id === id)) setCurrentId(id); }), [views]);

  const current = views.find((view) => view.id === currentId) ?? null;
  const config = useMemo(() => (current ? drafts[current.id] ?? current.config : DEFAULT_VIEW_CONFIG), [current, drafts]);
  const dirty = Boolean(current && drafts[current.id] && !sameViewConfig(drafts[current.id], current.config));

  const setConfig = useCallback((change: (old: BoardViewConfig) => BoardViewConfig) => {
    if (!current) return;
    setDrafts((old) => ({ ...old, [current.id]: change(old[current.id] ?? current.config) }));
  }, [current]);

  const discard = useCallback(() => {
    if (!current) return;
    setDrafts((old) => { const next = { ...old }; delete next[current.id]; return next; });
  }, [current]);

  const replaceView = useCallback((view: BoardView) => setViews((old) => old.some((item) => item.id === view.id) ? old.map((item) => item.id === view.id ? view : item) : [...old, view]), []);

  const run = useCallback(async <T,>(work: () => Promise<T>): Promise<T | null> => {
    setSaving(true);
    setError("");
    try { return await work(); } catch (cause) { setError(errorMessage(cause)); return null; } finally { setSaving(false); }
  }, []);

  const save = useCallback(() => run(async () => {
    if (!current) return null;
    const view = asView(asObject(await crmFetch(`/views/${current.id}`, { method: "PATCH", body: JSON.stringify({ config }) })).view);
    replaceView(view);
    setDrafts((old) => { const next = { ...old }; delete next[view.id]; return next; });
    return view;
  }), [run, replaceView, current, config]);

  /** A new view from `from` (the current page by default), which becomes the current one. */
  const create = useCallback((name: string, from: BoardViewConfig = config) => run(async () => {
    const view = asView(asObject(await crmFetch("/views", { method: "POST", body: JSON.stringify({ name, config: from }) })).view);
    replaceView(view);
    announceViewsChanged();
    // The view it was made from goes back to how it was saved.
    if (current) setDrafts((old) => { const next = { ...old }; delete next[current.id]; return next; });
    setCurrentId(view.id);
    return view;
  }), [run, replaceView, config, current]);

  const rename = useCallback((id: string, name: string) => run(async () => {
    const view = asView(asObject(await crmFetch(`/views/${id}`, { method: "PATCH", body: JSON.stringify({ name }) })).view);
    replaceView(view);
    announceViewsChanged();
    return view;
  }), [run, replaceView]);

  const remove = useCallback((id: string) => run(async () => {
    await crmFetch(`/views/${id}`, { method: "DELETE" });
    setDrafts((old) => { const next = { ...old }; delete next[id]; return next; });
    const rest = views.filter((view) => view.id !== id);
    setViews(rest);
    if (id === currentId) setCurrentId(rest[0]?.id ?? "");
    if (!rest.length) await load();
    announceViewsChanged();
    return true;
  }), [run, views, currentId, load]);

  return { views, loaded, error, setError, current, config, setConfig, dirty, saving, select: setCurrentId, save, create, rename, remove, discard, reload: load };
}
