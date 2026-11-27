"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * How a person has arranged the pipeline board: which parts of a card show,
 * and, on the by-stage board, which columns show and in what order. Kept in
 * this browser only (a per-viewer convenience, like a remembered tab), so it
 * must render correctly when storage is empty or blocked.
 */

export const CARD_FIELDS = [
  { key: "company", label: "Company", detail: "Domain or company name under the lead's name" },
  { key: "stage", label: "Stage", detail: "The stage picker, and the AI's proposed change" },
  { key: "reply", label: "Their last reply", detail: "Or the call a call-only lead follows" },
  { key: "draft", label: "Draft reply", detail: "The waiting draft, with Edit and Send" },
  { key: "lastContact", label: "Last contact", detail: "When either side last wrote, and who" },
  { key: "status", label: "Status", detail: "What is due or scheduled next" },
  { key: "sequence", label: "Sequence", detail: "The follow-up sequence and its step" },
] as const;
export type CardField = (typeof CARD_FIELDS)[number]["key"];

export type BoardSettings = {
  hiddenFields: CardField[];
  /** Column keys (a sub-stage id, or `none:<category>`) left off the by-stage board. */
  hiddenColumns: string[];
  /** The by-stage board's column order as last arranged; columns it does not name follow, in funnel order. */
  columnOrder: string[];
  showEmptyColumns: boolean;
};

export const DEFAULT_BOARD_SETTINGS: BoardSettings = { hiddenFields: [], hiddenColumns: [], columnOrder: [], showEmptyColumns: false };

const STORAGE_KEY = "agentsdr.pipeline.board.v1";
const FIELD_KEYS = new Set<string>(CARD_FIELDS.map((field) => field.key));

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function read(): BoardSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BOARD_SETTINGS;
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      hiddenFields: strings(value.hiddenFields).filter((key): key is CardField => FIELD_KEYS.has(key)),
      hiddenColumns: strings(value.hiddenColumns),
      columnOrder: strings(value.columnOrder),
      showEmptyColumns: value.showEmptyColumns === true,
    };
  } catch {
    return DEFAULT_BOARD_SETTINGS;
  }
}

export function useBoardSettings() {
  const [settings, setSettings] = useState<BoardSettings>(DEFAULT_BOARD_SETTINGS);
  // Read after mount: the server render has no storage, and the first client
  // render must match it.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSettings(read()); }, []);
  const update = useCallback((change: (old: BoardSettings) => BoardSettings) => {
    setSettings((old) => {
      const next = change(old);
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  return { settings, update };
}

export function toggled<T>(list: readonly T[], item: T, on: boolean): T[] {
  return on ? list.filter((value) => value !== item) : [...list.filter((value) => value !== item), item];
}

/** `keys` reordered so `from` sits where `to` was. */
export function moved(keys: readonly string[], from: string, to: string): string[] {
  const fromIndex = keys.indexOf(from);
  const toIndex = keys.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return [...keys];
  const next = keys.filter((key) => key !== from);
  next.splice(toIndex, 0, from);
  return next;
}

/** `items` in the saved order; any the order does not name keep their own relative order after it. */
export function ordered<T extends { key: string }>(items: readonly T[], order: readonly string[]): T[] {
  const position = new Map(order.map((key, index) => [key, index]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (position.get(a.item.key) ?? order.length + a.index) - (position.get(b.item.key) ?? order.length + b.index))
    .map(({ item }) => item);
}
