"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_VIEW_CONFIG, normalizeFilters, normalizeViewConfig, type BoardFilters, type BoardView, type BoardViewConfig } from "@/lib/crm/boardViews";
import { asList, asObject, crmFetch, errorMessage } from "./crm-utils";
import { LAST_VIEW_KEY, announceOpenView, announceViewsChanged, onViewRequested } from "./funnelViewEvents";

/** How long after the last change a view is written. */
const SAVE_DELAY_MS = 700;

export type SaveState = "idle" | "saving" | "saved" | "error";

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

/** A view's config as stored: search is the viewer's own and never saved. */
function storable(config: BoardViewConfig): BoardViewConfig {
  return { ...config, filters: { ...config.filters, search: "" } };
}

function sameFilters(a: BoardFilters, b: BoardFilters) {
  return JSON.stringify(normalizeFilters({ ...a, search: "" })) === JSON.stringify(normalizeFilters({ ...b, search: "" }));
}

/**
 * The organization's saved Funnel views and the one being looked at.
 *
 * Two kinds of change. How the view looks (layout, grouping, column order,
 * card fields) is the view's at once: written a moment later (debounced,
 * the newest wins) with a quiet saving/saved state. What it shows (the
 * filters, including which stages are columns) is the viewer's own until
 * they choose "Save as default": until then it is a draft for this page,
 * kept per view while the page is open, and `filtersChanged` says so.
 */
export function useFunnelViews() {
  const [views, setViews] = useState<BoardView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [currentId, setCurrentId] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [filterDrafts, setFilterDrafts] = useState<Record<string, BoardFilters>>({});
  const viewsRef = useRef<BoardView[]>([]);
  useEffect(() => { viewsRef.current = views; }, [views]);
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());

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
  useEffect(() => onViewRequested((id) => { if (viewsRef.current.some((view) => view.id === id)) setCurrentId(id); }), []);

  const write = useCallback(async (id: string) => {
    pending.current.delete(id);
    const view = viewsRef.current.find((item) => item.id === id);
    if (!view) return;
    setSaveState("saving");
    try {
      await crmFetch(`/views/${id}`, { method: "PATCH", body: JSON.stringify({ config: storable(view.config) }) });
      // A later change has its own write coming; only the last one says "Saved".
      if (!pending.current.size) setSaveState("saved");
    } catch (cause) {
      setSaveState("error");
      setError(errorMessage(cause));
    }
  }, []);

  const flush = useCallback(() => {
    for (const [id, timer] of pending.current) { clearTimeout(timer); void write(id); }
  }, [write]);
  // Leaving the page writes what is still waiting.
  useEffect(() => () => flush(), [flush]);

  const current = views.find((view) => view.id === currentId) ?? null;
  const draftFilters = current ? filterDrafts[current.id] : undefined;
  const config = current ? (draftFilters ? { ...current.config, filters: draftFilters } : current.config) : DEFAULT_VIEW_CONFIG;
  const filtersChanged = Boolean(current && draftFilters && !sameFilters(draftFilters, current.config.filters));

  /** Write the view's saved config `change` a moment from now. */
  const changeSaved = useCallback((id: string, change: (old: BoardViewConfig) => BoardViewConfig) => {
    setViews((old) => {
      const next = old.map((view) => view.id === id ? { ...view, config: storable(normalizeViewConfig(change(view.config))) } : view);
      viewsRef.current = next;
      return next;
    });
    const timer = pending.current.get(id);
    if (timer) clearTimeout(timer);
    pending.current.set(id, setTimeout(() => void write(id), SAVE_DELAY_MS));
    setSaveState("saving");
    setError("");
  }, [write]);

  /**
   * Change the page. The filters part becomes (or stops being) a draft;
   * everything else is saved to the view.
   */
  const setConfig = useCallback((change: (old: BoardViewConfig) => BoardViewConfig) => {
    const view = viewsRef.current.find((item) => item.id === currentId);
    if (!view) return;
    const effective = { ...view.config, filters: filterDrafts[view.id] ?? view.config.filters };
    const next = normalizeViewConfig(change(effective));
    const filters = { ...next.filters, search: "" };
    setFilterDrafts((old) => {
      const rest = { ...old };
      if (sameFilters(filters, view.config.filters)) delete rest[view.id]; else rest[view.id] = filters;
      return rest;
    });
    const { filters: _filters, ...look } = next;
    void _filters;
    const { filters: _saved, ...savedLook } = view.config;
    void _saved;
    if (JSON.stringify(look) !== JSON.stringify(savedLook)) changeSaved(view.id, (old) => ({ ...old, ...look }));
  }, [currentId, filterDrafts, changeSaved]);

  /** The filters on the page become the view's own, for everyone. */
  const saveFiltersAsDefault = useCallback(() => {
    const id = currentId;
    const draft = filterDrafts[id];
    if (!id || !draft) return;
    changeSaved(id, (old) => ({ ...old, filters: draft }));
    setFilterDrafts((old) => { const rest = { ...old }; delete rest[id]; return rest; });
  }, [currentId, filterDrafts, changeSaved]);

  /** Back to the view's saved filters. */
  const resetFilters = useCallback(() => {
    setFilterDrafts((old) => { const rest = { ...old }; delete rest[currentId]; return rest; });
  }, [currentId]);

  const select = useCallback((id: string) => { flush(); setCurrentId(id); }, [flush]);

  const run = useCallback(async <T,>(work: () => Promise<T>): Promise<T | null> => {
    setError("");
    try { return await work(); } catch (cause) { setError(errorMessage(cause)); return null; }
  }, []);

  /** A new view (from `from`, else an empty board), which opens at once. A duplicate takes the filters on the page. */
  const create = useCallback((name: string, from: BoardViewConfig = DEFAULT_VIEW_CONFIG) => run(async () => {
    flush();
    const view = asView(asObject(await crmFetch("/views", { method: "POST", body: JSON.stringify({ name, config: storable(from) }) })).view);
    setViews((old) => [...old, view]);
    setCurrentId(view.id);
    announceViewsChanged();
    return view;
  }), [run, flush]);

  const rename = useCallback((id: string, name: string) => run(async () => {
    const view = asView(asObject(await crmFetch(`/views/${id}`, { method: "PATCH", body: JSON.stringify({ name }) })).view);
    // Keep the config held here: a write may still be on its way.
    setViews((old) => old.map((item) => item.id === id ? { ...item, name: view.name } : item));
    announceViewsChanged();
    return view;
  }), [run]);

  const remove = useCallback((id: string) => run(async () => {
    const timer = pending.current.get(id);
    if (timer) { clearTimeout(timer); pending.current.delete(id); }
    await crmFetch(`/views/${id}`, { method: "DELETE" });
    const rest = viewsRef.current.filter((view) => view.id !== id);
    setViews(rest);
    if (id === currentId) setCurrentId(rest[0]?.id ?? "");
    if (!rest.length) await load();
    announceViewsChanged();
    return true;
  }), [run, currentId, load]);

  return { views, loaded, error, current, config, setConfig, filtersChanged, saveFiltersAsDefault, resetFilters, saveState, retrySave: () => { if (currentId) void write(currentId); }, select, create, rename, remove, reload: load };
}
