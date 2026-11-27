"use client";

import { useState } from "react";
import { RiDraggable, RiEyeLine, RiEyeOffLine, RiKanbanView2, RiLayoutColumnLine, RiListUnordered, RiSettings3Line, RiStackLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Checkbox from "@/components/alignui/checkbox";
import * as Popover from "@/components/alignui/popover";
import { CARD_FIELDS, type BoardViewConfig } from "@/lib/crm/boardViews";
import { cn } from "@/utils/cn";
import { categoryColor } from "./crm-utils";
import { moved, type ColumnDef } from "./PipelineStageBoard";

/** `stages` with `keys` switched on or off; every stage on is stored as none named (= all). */
export function withStages(stages: readonly string[], allKeys: readonly string[], keys: readonly string[], on: boolean): string[] {
  const current = new Set(stages.length ? stages : allKeys);
  for (const key of keys) if (on) current.add(key); else current.delete(key);
  const next = allKeys.filter((key) => current.has(key));
  return next.length === allKeys.length ? [] : next;
}

/** Two options side by side, the picked one raised: smaller than a segmented control. */
function Toggle<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon: React.ComponentType<{ className?: string }> }>;
  onChange: (value: T) => void;
}) {
  return <div className="flex items-center justify-between gap-3">
    <span className="text-paragraph-sm text-text-sub-600">{label}</span>
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-bg-weak-50 p-0.5 ring-1 ring-inset ring-stroke-soft-200">
      {options.map((option) => {
        const Icon = option.icon;
        const on = option.value === value;
        return <button key={option.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(option.value)} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-label-xs outline-none transition focus-visible:ring-2 focus-visible:ring-primary-base", on ? "bg-bg-white-0 text-text-strong-950 shadow-regular-xs" : "text-text-soft-400 hover:text-text-sub-600")}>
          <Icon className="size-3.5" />{option.label}
        </button>;
      })}
    </div>
  </div>;
}

const LAYOUTS = [
  { value: "board", label: "Board", icon: RiKanbanView2 },
  { value: "list", label: "List", icon: RiListUnordered },
] as const;
const GROUPINGS = [
  { value: "stage", label: "Stage", icon: RiStackLine },
  { value: "status", label: "Status", icon: RiLayoutColumnLine },
] as const;

/**
 * The view's display options, kept small (after Linear's Display menu): the
 * layout and what the columns are, the card fields as chips to switch on and
 * off, and — on the by-stage board — the columns in a short list to reorder
 * (drag) and show or hide (the eye). Layout, order and card fields save to
 * the view; showing or hiding a stage is a filter, kept with Save as default.
 */
