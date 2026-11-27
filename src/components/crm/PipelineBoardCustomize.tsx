"use client";

import { useState } from "react";
import { RiArrowDownSLine, RiArrowUpSLine, RiDraggable, RiSettings3Line } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Popover from "@/components/alignui/popover";
import * as Switch from "@/components/alignui/switch";
import { CARD_FIELDS, type BoardViewConfig } from "@/lib/crm/boardViews";
import { cn } from "@/utils/cn";
import { CATEGORY_LABELS, categoryColor, type CrmCategory } from "./crm-utils";
import { moved, type ColumnDef } from "./PipelineStageBoard";

/** `stages` with `keys` switched on or off; every stage on is stored as none named (= all). */
export function withStages(stages: readonly string[], allKeys: readonly string[], keys: readonly string[], on: boolean): string[] {
  const current = new Set(stages.length ? stages : allKeys);
  for (const key of keys) if (on) current.add(key); else current.delete(key);
  const next = allKeys.filter((key) => current.has(key));
  return next.length === allKeys.length ? [] : next;
}

/**
 * The view's "Customize" panel, after Jira's board settings: which parts of
 * a card show, and on the by-stage board which stages are columns (one at a
 * time or a whole category), their order (drag, or the arrows), and whether
 * empty columns show. Changes edit the view; Save keeps them.
 */
