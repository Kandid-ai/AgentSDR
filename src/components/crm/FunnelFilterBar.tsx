"use client";

import { useEffect, useState } from "react";
import { RiArrowDownSLine, RiCloseLine, RiSearchLine } from "@remixicon/react";
import * as Checkbox from "@/components/alignui/checkbox";
import * as Popover from "@/components/alignui/popover";
import {
  BOARD_CHANNELS,
  BOARD_STATUSES,
  EMPTY_FILTERS,
  LAST_CONTACT_FILTERS,
  type BoardChannel,
  type BoardFilters,
  type BoardStatus,
  type LastContactFilter,
} from "@/lib/crm/boardViews";
import { cn } from "@/utils/cn";
import { CHANNEL_META } from "@/components/analytics/theme";
import { STAGE_META } from "./CrmActionsClient";
import { CATEGORY_LABELS, categoryColor, type CrmCategory } from "./crm-utils";
import type { ColumnDef } from "./PipelineStageBoard";

export function activeFilterCount(filters: BoardFilters) {
  return (filters.stages.length ? 1 : 0) + (filters.statuses.length ? 1 : 0) + (filters.channels.length ? 1 : 0)
    + (filters.search.trim() ? 1 : 0) + (filters.lastContact !== "any" ? 1 : 0);
}

/** A filter's button: its name, and what is picked once something is. */
function FilterButton({ label, value, active, children, className }: { label: string; value?: string; active: boolean; children: React.ReactNode; className?: string }) {
  return <Popover.Root>
    <Popover.Trigger asChild>
      <button type="button" className={cn(
        "inline-flex h-8 max-w-64 items-center gap-1.5 rounded-lg px-2.5 text-label-sm ring-1 ring-inset outline-none transition focus-visible:ring-2 focus-visible:ring-primary-base",
        active ? "bg-primary-alpha-10 text-primary-base ring-primary-alpha-16" : "bg-bg-white-0 text-text-sub-600 shadow-regular-xs ring-stroke-soft-200 hover:bg-bg-weak-50",
      )}>
        <span className="shrink-0">{label}</span>
        {value && <span className="truncate text-label-sm">{value}</span>}
        <RiArrowDownSLine className="size-4 shrink-0 opacity-70" aria-hidden="true" />
      </button>
    </Popover.Trigger>
    <Popover.Content align="start" showArrow={false} sideOffset={6} className={cn("max-h-[min(32rem,calc(100dvh-8rem))] overflow-y-auto p-1.5", className ?? "w-64")}>
      {children}
    </Popover.Content>
  </Popover.Root>;
}

function OptionRow({ checked, onChange, children, count, indent }: { checked: boolean | "indeterminate"; onChange: (on: boolean) => void; children: React.ReactNode; count?: number | null; indent?: boolean }) {
  return <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-paragraph-sm text-text-strong-950 hover:bg-bg-weak-50", indent && "pl-7")}>
    <Checkbox.Root checked={checked} onCheckedChange={(value) => onChange(value === true)} />
    <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    {count != null && <span className="shrink-0 text-paragraph-xs tabular-nums text-text-soft-400">{count.toLocaleString()}</span>}
  </label>;
}

function ClearRow({ onClear, disabled }: { onClear: () => void; disabled: boolean }) {
  return <div className="mt-1 border-t border-stroke-soft-200 px-2 pb-0.5 pt-1.5">
    <button type="button" disabled={disabled} onClick={onClear} className="text-label-xs text-primary-base hover:underline disabled:pointer-events-none disabled:text-text-disabled-300">Clear</button>
  </div>;
}

function toggle<T>(list: readonly T[], item: T, on: boolean): T[] {
  return on ? [...list.filter((value) => value !== item), item] : list.filter((value) => value !== item);
}

/**
 * The view's filters, after Jira's: a search box, then one button per field
 * (Stage, Status, Channel, Last contact), each a checklist with how many
 * leads every option holds under the other filters. Nothing picked means
 * everything. The count of leads the filters leave sits at the end.
 */