export function PipelineBoardCustomize({ config, onChange, stages, counts }: {
  config: BoardViewConfig;
  onChange: (change: (old: BoardViewConfig) => BoardViewConfig) => void;
  /** Every stage in the view's order. */
  stages: ColumnDef[];
  counts: ReadonlyMap<string, number>;
}) {
  const [dragging, setDragging] = useState("");
  const [dropTarget, setDropTarget] = useState("");
  const board = config.layout === "board";
  const byStage = board && config.groupBy === "stage";
  const hiddenFields = new Set(config.hiddenFields);
  const keys = stages.map((column) => column.key);
  const shown = new Set(config.filters.stages.length ? config.filters.stages : keys);
  const setStages = (changed: readonly string[], on: boolean) => onChange((old) => ({ ...old, filters: { ...old.filters, stages: withStages(old.filters.stages, keys, changed, on) } }));
  const move = (from: string, to: string) => {
    if (from && to && from !== to) onChange((old) => ({ ...old, columnOrder: moved(keys, from, to) }));
  };
  // Shown columns first (in their order), then the hidden ones: the list stays short to scan.
  const listed = [...stages.filter((column) => shown.has(column.key)), ...stages.filter((column) => !shown.has(column.key))];
  const shownCount = stages.length - listed.filter((column) => !shown.has(column.key)).length;

  return <Popover.Root>
    <Popover.Trigger asChild>
      <Button.Root variant="neutral" mode="stroke" size="xsmall" className="gap-1.5"><Button.Icon as={RiSettings3Line} />Customize</Button.Root>
    </Popover.Trigger>
    <Popover.Content align="end" showArrow={false} sideOffset={8} className="w-[min(20rem,calc(100vw-2rem))] p-0">
      <div className="space-y-2 p-3">
        <Toggle label="Layout" value={config.layout} options={LAYOUTS} onChange={(layout) => onChange((old) => ({ ...old, layout }))} />
        {board && <Toggle label="Columns by" value={config.groupBy} options={GROUPINGS} onChange={(groupBy) => onChange((old) => ({ ...old, groupBy }))} />}
      </div>

      {board && <div className="border-t border-stroke-soft-200 p-3">
        <p className="mb-2 text-label-xs text-text-soft-400">On each card</p>
        <div className="flex flex-wrap gap-1.5">
          {CARD_FIELDS.map((field) => {
            const on = !hiddenFields.has(field.key);
            return <button
              key={field.key}
              type="button"
              aria-pressed={on}
              title={field.detail}
              onClick={() => onChange((old) => ({ ...old, hiddenFields: on ? [...old.hiddenFields, field.key] : old.hiddenFields.filter((key) => key !== field.key) }))}
              className={cn("h-7 rounded-lg px-2.5 text-label-xs ring-1 ring-inset outline-none transition focus-visible:ring-2 focus-visible:ring-primary-base", on ? "bg-primary-alpha-10 text-primary-base ring-primary-alpha-16" : "text-text-soft-400 ring-stroke-soft-200 hover:text-text-sub-600")}
            >{field.label}</button>;
          })}
        </div>
      </div>}

      {byStage && <div className="border-t border-stroke-soft-200 pb-1 pt-3">
        <div className="mb-1 flex items-center justify-between px-3">
          <p className="text-label-xs text-text-soft-400">Columns <span className="tabular-nums">· {shownCount} of {stages.length}</span></p>
          {config.filters.stages.length > 0 && <button type="button" onClick={() => onChange((old) => ({ ...old, filters: { ...old.filters, stages: [] } }))} className="text-label-xs text-primary-base hover:underline">Show all</button>}
        </div>
        <ol className="max-h-64 overflow-y-auto px-1.5">
          {listed.map((column) => {
            const on = shown.has(column.key);
            const EyeIcon = on ? RiEyeLine : RiEyeOffLine;
            return <li
              key={column.key}
              draggable
              onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", column.key); setDragging(column.key); }}
              onDragEnd={() => { setDragging(""); setDropTarget(""); }}
              onDragOver={(event) => { if (!dragging) return; event.preventDefault(); setDropTarget(column.key); }}
              onDrop={(event) => { event.preventDefault(); move(dragging, column.key); setDragging(""); setDropTarget(""); }}
              className={cn("group/item flex h-8 cursor-grab items-center gap-2 rounded-md px-1.5 hover:bg-bg-weak-50 active:cursor-grabbing", dragging === column.key && "opacity-40", dropTarget === column.key && dragging !== column.key && "ring-1 ring-inset ring-primary-base")}
            >
              <RiDraggable className="size-3.5 shrink-0 text-text-disabled-300 group-hover/item:text-text-soft-400" aria-hidden="true" />
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(column.categoryKey === "unclassified" ? null : column.categoryKey).color }} />
              <span className={cn("min-w-0 flex-1 truncate text-paragraph-sm", on ? "text-text-strong-950" : "text-text-soft-400")} title={`${column.title} · ${column.detail}`}>
                {column.title}{!column.subcategoryId && column.categoryKey !== "unclassified" && <span className="text-text-soft-400"> · none</span>}
              </span>
              <span className="shrink-0 text-paragraph-xs tabular-nums text-text-soft-400">{(counts.get(column.key) ?? 0).toLocaleString()}</span>
              <button type="button" onClick={() => setStages([column.key], !on)} aria-pressed={on} aria-label={`${on ? "Hide" : "Show"} ${column.title}`} title={on ? "Hide column" : "Show column"} className={cn("flex size-6 shrink-0 items-center justify-center rounded-md outline-none transition hover:bg-bg-soft-200 focus-visible:ring-2 focus-visible:ring-primary-base", on ? "text-text-sub-600" : "text-text-disabled-300")}>
                <EyeIcon className="size-4" />
              </button>
            </li>;
          })}
        </ol>
        {!config.filters.stages.length && <label className="mx-3 mb-1.5 mt-1 flex cursor-pointer items-center gap-2 text-paragraph-xs text-text-sub-600">
          <Checkbox.Root checked={config.showEmptyColumns} onCheckedChange={(value) => onChange((old) => ({ ...old, showEmptyColumns: value === true }))} />
          Show empty columns
        </label>}
      </div>}
    </Popover.Content>
  </Popover.Root>;
}