export function PipelineBoardCustomize({ config, onChange, columns, counts }: {
  config: BoardViewConfig;
  onChange: (change: (old: BoardViewConfig) => BoardViewConfig) => void;
  /** Every stage in the view's order; null on the by-status board. */
  columns: ColumnDef[] | null;
  counts: ReadonlyMap<string, number>;
}) {
  const [dragging, setDragging] = useState("");
  const [dropTarget, setDropTarget] = useState("");
  const hiddenFields = new Set(config.hiddenFields);
  const keys = columns?.map((column) => column.key) ?? [];
  const shown = new Set(config.filters.stages.length ? config.filters.stages : keys);
  const setStages = (changed: readonly string[], on: boolean) => onChange((old) => ({ ...old, filters: { ...old.filters, stages: withStages(old.filters.stages, keys, changed, on) } }));
  const move = (from: string, to: string) => {
    if (from && to && from !== to) onChange((old) => ({ ...old, columnOrder: moved(keys, from, to) }));
  };
  const categoryKeys = [...new Set(columns?.map((column) => column.categoryKey) ?? [])];

  return <Popover.Root>
    <Popover.Trigger asChild>
      <Button.Root variant="neutral" mode="stroke" size="xsmall" className="gap-1.5"><Button.Icon as={RiSettings3Line} />Customize</Button.Root>
    </Popover.Trigger>
    <Popover.Content align="end" showArrow={false} sideOffset={8} className="max-h-[min(40rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-0">
      <div className="border-b border-stroke-soft-200 px-4 py-3">
        <h2 className="text-label-md text-text-strong-950">Customize view</h2>
        <p className="mt-0.5 text-paragraph-xs text-text-sub-600">Changes apply to this view; Save keeps them for everyone.</p>
      </div>

      {columns && <section className="px-4 py-3">
        <h3 className="text-label-xs uppercase tracking-wide text-text-soft-400">Columns</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categoryKeys.map((categoryKey) => {
            const inCategory = columns.filter((column) => column.categoryKey === categoryKey).map((column) => column.key);
            const anyShown = inCategory.some((key) => shown.has(key));
            return <button
              key={categoryKey}
              type="button"
              aria-pressed={anyShown}
              title={anyShown ? "Hide every stage of this category" : "Show every stage of this category"}
              onClick={() => setStages(inCategory, !anyShown)}
              className={cn("inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-label-xs ring-1 ring-inset transition", anyShown ? "bg-bg-weak-50 text-text-strong-950 ring-stroke-sub-300" : "text-text-soft-400 line-through ring-stroke-soft-200")}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: categoryColor(categoryKey === "unclassified" ? null : categoryKey).color }} />
              {CATEGORY_LABELS[categoryKey as CrmCategory] ?? "Unclassified"}
            </button>;
          })}
        </div>

        {!config.filters.stages.length && <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 hover:bg-bg-weak-50">
          <span className="min-w-0 flex-1 text-label-sm text-text-strong-950">Show empty columns</span>
          <Switch.Root checked={config.showEmptyColumns} onCheckedChange={(next) => onChange((old) => ({ ...old, showEmptyColumns: next }))} aria-label="Show empty columns" />
        </label>}

        <p className="mt-2 px-1.5 text-paragraph-xs text-text-sub-600">Drag to reorder, here or by a column&apos;s header on the board.</p>
        <ol className="mt-1.5 space-y-0.5">
          {columns.map((column, index) => {
            const on = shown.has(column.key);
            return <li
              key={column.key}
              draggable
              onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", column.key); setDragging(column.key); }}
              onDragEnd={() => { setDragging(""); setDropTarget(""); }}
              onDragOver={(event) => { if (!dragging) return; event.preventDefault(); setDropTarget(column.key); }}
              onDrop={(event) => { event.preventDefault(); move(dragging, column.key); setDragging(""); setDropTarget(""); }}
              className={cn("group/item flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-bg-weak-50", dragging === column.key && "opacity-50", dropTarget === column.key && dragging !== column.key && "ring-2 ring-inset ring-primary-base")}
            >
              <RiDraggable className="size-4 shrink-0 cursor-grab text-text-soft-400" aria-hidden="true" />
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(column.categoryKey === "unclassified" ? null : column.categoryKey).color }} />
              <span className={cn("min-w-0 flex-1 truncate text-label-sm", on ? "text-text-strong-950" : "text-text-soft-400")} title={`${column.title} · ${column.detail}`}>
                {column.title}
                {!column.subcategoryId && column.categoryKey !== "unclassified" && <span className="text-text-soft-400"> · no sub-stage</span>}
              </span>
              <span className="shrink-0 text-paragraph-xs tabular-nums text-text-soft-400">{(counts.get(column.key) ?? 0).toLocaleString()}</span>
              <span className="flex shrink-0 opacity-0 transition group-hover/item:opacity-100 group-focus-within/item:opacity-100">
                <button type="button" disabled={index === 0} onClick={() => move(column.key, keys[index - 1])} aria-label={`Move ${column.title} left`} className="rounded p-0.5 text-text-sub-600 hover:bg-bg-soft-200 disabled:opacity-30"><RiArrowUpSLine className="size-4" /></button>
                <button type="button" disabled={index === columns.length - 1} onClick={() => move(column.key, keys[index + 1])} aria-label={`Move ${column.title} right`} className="rounded p-0.5 text-text-sub-600 hover:bg-bg-soft-200 disabled:opacity-30"><RiArrowDownSLine className="size-4" /></button>
              </span>
              <Switch.Root checked={on} onCheckedChange={(next) => setStages([column.key], next)} aria-label={`Show ${column.title}`} />
            </li>;
          })}
        </ol>
      </section>}

      <section className={cn("px-4 py-3", columns && "border-t border-stroke-soft-200")}>
        <h3 className="text-label-xs uppercase tracking-wide text-text-soft-400">Card fields</h3>
        <ul className="mt-2 space-y-1">
          {CARD_FIELDS.map((field) => {
            const on = !hiddenFields.has(field.key);
            return <li key={field.key}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 hover:bg-bg-weak-50">
                <span className="min-w-0 flex-1">
                  <span className="block text-label-sm text-text-strong-950">{field.label}</span>
                  <span className="block truncate text-paragraph-xs text-text-sub-600">{field.detail}</span>
                </span>
                <Switch.Root checked={on} onCheckedChange={(next) => onChange((old) => ({ ...old, hiddenFields: next ? old.hiddenFields.filter((key) => key !== field.key) : [...old.hiddenFields, field.key] }))} aria-label={`Show ${field.label}`} />
              </label>
            </li>;
          })}
        </ul>
      </section>
    </Popover.Content>
  </Popover.Root>;
}