export function FunnelFilterBar({ filters, onChange, stages, stageCounts, statusCounts, total }: {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  /** Every stage, in funnel order. */
  stages: ColumnDef[];
  /** Leads per stage under every filter but Stage. */
  stageCounts: ReadonlyMap<string, number> | null;
  /** Leads per status under every filter but Status. */
  statusCounts: Partial<Record<BoardStatus, number>> | null;
  total: number | null;
}) {
  const [search, setSearch] = useState(filters.search);
  // A view switch (or Clear) replaces the filters from outside.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSearch(filters.search); }, [filters.search]);
  useEffect(() => {
    if (search === filters.search) return;
    const timer = setTimeout(() => onChange({ ...filters, search }), 350);
    return () => clearTimeout(timer);
  }, [search, filters, onChange]);

  const set = (patch: Partial<BoardFilters>) => onChange({ ...filters, ...patch });
  const picked = new Set(filters.stages);
  const categoryKeys = [...new Set(stages.map((stage) => stage.categoryKey))];
  const stageValue = !filters.stages.length ? undefined
    : filters.stages.length === 1 ? stages.find((stage) => stage.key === filters.stages[0])?.title ?? "1 stage"
    : `${filters.stages.length} stages`;
  const statusValue = !filters.statuses.length ? undefined
    : filters.statuses.length === 1 ? STAGE_META[filters.statuses[0]].label : `${filters.statuses.length} statuses`;
  const channelValue = !filters.channels.length ? undefined
    : filters.channels.map((channel) => CHANNEL_META[channel].label).join(", ");
  const active = activeFilterCount(filters) > 0;

  return <div className="flex flex-wrap items-center gap-2">
    <label className="flex h-8 w-full items-center gap-2 rounded-lg bg-bg-white-0 px-2.5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 focus-within:ring-2 focus-within:ring-primary-base sm:w-56">
      <RiSearchLine className="size-4 shrink-0 text-text-soft-400" aria-hidden="true" />
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads" aria-label="Search by name, email or company" title="Search by name, email or company" className="min-w-0 flex-1 bg-transparent text-paragraph-sm text-text-strong-950 outline-none placeholder:text-text-soft-400" />
      {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="text-text-soft-400 hover:text-text-strong-950"><RiCloseLine className="size-4" /></button>}
    </label>

    <FilterButton label="Stage" value={stageValue} active={filters.stages.length > 0} className="w-72">
      {categoryKeys.map((categoryKey) => {
        const inCategory = stages.filter((stage) => stage.categoryKey === categoryKey);
        const pickedHere = inCategory.filter((stage) => picked.has(stage.key)).length;
        const dot = categoryColor(categoryKey === "unclassified" ? null : categoryKey).color;
        return <div key={categoryKey} className="py-0.5">
          <OptionRow
            checked={pickedHere === 0 ? false : pickedHere === inCategory.length ? true : "indeterminate"}
            onChange={(on) => {
              const keys = inCategory.map((stage) => stage.key);
              // From "everything" (nothing picked), ticking a category means only it.
              set({ stages: on ? [...new Set([...filters.stages, ...keys])] : filters.stages.filter((key) => !keys.includes(key)) });
            }}
            count={stageCounts ? inCategory.reduce((sum, stage) => sum + (stageCounts.get(stage.key) ?? 0), 0) : null}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
            <span className="truncate text-label-sm">{CATEGORY_LABELS[categoryKey as CrmCategory] ?? "Unclassified"}</span>
          </OptionRow>
          {inCategory.length > 1 || inCategory[0]?.subcategoryId ? inCategory.map((stage) => <OptionRow
            key={stage.key}
            indent
            checked={picked.has(stage.key)}
            onChange={(on) => set({ stages: toggle(filters.stages, stage.key, on) })}
            count={stageCounts ? stageCounts.get(stage.key) ?? 0 : null}
          >
            <span className="truncate">{stage.subcategoryId ? stage.title : "No sub-stage"}</span>
          </OptionRow>) : null}
        </div>;
      })}
      <ClearRow onClear={() => set({ stages: [] })} disabled={!filters.stages.length} />
      {stages.length === 0 && <p className="px-2 py-1.5 text-paragraph-xs text-text-sub-600">Loading stages…</p>}
    </FilterButton>

    <FilterButton label="Status" value={statusValue} active={filters.statuses.length > 0}>
      {BOARD_STATUSES.map((status) => <OptionRow
        key={status}
        checked={filters.statuses.includes(status)}
        onChange={(on) => set({ statuses: toggle(filters.statuses, status, on) })}
        count={statusCounts ? statusCounts[status] ?? 0 : null}
      >
        <span className="flex shrink-0" style={{ color: STAGE_META[status].color }}>{(() => { const Icon = STAGE_META[status].icon; return <Icon className="size-4" />; })()}</span>
        <span className="min-w-0">
          <span className="block truncate">{STAGE_META[status].label}</span>
          <span className="block truncate text-paragraph-xs text-text-sub-600">{STAGE_META[status].detail}</span>
        </span>
      </OptionRow>)}
      <ClearRow onClear={() => set({ statuses: [] })} disabled={!filters.statuses.length} />
    </FilterButton>

    <FilterButton label="Channel" value={channelValue} active={filters.channels.length > 0} className="w-56">
      {BOARD_CHANNELS.map((channel: BoardChannel) => {
        const meta = CHANNEL_META[channel];
        const Icon = meta.icon;
        return <OptionRow key={channel} checked={filters.channels.includes(channel)} onChange={(on) => set({ channels: toggle(filters.channels, channel, on) })}>
          <span className="flex shrink-0" style={{ color: meta.color }}><Icon className="size-4" /></span>{meta.label}
        </OptionRow>;
      })}
      <ClearRow onClear={() => set({ channels: [] })} disabled={!filters.channels.length} />
    </FilterButton>

    <FilterButton label="Last contact" value={filters.lastContact === "any" ? undefined : LAST_CONTACT_FILTERS[filters.lastContact].label.toLowerCase()} active={filters.lastContact !== "any"} className="w-60">
      <div role="radiogroup" aria-label="Last contact">
        {(Object.keys(LAST_CONTACT_FILTERS) as LastContactFilter[]).map((key) => <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-paragraph-sm text-text-strong-950 hover:bg-bg-weak-50">
          <input type="radio" name="last-contact" className="size-4 accent-[var(--color-primary-base,currentColor)]" checked={filters.lastContact === key} onChange={() => set({ lastContact: key })} />
          {LAST_CONTACT_FILTERS[key].label}
        </label>)}
      </div>
    </FilterButton>

    {active && <button type="button" onClick={() => { setSearch(""); onChange(EMPTY_FILTERS); }} className="h-8 rounded-lg px-2 text-label-sm text-text-sub-600 hover:bg-bg-weak-50 hover:text-text-strong-950">Clear filters</button>}

    <span className="ml-auto text-label-sm tabular-nums text-text-sub-600" aria-live="polite">
      {total === null ? "…" : `${total.toLocaleString()} ${total === 1 ? "lead" : "leads"}`}
    </span>
  </div>;
}
