"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RiCheckDoubleLine, RiDraggable, RiFilterOffLine, RiLoader4Line } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { EmptyState } from "@/components/page/EmptyState";
import type { BoardFilters, BoardViewConfig } from "@/lib/crm/boardViews";
import { cn } from "@/utils/cn";
import {
  ActionCard,
  NoticeBar,
  actionCategory,
  actionChannel,
  actionId,
  useRowMutations,
  useSyncRecordChanges,
  type Action,
  type Data,
} from "./CrmActionsClient";
import { ErrorState } from "./CrmLayout";
import { CATEGORY_LABELS, asList, asObject, categoryColor, crmFetch, errorMessage, type CrmCategory } from "./crm-utils";

/** Per (category, sub-stage) counts, from `/actions?groupCounts=true` (under every filter but the stage one). */
export type GroupCount = { categoryKey: string | null; subcategoryId: string | null; total: number };

/** Cards per column when a column loads more. */
const COLUMN_PAGE = 20;

/** The element whose scrolling moves `node` (the app's main pane), or null for the window. */
function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if ((overflowY === "auto" || overflowY === "scroll") && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return null;
}

/**
 * Board columns end at the bottom of the screen, so the page never scrolls
 * and only the columns do: measures where the board starts (inside the
 * pane that scrolls, whatever its scroll position) and exposes the height
 * left below it as `--column-max` on the board. Desktop only; below lg the
 * columns stack and the page scrolls as usual. Re-measured on resize and
 * whenever the content above it changes height (the filter bar wrapping).
 */
export function useBoardHeight<T extends HTMLElement>() {
  // A callback ref: the board appears only once its leads have loaded.
  const [node, setNode] = useState<T | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!node) return;
    const scroller = scrollParent(node);
    const measure = () => {
      const paneTop = scroller ? scroller.getBoundingClientRect().top : 0;
      const scrolled = scroller ? scroller.scrollTop : window.scrollY;
      const top = node.getBoundingClientRect().top - paneTop + scrolled;
      const viewport = scroller ? scroller.clientHeight : window.innerHeight;
      // The page's own bottom padding stays visible below the board.
      setHeight(Math.max(320, Math.floor(viewport - top - 36)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (node.parentElement) observer.observe(node.parentElement);
    if (scroller) observer.observe(scroller);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [node]);
  const style = height ? ({ "--column-max": `${height}px` } as React.CSSProperties) : undefined;
  return { attach: setNode, style };
}

/** A column that fills the board's height and scrolls its cards inside (desktop). */
export const COLUMN_FRAME = "lg:max-h-[var(--column-max,calc(100dvh-12rem))]";
export const COLUMN_CARDS = "lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-y-contain";

/** Placeholder cards for a column whose leads are on their way. */
export function ColumnSkeleton({ cards = 3 }: { cards?: number }) {
  return <div className="space-y-2" aria-hidden="true">
    {Array.from({ length: cards }, (_, i) => <div key={i} className="space-y-3 rounded-xl bg-bg-white-0 p-3.5 ring-1 ring-inset ring-stroke-soft-200">
      <div className="flex items-center gap-3"><div className="size-8 animate-pulse rounded-full bg-bg-soft-200" /><div className="h-3.5 w-32 animate-pulse rounded bg-bg-soft-200" /></div>
      <div className="h-5 w-28 animate-pulse rounded-md bg-bg-soft-200" />
      <div className="space-y-1.5"><div className="h-3 w-full animate-pulse rounded bg-bg-soft-200" /><div className="h-3 w-4/5 animate-pulse rounded bg-bg-soft-200" /></div>
    </div>)}
  </div>;
}

/**
 * The end of a column: reaching it loads the next cards (infinite scroll).
 * Inside a column that scrolls on its own, the sentinel only counts as seen
 * once it is scrolled into the column's view. The button is there for
 * keyboards and browsers without IntersectionObserver.
 */
export function ColumnLoadMore({ onLoad, busy }: { onLoad: () => void; busy: boolean }) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || busy || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) onLoad(); }, { rootMargin: "200px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onLoad, busy]);
  return <div ref={sentinel} className="flex h-10 items-center justify-center text-paragraph-xs text-text-soft-400">
    {busy
      ? <span className="inline-flex items-center gap-1.5"><RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />Loading more…</span>
      : <button type="button" onClick={onLoad} className="rounded-md px-2 py-1 text-label-xs text-text-sub-600 hover:bg-bg-weak-50 hover:text-text-strong-950">Load more</button>}
  </div>;
}

/** A column the board can show: a sub-stage, or a category's leads with no sub-stage. */
export type ColumnDef = {
  key: string;
  categoryKey: string;
  subcategoryId: string | null;
  title: string;
  detail: string;
};
type Column = ColumnDef & { count: number | null };

