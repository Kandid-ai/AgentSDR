"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { RiCheckDoubleLine, RiFilterOffLine } from "@remixicon/react";
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

/** Per (category, sub-stage) counts under the board's filters, from `/actions?groupCounts=true`. */
export type GroupCount = { categoryKey: string | null; subcategoryId: string | null; total: number };

export type StageBoardFilters = { category: string; channel: string; status: PipelineStage | "" };

/** Cards per column when a column loads more. */
const COLUMN_PAGE = 20;

type Column = {
  key: string;
  categoryKey: string;
  subcategoryId: string | null;
  title: string;
  detail: string;
  count: number | null;
  sort: [number, number, number, number, string];
};

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

/**
 * The columns, in funnel order: categories as the CRM settings order them
 * (Unclassified last), then each category's sub-stages by stage rank and
 * position, and its "no sub-stage" column after them. A column shows when it
 * has leads — or, with one category filtered, for every active sub-stage of
 * it, so the whole funnel is visible even where it is empty.
 */
function buildColumns(categories: Data[], counts: GroupCount[] | null, actions: Action[], filters: StageBoardFilters): Column[] {
  const categoryOrder = categories.map((category) => String(category.key));
  const subcategories = new Map(categories.flatMap((category) => asList<Data>(category.subcategories)).map((sub) => [String(sub.id), sub]));
  const countByKey = new Map<string, number>();
  for (const row of counts ?? []) {
    const key = columnKey(row.categoryKey, row.subcategoryId);
    countByKey.set(key, (countByKey.get(key) ?? 0) + row.total);
  }
  const keys = new Map<string, { categoryKey: string; subcategoryId: string | null }>();
  for (const row of counts ?? []) if (row.total > 0) keys.set(columnKey(row.categoryKey, row.subcategoryId), { categoryKey: row.categoryKey ?? "unclassified", subcategoryId: row.subcategoryId });
  for (const action of actions) {
    const subcategoryId = asObject(action.record).subcategoryId;
    keys.set(actionColumnKey(action), { categoryKey: actionCategory(action), subcategoryId: subcategoryId ? String(subcategoryId) : null });
  }
  if (filters.category && filters.category !== "potential") {
    for (const sub of subcategories.values()) {
      if (String(sub.categoryKey) === filters.category && sub.active !== false) keys.set(String(sub.id), { categoryKey: filters.category, subcategoryId: String(sub.id) });
    }
  }

  const columns = [...keys.entries()].map(([key, { categoryKey, subcategoryId }]): Column => {
    const categoryIndex = categoryKey === "unclassified" ? 999 : Math.max(0, categoryOrder.indexOf(categoryKey));
    const categoryLabel = CATEGORY_LABELS[categoryKey as CrmCategory] ?? "Unclassified";
    const sub = subcategoryId ? subcategories.get(subcategoryId) : undefined;
    const count = counts ? countByKey.get(key) ?? 0 : null;
    if (!subcategoryId) {
      return categoryKey === "unclassified"
        ? { key, categoryKey, subcategoryId, title: "Unclassified", detail: "Not classified yet", count, sort: [categoryIndex, 1, 0, 0, ""] }
        : { key, categoryKey, subcategoryId, title: categoryLabel, detail: "No sub-stage yet", count, sort: [categoryIndex, 1, 0, 0, ""] };
    }
    const name = sub ? String(sub.name) : "Sub-stage";
    const rank = sub?.stageRank == null ? Number.MAX_SAFE_INTEGER : Number(sub.stageRank);
    return { key, categoryKey, subcategoryId, title: name, detail: sub?.active === false ? `${categoryLabel} · archived` : categoryLabel, count, sort: [categoryIndex, 0, rank, Number(sub?.sortOrder ?? 0), name] };
  });
  return columns.sort((a, b) => {
    for (let index = 0; index < 4; index += 1) {
      const diff = (a.sort[index] as number) - (b.sort[index] as number);
      if (diff) return diff;
    }
    return a.sort[4].localeCompare(b.sort[4]);
  });
}

/**
 * The pipeline board with a column per sub-stage (Case Study, Meeting
 * Requested, …) instead of per status. One read loads the most recent leads
 * across every column; because every read shares one order, that read holds
 * each column's newest leads, so a column's "Load more" continues from its
 * own count with a read narrowed to it.
 */
export function PipelineStageBoard({ query, actions, setActions, counts, loaded, loading, error, onRetry, categories, filters, filtered, onReset, onMutated }: {
  query: string;
  actions: Action[];
  setActions: React.Dispatch<React.SetStateAction<Action[]>>;
  counts: GroupCount[] | null;
  loaded: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  categories: Data[];
  filters: StageBoardFilters;
  filtered: boolean;
  onReset: () => void;
  onMutated: () => void;
}) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [loadingColumn, setLoadingColumn] = useState("");
  const [columnError, setColumnError] = useState("");
  const { busyIds, notice, setNotice, mutateRow, classify, refreshRow } = useRowMutations({ onActionsChange: setActions, pipeline: true, onMutated });
  useSyncRecordChanges(actions, refreshRow, onMutated);

  const visible = useMemo(() => actions.filter((action) => matchesFilters(action, filters)), [actions, filters]);
  const byColumn = useMemo(() => {
    const map = new Map<string, Action[]>();
    for (const action of visible) {
      const key = actionColumnKey(action);
      map.set(key, [...(map.get(key) ?? []), action]);
    }
    return map;
  }, [visible]);
  const columns = useMemo(() => buildColumns(categories, counts, visible, filters), [categories, counts, visible, filters]);

  const loadColumn = useCallback(async (column: Column, offset: number) => {
    setLoadingColumn(column.key);
    setColumnError("");
    try {
      const params = new URLSearchParams(query);
      params.delete("groupCounts");
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
  if (!columns.length) {
    return <Frame className="mt-4"><FramePanel className="p-0 sm:p-0">
      {filtered
        ? <EmptyState icon={RiFilterOffLine} title="No leads match these filters" description="Try another category, channel or status." action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={onReset}>Reset filters</Button.Root>} />
        : <EmptyState icon={RiCheckDoubleLine} title="No open leads" description="Anyone who replies will show up here until their record is closed." />}
    </FramePanel></Frame>;
  }

  return <>
    <NoticeBar notice={notice ?? (columnError ? { tone: "error", text: columnError } : null)} onDismiss={() => { setNotice(null); setColumnError(""); }} className="mt-3 rounded-lg" />
    {/* As many columns as there are sub-stages, so the board scrolls sideways; each column scrolls on its own. */}
    <div className={cn("-mx-4 mt-4 flex snap-x items-start gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0", loading && "pointer-events-none opacity-60")} aria-busy={loading || undefined}>
      {columns.map((column) => {
        const cards = byColumn.get(column.key) ?? [];
        const hasMore = column.count !== null && cards.length < column.count;
        const dot = categoryColor(column.categoryKey === "unclassified" ? null : column.categoryKey).color;
        return <Frame key={column.key} className="w-[min(20rem,85vw)] shrink-0 snap-start" aria-labelledby={`column-${column.key}`}>
          <header className="flex items-center gap-3 px-3 pb-3 pt-2.5">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${dot} 16%, transparent)` }}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: dot }} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={`column-${column.key}`} className="truncate text-label-md text-text-strong-950" title={column.title}>{column.title}</h2>
              <p className="truncate text-paragraph-xs text-text-sub-600">{column.detail}</p>
            </div>
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
