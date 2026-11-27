"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { RiCheckDoubleLine, RiDraggable, RiFilterOffLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { EmptyState } from "@/components/page/EmptyState";
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
  type PipelineStage,
} from "./CrmActionsClient";
import { ErrorState } from "./CrmLayout";
import { CATEGORY_LABELS, asList, asObject, categoryColor, crmFetch, errorMessage, type CrmCategory } from "./crm-utils";
import { moved, ordered, type BoardSettings } from "./pipelineBoardSettings";

/** Per (category, sub-stage) counts under the board's filters, from `/actions?groupCounts=true`. */
export type GroupCount = { categoryKey: string | null; subcategoryId: string | null; total: number };

export type StageBoardFilters = { category: string; channel: string; status: PipelineStage | "" };

/** Cards per column when a column loads more. */
const COLUMN_PAGE = 20;

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

function actionColumnKey(action: Action) {
  const subcategoryId = asObject(action.record).subcategoryId;
  return columnKey(actionCategory(action), subcategoryId ? String(subcategoryId) : null);
}

/**
 * Whether a card still belongs on the board. A card re-read after an edit
 * comes back unfiltered, so a lead moved to Not interested, or out of the
 * status being shown, leaves here instead of lingering.
 */
function matchesFilters(action: Action, filters: StageBoardFilters) {
  const category = actionCategory(action);
  if (filters.category === "potential" && category === "not_interested") return false;
  if (filters.category && filters.category !== "potential" && category !== filters.category) return false;
  if (filters.channel && actionChannel(action) !== filters.channel) return false;
  if (filters.status && String(action.stage ?? "") !== filters.status) return false;
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

function inScope(categoryKey: string, filters: Pick<StageBoardFilters, "category">) {
  if (filters.category === "potential") return categoryKey !== "not_interested";
  return !filters.category || filters.category === categoryKey;
}

/**
 * Every column the filters allow, in funnel order: categories as the CRM
 * settings order them (Unclassified last), each category's active sub-stages
 * by stage rank and position, then its "no sub-stage" column. `extra` adds
 * columns found in the data that the catalog lacks (an archived sub-stage).
 */
export function columnCatalog(categories: Data[], filters: Pick<StageBoardFilters, "category">, extra: Array<{ categoryKey: string; subcategoryId: string | null }> = []): ColumnDef[] {
  const entries = new Map<string, ReturnType<typeof describeColumn>>();
  const add = (categoryKey: string, subcategoryId: string | null) => {
    if (!inScope(categoryKey, filters)) return;
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

/**
 * The pipeline board with a column per sub-stage (Case Study, Meeting
 * Requested, …) instead of per status. One read loads each column's newest
 * leads (`perGroupLimit`), so a column with one lead shows it at once; a
 * column's "Load more" continues from its own count with a read narrowed to
 * it, which works because every read shares one order. Columns are arranged
 * by the board settings: hidden, reordered (drag a header), empty ones shown.
 */
/** Leads per column key, from the per-(category, sub-stage) counts. */
export function groupCountMap(counts: GroupCount[] | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of counts ?? []) {
    const key = columnKey(row.categoryKey, row.subcategoryId);
    map.set(key, (map.get(key) ?? 0) + row.total);
  }
  return map;
}

/** The board's columns in the person's order, hidden ones included: what the board and its Customize panel both list. */
export function arrangedColumns(categories: Data[], filters: Pick<StageBoardFilters, "category">, counts: GroupCount[] | null, order: readonly string[]): ColumnDef[] {
  const extra = (counts ?? []).map((row) => ({ categoryKey: row.categoryKey ?? "unclassified", subcategoryId: row.subcategoryId }));
  return ordered(columnCatalog(categories, filters, extra), order);
}

export function PipelineStageBoard({ query, actions, setActions, counts, catalog, loaded, loading, error, onRetry, categories, filters, filtered, onReset, onMutated, settings, updateSettings, onCustomize }: {
  query: string;
  actions: Action[];
  setActions: React.Dispatch<React.SetStateAction<Action[]>>;
  counts: GroupCount[] | null;
  /** From `arrangedColumns`. */
  catalog: ColumnDef[];
  loaded: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  categories: Data[];
  filters: StageBoardFilters;
  filtered: boolean;
  onReset: () => void;
  onMutated: () => void;
  settings: BoardSettings;
  updateSettings: (change: (old: BoardSettings) => BoardSettings) => void;
  onCustomize: () => void;
}) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [loadingColumn, setLoadingColumn] = useState("");
  const [columnError, setColumnError] = useState("");
  const [dragging, setDragging] = useState("");
  const [dropTarget, setDropTarget] = useState("");
  const { busyIds, notice, setNotice, mutateRow, classify, refreshRow } = useRowMutations({ onActionsChange: setActions, pipeline: true, onMutated });
  useSyncRecordChanges(actions, refreshRow, onMutated);
  const hiddenFields = useMemo(() => new Set(settings.hiddenFields), [settings.hiddenFields]);

  const visible = useMemo(() => actions.filter((action) => matchesFilters(action, filters)), [actions, filters]);
  const byColumn = useMemo(() => {
    const map = new Map<string, Action[]>();
    for (const action of visible) {
      const key = actionColumnKey(action);
      map.set(key, [...(map.get(key) ?? []), action]);
    }
    return map;
  }, [visible]);
  const countByKey = useMemo(() => groupCountMap(counts), [counts]);
  const hidden = useMemo(() => new Set(settings.hiddenColumns), [settings.hiddenColumns]);
  const columns: Column[] = catalog
    .filter((column) => !hidden.has(column.key))
    .map((column) => ({ ...column, count: counts ? countByKey.get(column.key) ?? 0 : null }))
    .filter((column) => settings.showEmptyColumns || column.count === null || column.count > 0 || byColumn.has(column.key));
  const hiddenWithLeads = catalog.filter((column) => hidden.has(column.key) && (countByKey.get(column.key) ?? 0) > 0);
  const hiddenLeads = hiddenWithLeads.reduce((sum, column) => sum + (countByKey.get(column.key) ?? 0), 0);

  const moveColumn = (from: string, to: string) => {
    if (!from || from === to) return;
    updateSettings((old) => ({ ...old, columnOrder: moved(catalog.map((column) => column.key), from, to) }));
  };

  const loadColumn = useCallback(async (column: Column, offset: number) => {
    setLoadingColumn(column.key);
    setColumnError("");
    try {
      const params = new URLSearchParams(query);
      params.delete("groupCounts");
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

  if (!loaded && loading) {
    return <div className="mt-4 flex gap-4 overflow-hidden">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-80 w-[min(20rem,85vw)] shrink-0 animate-pulse rounded-2xl bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200" />)}</div>;
  }
  if (error && !actions.length) return <div className="mt-4"><ErrorState message={error} onRetry={onRetry} /></div>;

  const hiddenNote = hiddenWithLeads.length > 0 && <p className="mt-3 text-paragraph-xs text-text-sub-600">
    {hiddenWithLeads.length === 1 ? `“${hiddenWithLeads[0].title}” is hidden` : `${hiddenWithLeads.length} columns are hidden`} ({hiddenLeads.toLocaleString()} {hiddenLeads === 1 ? "lead" : "leads"}).{" "}
    <button type="button" className="text-label-xs text-primary-base hover:underline" onClick={onCustomize}>Customize</button>
  </p>;

  if (!columns.length) {
    return <>
      {hiddenNote}
      <Frame className="mt-4"><FramePanel className="p-0 sm:p-0">
        {filtered
          ? <EmptyState icon={RiFilterOffLine} title="No leads match these filters" description="Try another category, channel or status." action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={onReset}>Reset filters</Button.Root>} />
          : <EmptyState icon={RiCheckDoubleLine} title="No open leads" description="Anyone who replies will show up here until their record is closed." />}
      </FramePanel></Frame>
    </>;
  }

  return <>
    {hiddenNote}
    <NoticeBar notice={notice ?? (columnError ? { tone: "error", text: columnError } : null)} onDismiss={() => { setNotice(null); setColumnError(""); }} className="mt-3 rounded-lg" />
    {/* As many columns as there are sub-stages, so the board scrolls sideways; each column scrolls on its own. */}
    <div className={cn("-mx-4 mt-4 flex snap-x items-start gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0", loading && "pointer-events-none opacity-60")} aria-busy={loading || undefined}>
      {columns.map((column) => {
        const cards = byColumn.get(column.key) ?? [];
        const hasMore = column.count !== null && cards.length < column.count;
        const dot = categoryColor(column.categoryKey === "unclassified" ? null : column.categoryKey).color;
        return <Frame
          key={column.key}
          className={cn("w-[min(20rem,85vw)] shrink-0 snap-start transition", dragging === column.key && "opacity-50", dropTarget === column.key && dragging !== column.key && "ring-2 ring-primary-base")}
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
          {!cards.length && !hasMore
            ? <FramePanel className="p-0 sm:p-0"><EmptyState compact icon={RiCheckDoubleLine} title="No leads here" description={filtered ? "None at this sub-stage fits the filters." : "No open lead is at this sub-stage."} /></FramePanel>
            : <div className="space-y-2 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto lg:overscroll-contain">
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
              {hasMore && <Button.Root variant="neutral" mode="ghost" size="small" className="w-full" onClick={() => void loadColumn(column, cards.length)} disabled={loadingColumn === column.key}>
                {loadingColumn === column.key ? "Loading…" : cards.length ? "Load more" : `Load ${Math.min(COLUMN_PAGE, column.count ?? 0)} leads`}
              </Button.Root>}
            </div>}
        </Frame>;
      })}
    </div>
  </>;
}