/** A sub-stage's id, or `none:<category>` for a record with no sub-stage (`none:unclassified` when it has no category either). */
function columnKey(categoryKey: string | null, subcategoryId: string | null) {
  return subcategoryId ?? `none:${categoryKey ?? "unclassified"}`;
}

export function actionColumnKey(action: Action) {
  const subcategoryId = asObject(action.record).subcategoryId;
  return columnKey(actionCategory(action) === "unclassified" ? null : actionCategory(action), subcategoryId ? String(subcategoryId) : null);
}

const DAY = 86_400_000;
const LAST_CONTACT_TEST: Record<BoardFilters["lastContact"], (age: number | null) => boolean> = {
  any: () => true,
  "1d": (age) => age !== null && age <= DAY,
  "7d": (age) => age !== null && age <= 7 * DAY,
  "30d": (age) => age !== null && age <= 30 * DAY,
  over_7d: (age) => age !== null && age > 7 * DAY,
  over_30d: (age) => age !== null && age > 30 * DAY,
};

/**
 * Whether a card still belongs on the board. A card re-read after an edit
 * comes back unfiltered, so a lead moved out of the view's stages or
 * statuses leaves here instead of lingering. (Search is the server's alone.)
 */
export function matchesFilters(action: Action, filters: BoardFilters, now = Date.now()) {
  if (filters.stages.length && !filters.stages.includes(actionColumnKey(action))) return false;
  if (filters.statuses.length && !filters.statuses.includes(String(action.stage ?? "") as BoardFilters["statuses"][number])) return false;
  if (filters.channels.length && !filters.channels.includes(actionChannel(action) as BoardFilters["channels"][number])) return false;
  if (filters.lastContact !== "any") {
    const record = asObject(action.record);
    const times = [record.lastInboundAt, record.lastOutboundAt].filter(Boolean).map((value) => new Date(String(value)).getTime());
    if (!LAST_CONTACT_TEST[filters.lastContact](times.length ? now - Math.max(...times) : null)) return false;
  }
  return true;
}

function describeColumn(categories: Data[], categoryKey: string, subcategoryId: string | null): ColumnDef & { rank: [number, number, number, number, string] } {
  const categoryIndex = categoryKey === "unclassified" ? 999 : Math.max(0, categories.findIndex((category) => String(category.key) === categoryKey));
  const categoryLabel = CATEGORY_LABELS[categoryKey as CrmCategory] ?? "Unclassified";
  const key = columnKey(categoryKey === "unclassified" ? null : categoryKey, subcategoryId);
  if (!subcategoryId) {
    return categoryKey === "unclassified"
      ? { key, categoryKey, subcategoryId, title: "Unclassified", detail: "Not classified yet", rank: [categoryIndex, 1, 0, 0, ""] }
      : { key, categoryKey, subcategoryId, title: categoryLabel, detail: "No sub-stage yet", rank: [categoryIndex, 1, 0, 0, ""] };
  }
  const sub = categories.flatMap((category) => asList<Data>(category.subcategories)).find((entry) => String(entry.id) === subcategoryId);
  const name = sub ? String(sub.name) : "Sub-stage";
  const stageRank = sub?.stageRank == null ? Number.MAX_SAFE_INTEGER : Number(sub.stageRank);
  return { key, categoryKey, subcategoryId, title: name, detail: sub?.active === false ? `${categoryLabel} · archived` : categoryLabel, rank: [categoryIndex, 0, stageRank, Number(sub?.sortOrder ?? 0), name] };
}

/**
 * Every stage there is, in funnel order: categories as the CRM settings
 * order them (Unclassified last), each category's active sub-stages by stage
 * rank and position, then its "no sub-stage" stage. `extra` adds stages
 * found in the data that the list lacks (an archived sub-stage).
 */
export function stageCatalog(categories: Data[], extra: Array<{ categoryKey: string; subcategoryId: string | null }> = []): ColumnDef[] {
  const entries = new Map<string, ReturnType<typeof describeColumn>>();
  const add = (categoryKey: string, subcategoryId: string | null) => {
    const column = describeColumn(categories, categoryKey, subcategoryId);
    if (!entries.has(column.key)) entries.set(column.key, column);
  };
  for (const category of categories) {
    const key = String(category.key);
    for (const sub of asList<Data>(category.subcategories)) if (sub.active !== false) add(key, String(sub.id));
    add(key, null);
  }
  add("unclassified", null);
  for (const item of extra) add(item.categoryKey, item.subcategoryId);
  return [...entries.values()].sort((a, b) => {
    for (let index = 0; index < 4; index += 1) {
      const diff = (a.rank[index] as number) - (b.rank[index] as number);
      if (diff) return diff;
    }
    return a.rank[4].localeCompare(b.rank[4]);
  }).map(({ key, categoryKey, subcategoryId, title, detail }) => ({ key, categoryKey, subcategoryId, title, detail }));
}

