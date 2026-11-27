"use client";

import { useState } from "react";
import { RiArrowDownSLine, RiArrowUpSLine, RiDraggable, RiSettings3Line } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Popover from "@/components/alignui/popover";
import * as Switch from "@/components/alignui/switch";
import { cn } from "@/utils/cn";
import { CATEGORY_LABELS, categoryColor, type CrmCategory } from "./crm-utils";
import type { ColumnDef } from "./PipelineStageBoard";
import { CARD_FIELDS, DEFAULT_BOARD_SETTINGS, moved, toggled, type BoardSettings } from "./pipelineBoardSettings";

/**
 * The board's "Customize" panel, after Jira's board settings: which parts of
 * a card show, and — on the by-stage board — which columns show, in what
 * order (drag, or the arrows), whole categories at once, and empty columns.
 */
export function PipelineBoardCustomize({ open, onOpenChange, settings, update, columns, counts }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: BoardSettings;
  update: (change: (old: BoardSettings) => BoardSettings) => void;
  /** The by-stage board's columns in their current order; null on the by-status board. */
  columns: ColumnDef[] | null;
  counts: ReadonlyMap<string, number>;
}) {
  const [dragging, setDragging] = useState("");
  const [dropTarget, setDropTarget] = useState("");
  const hiddenFields = new Set(settings.hiddenFields);
  const hiddenColumns = new Set(settings.hiddenColumns);
  const keys = columns?.map((column) => column.key) ?? [];
  const move = (from: string, to: string) => {
    if (from && to && from !== to) update((old) => ({ ...old, columnOrder: moved(keys, from, to) }));
  };
  const categoryKeys = [...new Set(columns?.map((column) => column.categoryKey) ?? [])];
  const changed = settings.hiddenFields.length > 0 || settings.hiddenColumns.length > 0 || settings.columnOrder.length > 0 || settings.showEmptyColumns;

  return <Popover.Root open={open} onOpenChange={onOpenChange}>
    <Popover.Trigger asChild>
      <Button.Root variant="neutral" mode="stroke" size="xsmall" className="gap-1.5">
        <Button.Icon as={RiSettings3Line} />Customize
        {changed && <span aria-label="customized" className="size-1.5 rounded-full bg-primary-base" />}
      </Button.Root>
    </Popover.Trigger>
    <Popover.Content align="end" showArrow={false} sideOffset={8} className="max-h-[min(40rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-0">
      <div className="flex items-center justify-between border-b border-stroke-soft-200 px-4 py-3">
        <h2 className="text-label-md text-text-strong-950">Customize board</h2>
        <button type="button" disabled={!changed} onClick={() => update(() => DEFAULT_BOARD_SETTINGS)} className="text-label-sm text-primary-base outline-none hover:underline focus-visible:underline disabled:pointer-events-none disabled:text-text-disabled-300">Reset all</button>
      </div>

      <section className="px-4 py-3">
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
                <Switch.Root checked={on} onCheckedChange={(next) => update((old) => ({ ...old, hiddenFields: toggled(old.hiddenFields, field.key, next) }))} aria-label={`Show ${field.label}`} />
              </label>
            </li>;
          })}
        </ul>
      </section>

      {columns && <section className="border-t border-stroke-soft-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-label-xs uppercase tracking-wide text-text-soft-400">Columns</h3>
          <button type="button" disabled={!settings.columnOrder.length && !settings.hiddenColumns.length} onClick={() => update((old) => ({ ...old, columnOrder: [], hiddenColumns: [] }))} className="text-label-xs text-primary-base outline-none hover:underline disabled:pointer-events-none disabled:text-text-disabled-300">Reset columns</button>
        </div>

        {categoryKeys.length > 1 && <div className="mt-2 flex flex-wrap gap-1.5">
          {categoryKeys.map((categoryKey) => {
            const inCategory = columns.filter((column) => column.categoryKey === categoryKey).map((column) => column.key);
            const allHidden = inCategory.every((key) => hiddenColumns.has(key));
            return <button
              key={categoryKey}
              type="button"
              aria-pressed={!allHidden}
              title={allHidden ? "Show every column of this category" : "Hide every column of this category"}
              onClick={() => update((old) => ({ ...old, hiddenColumns: allHidden ? old.hiddenColumns.filter((key) => !inCategory.includes(key)) : [...new Set([...old.hiddenColumns, ...inCategory])] }))}
              className={cn("inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-label-xs ring-1 ring-inset transition", allHidden ? "text-text-soft-400 ring-stroke-soft-200 line-through" : "bg-bg-weak-50 text-text-strong-950 ring-stroke-sub-300")}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: categoryColor(categoryKey === "unclassified" ? null : categoryKey).color }} />
              {CATEGORY_LABELS[categoryKey as CrmCategory] ?? "Unclassified"}
            </button>;
          })}
        </div>}

        <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 hover:bg-bg-weak-50">
          <span className="min-w-0 flex-1 text-label-sm text-text-strong-950">Show empty columns</span>
          <Switch.Root checked={settings.showEmptyColumns} onCheckedChange={(next) => update((old) => ({ ...old, showEmptyColumns: next }))} aria-label="Show empty columns" />
        </label>

        <p className="mt-2 px-1.5 text-paragraph-xs text-text-sub-600">Drag to reorder, here or by a column&apos;s header on the board.</p>
        <ol className="mt-1.5 space-y-0.5">
          {columns.map((column, index) => {
            const on = !hiddenColumns.has(column.key);
            const count = counts.get(column.key) ?? 0;
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
              <span className="shrink-0 text-paragraph-xs tabular-nums text-text-soft-400">{count.toLocaleString()}</span>
              <span className="flex shrink-0 opacity-0 transition group-hover/item:opacity-100 group-focus-within/item:opacity-100">
                <button type="button" disabled={index === 0} onClick={() => move(column.key, keys[index - 1])} aria-label={`Move ${column.title} left`} className="rounded p-0.5 text-text-sub-600 hover:bg-bg-soft-200 disabled:opacity-30"><RiArrowUpSLine className="size-4" /></button>
                <button type="button" disabled={index === columns.length - 1} onClick={() => move(column.key, keys[index + 1])} aria-label={`Move ${column.title} right`} className="rounded p-0.5 text-text-sub-600 hover:bg-bg-soft-200 disabled:opacity-30"><RiArrowDownSLine className="size-4" /></button>
              </span>
              <Switch.Root checked={on} onCheckedChange={(next) => update((old) => ({ ...old, hiddenColumns: toggled(old.hiddenColumns, column.key, next) }))} aria-label={`Show ${column.title}`} />
            </li>;
          })}
        </ol>
      </section>}
    </Popover.Content>
  </Popover.Root>;
}
