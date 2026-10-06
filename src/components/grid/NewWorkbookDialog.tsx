"use client";

import { useEffect, useRef, useState } from "react";
import { RiFileExcel2Line, RiLoader4Line, RiTableLine } from "@remixicon/react";
import * as Modal from "@/components/alignui/modal";
import WorkbookIcon from "./WorkbookIcon";

type CreatedWorkbook = { workbook: { id: string }; table: { id: string } };

export default function NewWorkbookDialog({
  open,
  folderId,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** Where the new workbook is filed. NULL = the root of All Files. */
  folderId?: string | null;
  onClose: () => void;
  onCreated: (workbookId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: effect resets/seeds local state when props or open state change; deriving during render would change timing
    if (!open) setError(null);
  }, [open]);

  async function createWorkbook(name: string): Promise<CreatedWorkbook> {
    const response = await fetch("/api/grid/workbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, folderId: folderId ?? null }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Could not create workbook");
    return data;
  }

  async function createBlank() {
    setBusy(true);
    setError(null);
    try {
      const created = await createWorkbook("Untitled workbook");
      onCreated(created.workbook.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create workbook");
    } finally {
      setBusy(false);
    }
  }

  async function createFromFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    let created: CreatedWorkbook | null = null;

    try {
      const name = file.name.replace(/\.(csv|tsv|txt|xlsx|xls)$/i, "").trim() || "Untitled workbook";
      created = await createWorkbook(name);

      const previewForm = new FormData();
      previewForm.append("file", file);
      const previewResponse = await fetch(`/api/grid/tables/${created.table.id}/import`, {
        method: "POST",
        body: previewForm,
      });
      const preview = await previewResponse.json().catch(() => ({}));
      if (!previewResponse.ok) throw new Error(preview.error ?? "Could not read that file");

      const importForm = new FormData();
      importForm.append("file", file);
      importForm.append("mapping", JSON.stringify(preview.mapping));
      const importResponse = await fetch(`/api/grid/tables/${created.table.id}/import`, {
        method: "POST",
        body: importForm,
      });
      const result = await importResponse.json().catch(() => ({}));
      if (!importResponse.ok) throw new Error(result.error ?? "Could not import that file");

      onCreated(created.workbook.id);
    } catch (cause) {
      if (created) {
        await fetch(`/api/grid/workbooks/${created.workbook.id}`, { method: "DELETE" }).catch(() => undefined);
      }
      setError(cause instanceof Error ? cause.message : "Could not import that file");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Modal.Root open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <Modal.Content size="max-w-lg">
        <Modal.Header icon={WorkbookIcon}>
          <Modal.Title>Create a workbook</Modal.Title>
          <Modal.Description>
            {folderId
              ? "It will be created in the folder you are viewing."
              : "Start empty or import an existing spreadsheet."}
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="pt-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void createBlank()}
              disabled={busy}
              className="rounded-2xl p-5 text-left ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-weak-50 disabled:opacity-50"
            >
              <span className="mb-4 flex size-10 items-center justify-center rounded-10 bg-primary-alpha-10 text-primary-base">
                <RiTableLine className="size-5" />
              </span>
              <span className="block text-label-sm text-text-strong-950">Blank workbook</span>
              <span className="mt-1 block text-paragraph-xs text-text-sub-600">
                Start with an empty custom table.
              </span>
            </button>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-2xl p-5 text-left ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-weak-50 disabled:opacity-50"
            >
              <span className="mb-4 flex size-10 items-center justify-center rounded-10 bg-success-lighter text-success-base">
                <RiFileExcel2Line className="size-5" />
              </span>
              <span className="block text-label-sm text-text-strong-950">CSV or Excel</span>
              <span className="mt-1 block text-paragraph-xs text-text-sub-600">
                Create a workbook from a spreadsheet.
              </span>
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            className="hidden"
            onChange={(event) => void createFromFile(event.target.files?.[0])}
          />

          {busy && (
            <p className="mt-4 flex items-center gap-2 text-paragraph-sm text-text-sub-600">
              <RiLoader4Line className="size-4 animate-spin" />Creating your workbook…
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-lg bg-red-alpha-10 px-3 py-2 text-paragraph-sm text-error-base">{error}</p>
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