/** Leads per column key, from the per-(category, sub-stage) counts. */
export function groupCountMap(counts: GroupCount[] | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of counts ?? []) {
    const key = columnKey(row.categoryKey, row.subcategoryId);
    map.set(key, (map.get(key) ?? 0) + row.total);
  }
  return map;
}

/** `items` in the saved order; any the order does not name keep their own relative order after it. */
export function ordered<T extends { key: string }>(items: readonly T[], order: readonly string[]): T[] {
  const position = new Map(order.map((key, index) => [key, index]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (position.get(a.item.key) ?? order.length + a.index) - (position.get(b.item.key) ?? order.length + b.index))
    .map(({ item }) => item);
}

/** `keys` reordered so `from` sits where `to` was. */
export function moved(keys: readonly string[], from: string, to: string): string[] {
  const fromIndex = keys.indexOf(from);
  const toIndex = keys.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return [...keys];
  const next = keys.filter((key) => key !== from);
  next.splice(toIndex, 0, from);
  return next;
}

/**
 * The pipeline board with a column per stage (Case Study, Meeting
 * Requested, …): the view's stages, or every stage when it names none. One
 * read loads each column's newest leads (`perGroupLimit`), so a column with
 * one lead shows it at once; a column's "Load more" continues from its own
 * count with a read narrowed to it, which works because every read shares
 * one order. Drag a header to reorder.
 */
export function PipelineStageBoard({ query, actions, setActions, columns: arranged, countByKey, loading, error, onRetry, categories, config, onConfigChange, filtered, onReset, onMutated }: {
  query: string;
  actions: Action[];
  setActions: React.Dispatch<React.SetStateAction<Action[]>>;
  /** The view's stages in its order (every stage when it names none). */
  columns: ColumnDef[];
  countByKey: ReadonlyMap<string, number> | null;
  loaded: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  categories: Data[];
  config: BoardViewConfig;
  onConfigChange: (change: (old: BoardViewConfig) => BoardViewConfig) => void;
  filtered: boolean;
  onReset: () => void;
  onMutated: () => void;
}) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [loadingColumn, setLoadingColumn] = useState("");
  const [columnError, setColumnError] = useState("");
  const [dragging, setDragging] = useState("");
  const [dropTarget, setDropTarget] = useState("");
  const { busyIds, notice, setNotice, mutateRow, classify, refreshRow } = useRowMutations({ onActionsChange: setActions, pipeline: true, onMutated });
  const { attach: attachBoard, style: boardStyle } = useBoardHeight<HTMLDivElement>();
  useSyncRecordChanges(actions, refreshRow, onMutated);
  const hiddenFields = useMemo(() => new Set(config.hiddenFields), [config.hiddenFields]);
  const { filters } = config;
  // Filters beyond the stages themselves (which only pick the columns).
  const narrowed = filters.statuses.length > 0 || filters.channels.length > 0 || Boolean(filters.search.trim()) || filters.lastContact !== "any";

  const visible = useMemo(() => actions.filter((action) => matchesFilters(action, filters)), [actions, filters]);
  const byColumn = useMemo(() => {
    const map = new Map<string, Action[]>();
    for (const action of visible) {
      const key = actionColumnKey(action);
      map.set(key, [...(map.get(key) ?? []), action]);
    }
    return map;
  }, [visible]);
  // A view naming its stages shows each of them; one showing every stage
  // shows the ones with leads, unless empty columns are switched on.
  const columns: Column[] = arranged
    .map((column) => ({ ...column, count: countByKey ? countByKey.get(column.key) ?? 0 : null }))
    .filter((column) => filters.stages.length > 0 || config.showEmptyColumns || column.count === null || column.count > 0 || byColumn.has(column.key));

  const moveColumn = (from: string, to: string) => {
    if (!from || from === to) return;
    onConfigChange((old) => ({ ...old, columnOrder: moved(arranged.map((column) => column.key), from, to) }));
  };

  const loadColumn = useCallback(async (column: Column, offset: number) => {
    setLoadingColumn(column.key);
    setColumnError("");
    try {
      const params = new URLSearchParams(query);
      params.delete("perGroupLimit");
      params.set("categoryKey", column.categoryKey);
      params.set("subcategoryId", column.subcategoryId ?? "none");
      params.set("limit", String(COLUMN_PAGE));
      params.set("offset", String(offset));
      const page = asList<Action>(await crmFetch(`/actions?${params}`), ["actions"]);
      setActions((old) => {
        const seen = new Set(old.map(actionId));
        return [...old, ...page.filter((item) => !seen.has(actionId(item)))];
      });
    } catch (cause) { setColumnError(errorMessage(cause)); } finally { setLoadingColumn(""); }
  }, [query, setActions]);

  // While the filters' first read is on its way, every column shows
  // placeholder cards rather than the previous filter's leads (or an empty
  // "no matches" that is not true yet).
  if (loading && !columns.length) {
    return <div className="mt-4 flex gap-4 overflow-hidden">{Array.from({ length: 4 }, (_, i) => <div key={i} className="w-[min(20rem,85vw)] shrink-0 rounded-2xl bg-bg-weak-50 p-1 ring-1 ring-inset ring-stroke-soft-200"><div className="h-14" /><ColumnSkeleton /></div>)}</div>;
  }
  if (error && !actions.length && !loading) return <div className="mt-4"><ErrorState message={error} onRetry={onRetry} /></div>;

  if (!columns.length) {
    return <Frame className="mt-4"><FramePanel className="p-0 sm:p-0">
      {filtered
        ? <EmptyState icon={RiFilterOffLine} title="No leads match these filters" description="Try other stages, statuses or channels." action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={onReset}>Clear filters</Button.Root>} />
        : <EmptyState icon={RiCheckDoubleLine} title="No open leads" description="Anyone who replies will show up here until their record is closed." />}
    </FramePanel></Frame>;
  }

  return <>
    <NoticeBar notice={notice ?? (columnError ? { tone: "error", text: columnError } : null)} onDismiss={() => { setNotice(null); setColumnError(""); }} className="mt-3 rounded-lg" />
    {/* As many columns as there are stages, so the board scrolls sideways; each column scrolls on its own. */}
    <div ref={attachBoard} style={boardStyle} className="-mx-4 mt-4 flex snap-x items-start gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0" aria-busy={loading || undefined}>
      {columns.map((column) => {
        const cards = byColumn.get(column.key) ?? [];
        const hasMore = column.count !== null && cards.length < column.count;
        const dot = categoryColor(column.categoryKey === "unclassified" ? null : column.categoryKey).color;
        return <Frame
          key={column.key}
          className={cn("w-[min(20rem,85vw)] shrink-0 snap-start transition", COLUMN_FRAME, dragging === column.key && "opacity-50", dropTarget === column.key && dragging !== column.key && "ring-2 ring-primary-base")}
          aria-labelledby={`column-${column.key}`}
          onDragOver={(event) => { if (!dragging) return; event.preventDefault(); setDropTarget(column.key); }}
          onDragLeave={() => setDropTarget((current) => current === column.key ? "" : current)}
          onDrop={(event) => { event.preventDefault(); moveColumn(dragging, column.key); setDragging(""); setDropTarget(""); }}
        >
          <header
            draggable
            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", column.key); setDragging(column.key); }}
            onDragEnd={() => { setDragging(""); setDropTarget(""); }}
            className="group/header flex cursor-grab items-center gap-3 px-3 pb-3 pt-2.5 active:cursor-grabbing"
            title="Drag to reorder"
          >
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${dot} 16%, transparent)` }}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: dot }} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={`column-${column.key}`} className="truncate text-label-md text-text-strong-950" title={column.title}>{column.title}</h2>
              <p className="truncate text-paragraph-xs text-text-sub-600">{column.detail}</p>
            </div>
            <RiDraggable className="size-4 shrink-0 text-text-soft-400 opacity-0 transition group-hover/header:opacity-100" aria-hidden="true" />
            <span className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded-lg bg-bg-white-0 px-2 text-label-sm tabular-nums text-text-strong-950 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200">{column.count === null ? "—" : column.count.toLocaleString()}</span>
          </header>
          {loading
            ? <ColumnSkeleton />
            : !cards.length && !hasMore
            ? <FramePanel className="p-0 sm:p-0"><EmptyState compact icon={RiCheckDoubleLine} title="No leads here" description={narrowed ? "None at this stage fits the filters." : "No open lead is at this stage."} /></FramePanel>
            : <div className={cn("space-y-2", COLUMN_CARDS)}>
              {cards.map((action) => {
                const id = actionId(action);
                return <ActionCard
                  key={id}
                  action={action}
                  categories={categories}
                  now={now}
                  busy={busyIds.has(id)}
                  onOpen={() => router.push(`/crm/records/${id}`)}
                  onMutate={(path, body, method, success, onError) => mutateRow(id, path, body, method, success, onError)}
                  onClassify={(choice) => classify(action, choice)}
                  hiddenFields={hiddenFields}
                  pipeline
                />;
              })}
              {hasMore && <ColumnLoadMore onLoad={() => void loadColumn(column, cards.length)} busy={loadingColumn === column.key} />}
            </div>}
        </Frame>;
      })}
    </div>
  </>;
}
