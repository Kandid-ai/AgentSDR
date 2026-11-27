"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RiCheckDoubleLine, RiFilterOffLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as SegmentedControl from "@/components/alignui/segmented-control";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { EmptyState } from "@/components/page/EmptyState";
import { EMPTY_FILTERS, boardFilterParams, type BoardFilters, type CardField } from "@/lib/crm/boardViews";
import { cn } from "@/utils/cn";
import { HoverPreviewProvider } from "./ActionRowTools";
import {
  ActionCard,
  ActionRows,
  LoadMoreOnScroll,
  NoticeBar,
  PAGE_SIZE,
  STAGE_META,
  StageIcon,
  actionId,
  useRowMutations,
  useSyncRecordChanges,
  type Action,
  type Data,
  type PipelineStage,
} from "./CrmActionsClient";
import { ErrorState } from "./CrmLayout";
import { RowsSkeleton } from "./CrmSkeletons";
import { FunnelFilterBar, activeFilterCount } from "./FunnelFilterBar";
import { FunnelHeader } from "./FunnelHeader";
import { PipelineBoardCustomize } from "./PipelineBoardCustomize";
import { COLUMN_CARDS, COLUMN_FRAME, ColumnLoadMore, ColumnSkeleton, PipelineStageBoard, useBoardHeight, groupCountMap, ordered, stageCatalog, type GroupCount } from "./PipelineStageBoard";
import { useFunnelViews } from "./useFunnelViews";
import { asList, asObject, crmFetch, errorMessage } from "./crm-utils";

const STAGES = Object.keys(STAGE_META) as PipelineStage[];
/** Cards per column per request; a board shows three columns at once. */
const BOARD_PAGE = 20;
/** The stage board's first read: each column's newest few, in one request (see PipelineStageBoard). */
const STAGE_BOARD_PAGE = 200;
const STAGE_BOARD_PER_COLUMN = 8;

const EMPTY_COPY: Record<PipelineStage | "all", { title: string; detail: string }> = {
  all: { title: "No open leads", detail: "Anyone who replies will show up here until their record is closed." },
  needs_action: { title: "Nothing needs attention", detail: "New replies and due follow-ups land here." },
  waiting: { title: "No one is waiting", detail: "Leads you have replied to, or with a follow-up scheduled, land here." },
  exhausted: { title: "No exhausted sequences", detail: "Leads whose every follow-up went out without a reply land here." },
};

function filterQuery(filters: BoardFilters) {
  return boardFilterParams(filters, new URLSearchParams({ scope: "pipeline" })).toString();
}

type Summary = { total: number | null; statusCounts: Partial<Record<PipelineStage, number>> | null; groupCounts: GroupCount[] | null };

/**
 * The numbers the filter bar shows: leads under the filters, and per status
 * and per stage (each under the other filters). One read of one row with the
 * counts; `refresh` re-reads after an edit moves a lead.
 */
function useSummary(query: string, enabled: boolean) {
  const [summary, setSummary] = useState<Summary>({ total: null, statusCounts: null, groupCounts: null });
  // Only the newest read may land: an older, slower one would show another filter's numbers.
  const latest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const body = asObject(await crmFetch(`/actions?${query}&groupCounts=true&limit=1`));
      if (request !== latest.current) return;
      setSummary({
        total: typeof body.total === "number" ? body.total : null,
        statusCounts: asObject(body.stageCounts) as Partial<Record<PipelineStage, number>>,
        groupCounts: Array.isArray(body.groupCounts) ? body.groupCounts as GroupCount[] : null,
      });
    } catch { /* the bar shows "…" */ }
  }, [query]);
  useEffect(() => { if (!enabled) return; setSummary((old) => ({ ...old, total: null })); void load(); }, [load, enabled]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), 1200);
  }, [load]);
  return { ...summary, refresh };
}

/**
 * One paged pipeline read: the first page replaces, later pages append
 * (deduplicated — a card moved into this list by an edit may come back on a
 * later page). `enabled` lets the board and the list share the hook without
 * both fetching.
 */
