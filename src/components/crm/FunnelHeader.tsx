"use client";

import { useEffect, useRef, useState } from "react";
import { RiAddLine, RiArrowDownSLine, RiCheckLine, RiDeleteBinLine, RiErrorWarningLine, RiFileCopyLine, RiLoader4Line, RiPencilLine } from "@remixicon/react";
import * as Dropdown from "@/components/alignui/dropdown";
import { useDialogs } from "@/components/DialogProvider";
import { VIEW_NAME_MAX } from "@/lib/crm/boardViews";
import { cn } from "@/utils/cn";
import type { useFunnelViews } from "./useFunnelViews";

type Views = ReturnType<typeof useFunnelViews>;

const iconButton = "flex size-8 shrink-0 items-center justify-center rounded-lg text-text-soft-400 outline-none transition hover:bg-bg-weak-50 hover:text-text-strong-950 focus-visible:ring-2 focus-visible:ring-primary-base data-[state=open]:bg-bg-weak-50 data-[state=open]:text-text-strong-950";

/** The view's name, edited where it stands: Enter or leaving the field keeps it, Escape does not. */
function InlineName({ name, onSave, onDone }: { name: string; onSave: (name: string) => void; onDone: () => void }) {
  const [value, setValue] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.select(); }, []);
  const commit = () => {
    const next = value.replace(/\s+/g, " ").trim().slice(0, VIEW_NAME_MAX);
    if (next && next !== name) onSave(next);
    onDone();
  };
  return <input
    ref={input}
    autoFocus
    value={value}
    maxLength={VIEW_NAME_MAX}
    aria-label="View name"
    onChange={(event) => setValue(event.target.value)}
    onBlur={commit}
    onKeyDown={(event) => {
      if (event.key === "Enter") { event.preventDefault(); commit(); }
      if (event.key === "Escape") { event.preventDefault(); onDone(); }
    }}
    className="-ml-1.5 min-w-0 max-w-full rounded-lg bg-bg-white-0 px-1.5 text-title-h5 text-text-strong-950 outline-none ring-2 ring-primary-base"
    style={{ width: `${Math.max(8, value.length + 2)}ch` }}
  />;
}

/** Saving happens on its own; this only says how it is going. */
function SaveNote({ state, onRetry }: { state: Views["saveState"]; onRetry: () => void }) {
  if (state === "idle") return null;
  if (state === "error") {
    return <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-paragraph-xs text-error-base hover:underline">
      <RiErrorWarningLine className="size-3.5" aria-hidden="true" />Not saved · Retry
    </button>;
  }
  return <span className="inline-flex items-center gap-1 text-paragraph-xs text-text-soft-400" aria-live="polite">
    {state === "saving" ? <RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" /> : <RiCheckLine className="size-3.5" aria-hidden="true" />}
    {state === "saving" ? "Saving…" : "Saved"}
  </span>;
}

/**
 * The Funnel's header: the open view's name as the title (views are picked
 * in the sidebar), a pencil to rename it in place, a menu for New view /
 * Duplicate / Delete, and on the right how saving is going and `actions`
 * (Customize).
 */
export function FunnelHeader({ views, actions }: { views: Views; actions?: React.ReactNode }) {
  const dialogs = useDialogs();
  const { current } = views;
  const [editing, setEditing] = useState(false);

  const askName = (title: string, defaultValue: string, confirmLabel: string) => dialogs.prompt({
    title, label: "Name", defaultValue, placeholder: "e.g. Interested – not booked", confirmLabel,
  }).then((value) => value?.trim().slice(0, VIEW_NAME_MAX) || null);

  const newView = async () => {
    const name = await askName("New view", "", "Create view");
    if (name) await views.create(name);
  };
  const duplicate = async () => {
    if (!current) return;
    const name = await askName("Duplicate view", `${current.name} (copy)`, "Duplicate");
    if (name) await views.create(name, current.config);
  };
  const remove = async () => {
    if (!current) return;
    const ok = await dialogs.confirm({
      title: `Delete “${current.name}”?`,
      description: "The view is removed for everyone in the organization. The leads in it are not touched.",
      confirmLabel: "Delete view",
      variant: "error",
    });
    if (ok) await views.remove(current.id);
  };

  return <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1">
        {editing && current
          ? <InlineName name={current.name} onSave={(name) => void views.rename(current.id, name)} onDone={() => setEditing(false)} />
          : <h1 className={cn("min-w-0 truncate text-title-h5 text-text-strong-950", !current && "text-text-soft-400")}>{current?.name ?? (views.loaded ? "Funnel" : "Loading…")}</h1>}
        {current && !editing && <>
          <button type="button" className={cn(iconButton, "ml-1")} onClick={() => setEditing(true)} aria-label="Rename view" title="Rename"><RiPencilLine className="size-4" /></button>
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <button type="button" className={iconButton} aria-label="View options" title="View options"><RiArrowDownSLine className="size-5" /></button>
            </Dropdown.Trigger>
            <Dropdown.Content align="start" className="w-52">
              <Dropdown.Item onSelect={() => setEditing(true)}><Dropdown.ItemIcon as={RiPencilLine} className="size-4 text-text-sub-600" />Rename</Dropdown.Item>
              <Dropdown.Item onSelect={() => void duplicate()}><Dropdown.ItemIcon as={RiFileCopyLine} className="size-4 text-text-sub-600" />Duplicate</Dropdown.Item>
              <Dropdown.Item onSelect={() => void newView()}><Dropdown.ItemIcon as={RiAddLine} className="size-4 text-text-sub-600" />New view</Dropdown.Item>
              <Dropdown.Separator />
              <Dropdown.Item destructive onSelect={() => void remove()}><Dropdown.ItemIcon as={RiDeleteBinLine} className="size-4" />Delete view</Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Root>
        </>}
      </div>
      <p className="mt-1 text-paragraph-sm text-text-sub-600">A Funnel view, shared with your team. Changes save as you make them.</p>
    </div>
    <div className="flex items-center gap-3 pt-1">
      <SaveNote state={views.saveState} onRetry={views.retrySave} />
      {views.error && views.saveState !== "error" && <span className="max-w-64 truncate text-paragraph-xs text-error-base" title={views.error}>{views.error}</span>}
      {actions}
    </div>
  </header>;
}
