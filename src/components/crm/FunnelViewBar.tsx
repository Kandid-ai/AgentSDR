"use client";

import { RiAddLine, RiArrowDownSLine, RiCheckLine, RiDeleteBinLine, RiFileCopyLine, RiPencilLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import { useDialogs } from "@/components/DialogProvider";
import { DEFAULT_VIEW_CONFIG, VIEW_NAME_MAX, type BoardView } from "@/lib/crm/boardViews";
import type { useFunnelViews } from "./useFunnelViews";

type Views = ReturnType<typeof useFunnelViews>;

/**
 * The view picker, after Jira's board switcher: the current view's name
 * opens the list of the organization's views, with New view, and Rename /
 * Duplicate / Delete for the one open. Once the page differs from the saved
 * view, Save, Save as new and Discard appear beside it.
 */
export function FunnelViewBar({ views }: { views: Views }) {
  const dialogs = useDialogs();
  const { current } = views;

  const askName = (title: string, defaultValue: string, confirmLabel: string) => dialogs.prompt({
    title,
    label: "Name",
    defaultValue,
    placeholder: "e.g. Interested – not booked",
    confirmLabel,
  }).then((value) => value?.trim().slice(0, VIEW_NAME_MAX) || null);

  const newView = async () => {
    const name = await askName("New view", "", "Create view");
    if (name) await views.create(name, { ...DEFAULT_VIEW_CONFIG });
  };
  const saveAsNew = async () => {
    const name = await askName("Save as a new view", current ? `${current.name} (copy)` : "", "Save view");
    if (name) await views.create(name);
  };
  const duplicate = async (view: BoardView) => {
    const name = await askName("Duplicate view", `${view.name} (copy)`, "Duplicate");
    if (name) await views.create(name, view.config);
  };
  const rename = async (view: BoardView) => {
    const name = await askName("Rename view", view.name, "Rename");
    if (name && name !== view.name) await views.rename(view.id, name);
  };
  const remove = async (view: BoardView) => {
    const ok = await dialogs.confirm({
      title: `Delete “${view.name}”?`,
      description: "The view is removed for everyone in the organization. The leads in it are not touched.",
      confirmLabel: "Delete view",
      variant: "error",
    });
    if (ok) await views.remove(view.id);
  };

  return <div className="flex flex-wrap items-center gap-2">
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button type="button" className="group inline-flex h-9 max-w-full items-center gap-2 rounded-xl bg-bg-white-0 pl-3 pr-2 text-label-md text-text-strong-950 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 outline-none transition hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-base" aria-label="Choose a view">
          <span className="truncate">{current?.name ?? (views.loaded ? "No view" : "Loading views…")}</span>
          {views.dirty && <span className="size-1.5 shrink-0 rounded-full bg-warning-base" title="Unsaved changes" aria-label="unsaved changes" />}
          <RiArrowDownSLine className="size-5 shrink-0 text-text-soft-400 transition group-data-[state=open]:rotate-180" aria-hidden="true" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Content align="start" className="w-72">
        <p className="px-2 pb-1 pt-0.5 text-label-xs uppercase tracking-wide text-text-soft-400">Views</p>
        {views.views.map((view) => <Dropdown.Item key={view.id} onSelect={() => views.select(view.id)}>
          <span className="min-w-0 flex-1 truncate">{view.name}</span>
          {view.id === current?.id && <Dropdown.ItemIcon as={RiCheckLine} className="size-4 text-primary-base" />}
        </Dropdown.Item>)}
        <Dropdown.Item onSelect={() => void newView()}><Dropdown.ItemIcon as={RiAddLine} className="size-4 text-text-sub-600" />New view</Dropdown.Item>
        {current && <>
          <Dropdown.Separator />
          <p className="px-2 pb-1 pt-0.5 text-label-xs uppercase tracking-wide text-text-soft-400">This view</p>
          <Dropdown.Item onSelect={() => void rename(current)}><Dropdown.ItemIcon as={RiPencilLine} className="size-4 text-text-sub-600" />Rename</Dropdown.Item>
          <Dropdown.Item onSelect={() => void duplicate(current)}><Dropdown.ItemIcon as={RiFileCopyLine} className="size-4 text-text-sub-600" />Duplicate</Dropdown.Item>
          <Dropdown.Item destructive onSelect={() => void remove(current)}><Dropdown.ItemIcon as={RiDeleteBinLine} className="size-4" />Delete</Dropdown.Item>
        </>}
      </Dropdown.Content>
    </Dropdown.Root>

    {views.dirty && <div className="flex items-center gap-1.5">
      <Button.Root variant="primary" mode="filled" size="xsmall" disabled={views.saving} onClick={() => void views.save()}>{views.saving ? "Saving…" : "Save"}</Button.Root>
      <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={views.saving} onClick={() => void saveAsNew()}>Save as new</Button.Root>
      <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={views.saving} onClick={views.discard}>Discard</Button.Root>
    </div>}
    {views.error && <span className="text-paragraph-xs text-error-base">{views.error}</span>}
  </div>;
}