function usePipelinePage(query: string, pageSize: number, enabled: boolean) {
  const [actions, setActions] = useState<Action[]>([]);
  const [stageCounts, setStageCounts] = useState<Partial<Record<PipelineStage, number>> | null>(null);
  const [groupCounts, setGroupCounts] = useState<GroupCount[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // A newer first page (the filters changed) makes every older read stale.
  const generation = useRef(0);
  const load = useCallback(async (offset: number) => {
    const firstPage = offset === 0;
    const current = firstPage ? ++generation.current : generation.current;
    if (firstPage) setLoading(true); else setLoadingMore(true);
    setError("");
    try {
      const params = new URLSearchParams(query);
      params.set("limit", String(pageSize));
      params.set("offset", String(offset));
      const result = await crmFetch(`/actions?${params}`);
      if (current !== generation.current) return;
      const page = asList<Action>(result, ["actions"]);
      const body = asObject(result);
      setActions((old) => {
        if (firstPage) return page;
        const seen = new Set(old.map(actionId));
        return [...old, ...page.filter((item) => !seen.has(actionId(item)))];
      });
      if (firstPage) {
        setStageCounts(asObject(body.stageCounts) as Partial<Record<PipelineStage, number>>);
        setGroupCounts(Array.isArray(body.groupCounts) ? body.groupCounts as GroupCount[] : null);
      }
      setNextOffset(Number(body.nextOffset ?? offset + page.length));
      setHasMore(Boolean(body.hasMore));
      setLoaded(true);
    } catch (cause) { setError(errorMessage(cause)); } finally { setLoading(false); setLoadingMore(false); }
  }, [query, pageSize]);
  useEffect(() => { if (enabled) void load(0); }, [load, enabled]);
  const loadMore = useCallback(() => { void load(nextOffset); }, [load, nextOffset]);
  return { actions, setActions, stageCounts, groupCounts, loaded, loading, loadingMore, error, hasMore, load, loadMore };
}

/**
 * The Funnel: every open lead, through the organization's saved views. A
 * view (useFunnelViews) is a board or list, its columns (by stage or by
 * status), its filters, column order and card fields; anything changed here
 * edits a draft of it until Save. Unlike Action required, a lead stays here
 * after it is acted on, so someone replied to yesterday with a follow-up due
 * tomorrow — or whose follow-ups have all gone out — is still to be found.
 */
export function CrmPipelineClient() {
  const views = useFunnelViews();
  const { config, setConfig } = views;
  const [categories, setCategories] = useState<Data[]>([]);
  const [categoryError, setCategoryError] = useState("");
  // Below lg the status board shows one column at a time.
  const [mobileStage, setMobileStage] = useState<PipelineStage>("needs_action");
  useEffect(() => {
    void crmFetch("/categories").then((result) => setCategories(asList<Data>(asObject(result).categories))).catch((cause) => setCategoryError(errorMessage(cause)));
  }, []);

  // Search is the viewer's own: it narrows the page but is never saved to the view.
  const [search, setSearch] = useState("");
  useEffect(() => { setSearch(""); }, [views.current?.id]);
  const filters = useMemo(() => ({ ...config.filters, search }), [config.filters, search]);
  const base = useMemo(() => filterQuery(filters), [filters]);
  const ready = Boolean(views.current);
  const statusBoard = ready && config.layout === "board" && config.groupBy === "status";
  const stageBoard = ready && config.layout === "board" && config.groupBy === "stage";
  const listView = ready && config.layout === "list";

  const statusQuery = (stage: PipelineStage) => {
    const params = new URLSearchParams(base);
    params.set("stage", stage);
    return params.toString();
  };
  const needs = usePipelinePage(statusQuery("needs_action"), BOARD_PAGE, statusBoard);
  const waiting = usePipelinePage(statusQuery("waiting"), BOARD_PAGE, statusBoard);
  const exhausted = usePipelinePage(statusQuery("exhausted"), BOARD_PAGE, statusBoard);
  const statusColumns = { needs_action: needs, waiting, exhausted } as const;
  const list = usePipelinePage(base, PAGE_SIZE, listView);
  const stageBoardQuery = useMemo(() => {
    const params = new URLSearchParams(base);
    params.set("perGroupLimit", String(STAGE_BOARD_PER_COLUMN));
    return params.toString();
  }, [base]);
  const byStage = usePipelinePage(stageBoardQuery, STAGE_BOARD_PAGE, stageBoard);
  const summary = useSummary(base, ready);
  const { attach: attachStatusBoard, style: statusBoardStyle } = useBoardHeight<HTMLDivElement>();

  const stageCounts = useMemo(() => summary.groupCounts ? groupCountMap(summary.groupCounts) : null, [summary.groupCounts]);
  // Every stage in funnel order (the Stage filter's checklist), and in the
  // view's order (the board's columns and Customize's column list).
  const funnelStages = useMemo(() => stageCatalog(categories, (summary.groupCounts ?? []).map((row) => ({ categoryKey: row.categoryKey ?? "unclassified", subcategoryId: row.subcategoryId }))), [categories, summary.groupCounts]);
  const allStages = useMemo(() => ordered(funnelStages, config.columnOrder), [funnelStages, config.columnOrder]);
  // The board's columns: the view's stages, or all of them when it names none.
  const boardColumns = useMemo(() => filters.stages.length ? allStages.filter((stage) => filters.stages.includes(stage.key)) : allStages, [allStages, filters.stages]);
  const hiddenFields = useMemo(() => new Set<CardField>(config.hiddenFields), [config.hiddenFields]);
  const shownStatuses = filters.statuses.length ? STAGES.filter((stage) => filters.statuses.includes(stage)) : STAGES;

  const filtered = activeFilterCount(filters) > 0;
  const setFilters = useCallback((next: BoardFilters) => {
    setSearch(next.search);
    const { search: _search, ...saved } = next;
    void _search;
    setConfig((old) => {
      const before = { ...old.filters, search: "" };
      const after = { ...saved, search: "" };
      // Typing in the search box alone leaves the view as it was saved.
      return JSON.stringify(before) === JSON.stringify(after) ? old : { ...old, filters: after };
    });
  }, [setConfig]);
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const onMutated = summary.refresh;
  const format = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString();
  const statusCount = (stage: PipelineStage) => summary.statusCounts ? Number(summary.statusCounts[stage] ?? 0) : null;

  return <>
    <FunnelHeader views={views} actions={ready && <PipelineBoardCustomize config={config} onChange={setConfig} stages={allStages} counts={stageCounts ?? new Map()} />} />

    {ready && <div className="mt-5">
      <FunnelFilterBar filters={filters} onChange={setFilters} stages={funnelStages} stageCounts={stageCounts} statusCounts={summary.statusCounts} total={summary.total} />
    </div>}
    {categoryError && <div className="mt-3"><ErrorState message={categoryError} /></div>}

    {!views.loaded ? <div className="mt-4 flex gap-4 overflow-hidden">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-80 w-[min(20rem,85vw)] shrink-0 animate-pulse rounded-2xl bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200" />)}</div>
      : !ready ? <div className="mt-4"><ErrorState message={views.error || "No views could be loaded."} onRetry={() => void views.reload()} /></div>
      : stageBoard ? <HoverPreviewProvider><PipelineStageBoard
        query={stageBoardQuery}
        actions={byStage.actions}
        setActions={byStage.setActions}
        columns={boardColumns}
        countByKey={stageCounts}
        loaded={byStage.loaded}
        loading={byStage.loading}
        error={byStage.error}
        onRetry={() => void byStage.load(0)}
        categories={categories}
        config={config}
        onConfigChange={setConfig}
        filtered={filtered}
        onReset={clearFilters}
        onMutated={onMutated}
      /></HoverPreviewProvider>
      : statusBoard ? <>
        <SegmentedControl.Root value={mobileStage} onValueChange={(value) => setMobileStage(value as PipelineStage)} className="mt-4 lg:hidden">
          <SegmentedControl.List aria-label="Status">
            {shownStatuses.map((stage) => <SegmentedControl.Trigger key={stage} value={stage} className="gap-1 px-1.5 text-label-xs sm:gap-1.5 sm:px-2">
              <StageGlyph stage={stage} />
              {STAGE_META[stage].short}
              <span className="tabular-nums text-text-soft-400">{format(statusCount(stage))}</span>
            </SegmentedControl.Trigger>)}
          </SegmentedControl.List>
        </SegmentedControl.Root>
        <HoverPreviewProvider>
          <div ref={attachStatusBoard} style={statusBoardStyle} className={cn("mt-4 grid grid-cols-1 items-start gap-4 lg:gap-5", shownStatuses.length === 3 ? "lg:grid-cols-3" : shownStatuses.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
            {shownStatuses.map((stage) => <BoardColumn
              key={stage}
              stage={stage}
              page={statusColumns[stage]}
              columns={statusColumns}
              count={statusCount(stage)}
              categories={categories}
              filtered={filtered}
              onReset={clearFilters}
              onMutated={onMutated}
              hiddenFields={hiddenFields}
              className={stage === mobileStage || shownStatuses.length === 1 ? undefined : "hidden lg:flex"}
            />)}
          </div>
        </HoverPreviewProvider>
      </>
      : <Frame className="mt-4">
        <FramePanel className="overflow-hidden p-0 sm:p-0">
          {list.loading ? <RowsSkeleton rows={8} />
            : list.error && !list.actions.length ? <div className="p-4"><ErrorState message={list.error} onRetry={() => void list.load(0)} /></div>
            : <>
              <ActionRows
                actions={list.actions}
                categories={categories}
                onActionsChange={list.setActions}
                onMutated={onMutated}
                pipeline
                refreshing={list.loading}
                hasMore={list.hasMore && !list.loadingMore}
                onLoadMore={list.loadMore}
                empty={filtered
                  ? { icon: RiFilterOffLine, title: "No leads match these filters", detail: "Try other stages, statuses or channels.", action: <Button.Root variant="neutral" mode="stroke" size="small" onClick={clearFilters}>Clear filters</Button.Root> }
                  : { icon: RiCheckDoubleLine, ...EMPTY_COPY.all }}
              />
              {list.hasMore && <LoadMoreOnScroll onLoadMore={list.loadMore} busy={list.loadingMore} />}
            </>}
        </FramePanel>
      </Frame>}
  </>;
}

type Page = ReturnType<typeof usePipelinePage>;

function BoardColumn({ stage, page, columns, count, categories, filtered, onReset, onMutated, hiddenFields, className }: {
  stage: PipelineStage;
  page: Page;
  columns: Record<PipelineStage, Page>;
  count: number | null;
  categories: Data[];
  filtered: boolean;
  onReset: () => void;
  onMutated: () => void;
  hiddenFields: ReadonlySet<CardField>;
  className?: string;
}) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  // An edit can move a lead to another stage (a sent reply takes it from
  // Needs action to Waiting): the refreshed card leaves this column and joins
  // the head of its new one. Deduplicated by id, so a repeat is harmless.
  const setActions = page.setActions;
  const onActionsChange = useCallback<React.Dispatch<React.SetStateAction<Action[]>>>((update) => {
    setActions((old) => {
      const next = typeof update === "function" ? update(old) : update;
      const moved = next.filter((item) => String(item.stage ?? stage) !== stage);
      for (const item of moved) {
        const target = columns[String(item.stage) as PipelineStage];
        target?.setActions((current) => [item, ...current.filter((other) => actionId(other) !== actionId(item))]);
      }
      return moved.length ? next.filter((item) => String(item.stage ?? stage) === stage) : next;
    });
  }, [setActions, columns, stage]);
  const { busyIds, notice, setNotice, mutateRow, classify, refreshRow } = useRowMutations({ onActionsChange, pipeline: true, onMutated });
  // A lead changed in the record pop-up re-reads here, and moves column if its stage changed.
  useSyncRecordChanges(page.actions, refreshRow, onMutated);
  const meta = STAGE_META[stage];

  return <Frame className={cn("min-w-0", COLUMN_FRAME, className)} aria-busy={page.loading || undefined} aria-labelledby={`stage-${stage}`}>
    <header className="flex items-center gap-3 px-3 pb-3 pt-2.5">
      <StageIcon stage={stage} className="size-9 rounded-xl" iconClassName="size-[18px]" />
      <div className="min-w-0 flex-1">
        <h2 id={`stage-${stage}`} className="truncate text-label-md text-text-strong-950">{meta.label}</h2>
        <p className="truncate text-paragraph-xs text-text-sub-600">{meta.detail}</p>
      </div>
      <span className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded-lg bg-bg-white-0 px-2 text-label-sm tabular-nums text-text-strong-950 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200" title={`${count === null ? "—" : count.toLocaleString()} leads`}>{count === null ? "—" : count.toLocaleString()}</span>
    </header>
    <NoticeBar notice={notice} onDismiss={() => setNotice(null)} className="mb-1 rounded-lg" />
    {page.loading ? <ColumnSkeleton cards={4} />
      : page.error && !page.actions.length ? <FramePanel className="p-3 sm:p-3"><ErrorState message={page.error} onRetry={() => void page.load(0)} /></FramePanel>
      : !page.actions.length ? <FramePanel className="p-0 sm:p-0">
        {filtered
          ? <EmptyState compact icon={RiFilterOffLine} title="No matches here" description="No lead in this stage fits the filters." action={<Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={onReset}>Clear filters</Button.Root>} />
          : <EmptyState compact icon={RiCheckDoubleLine} title={EMPTY_COPY[stage].title} description={EMPTY_COPY[stage].detail} />}
      </FramePanel>
      // From lg each column scrolls on its own, like a board: the three stages
      // stay side by side instead of the page growing to the longest column.
      : <div className={cn("space-y-2 transition-opacity", COLUMN_CARDS, page.loading && "pointer-events-none opacity-60")}>
        {page.actions.map((action) => {
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
        {page.hasMore && <ColumnLoadMore onLoad={page.loadMore} busy={page.loadingMore} />}
      </div>}
  </Frame>;
}

/** A stage's icon in its colour, bare — for segmented controls where a tile would crowd the label. */
function StageGlyph({ stage, className }: { stage: PipelineStage; className?: string }) {
  const Icon = STAGE_META[stage].icon;
  return <span aria-hidden="true" className={cn("flex shrink-0", className)} style={{ color: STAGE_META[stage].color }}><Icon className="size-3.5" /></span>;
}
