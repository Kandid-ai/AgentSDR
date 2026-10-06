import * as XLSX from "xlsx";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { gridColumns, gridRows } from "./schema";
import { listColumns, toColumnKey, uniqueColumnKey } from "./columns";
import { insertRows } from "./rows";
import { inOrgTables, tableInOrganization } from "./scope";
import type { CellValues, ColumnType, StaticColumnType } from "./types";

/**
 * Ceiling on one import. Higher than the outreach importer's 5,000 because an
 * enrichment table is where a large prospect list lands; it matches the
 * ≤50k-rows-per-table scale target in docs/design/enrichment-plan.md.
 */
export const MAX_IMPORT_ROWS = 50_000;

export type ParsedSheet = {
  headers: string[];
  /** Data rows only — the header row is already removed. */
  rows: string[][];
  /** Row count before MAX_IMPORT_ROWS truncation. */
  totalRows: number;
  truncated: boolean;
};

export type ParseResult =
  | { ok: true; sheet: ParsedSheet; sheetNames: string[] }
  | { ok: false; error: string };

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/**
 * Reads the first row as headers. Accepts .csv, .tsv, .txt and .xlsx alike.
 *
 * The codepage is pinned to UTF-8 for the same reason as
 * outreach/leadImport.ts: without it xlsx guesses a single-byte codepage for
 * plain-text input, so a UTF-8 .csv containing an em-dash, curly quote or
 * accented name imports as mojibake. Real .xlsx carries its own encoding and
 * ignores the hint.
 */
export function parseSpreadsheet(buffer: ArrayBuffer, sheetName?: string): ParseResult {
  let workbook: XLSX.WorkBook;
  try {
    // cellDates matters as much as the codepage: without it xlsx converts any
    // date-looking cell — in CSV as well as .xlsx — into an Excel serial
    // number, so "2024-03-01" arrives as 45352 and infers as a number column.
    workbook = XLSX.read(buffer, { type: "buffer", codepage: 65001, cellDates: true });
  } catch {
    return { ok: false, error: "Could not read that file — is it a valid CSV or Excel file?" };
  }

  const names = workbook.SheetNames;
  if (!names.length) return { ok: false, error: "That file has no sheets" };

  const chosen = sheetName && names.includes(sheetName) ? sheetName : names[0];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[chosen], {
    header: 1,
    blankrows: false,
    defval: "",
  });

  if (!raw.length) return { ok: false, error: "That sheet is empty" };

  const headers = (raw[0] ?? []).map((h) => cell(h));
  if (!headers.some(Boolean)) {
    return { ok: false, error: "The first row is empty — it should hold the column headers" };
  }

  // XLSX can represent a visually blank, formatted Excel row as an array of
  // empty strings. `blankrows: false` does not remove that shape once defval
  // fills missing cells, so drop it before previewing or inserting records.
  const body = raw.slice(1).filter((row) => row.some((value) => cell(value) !== ""));
  const kept = body.slice(0, MAX_IMPORT_ROWS);

  return {
    ok: true,
    sheetNames: names,
    sheet: {
      headers,
      // Pad short rows so every row lines up with the header indices.
      rows: kept.map((r) => headers.map((_, i) => cell(r[i]))),
      totalRows: body.length,
      truncated: body.length > MAX_IMPORT_ROWS,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Type inference                                                              */
/* -------------------------------------------------------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/i;
const NUMBER_RE = /^-?\d[\d,]*(\.\d+)?$/;
const BOOL_VALUES = new Set(["true", "false", "yes", "no", "y", "n", "1", "0"]);

/**
 * Guesses a column type from sample values, so an imported file arrives with
 * sensible types instead of everything being text.
 *
 * Only non-empty samples count, and every one of them has to agree — a single
 * disagreeing value falls back to text, because a wrong type is worse than a
 * loose one: it makes cells uneditable or unparseable.
 */
export function inferColumnType(samples: string[]): StaticColumnType {
  const values = samples.map((s) => s.trim()).filter(Boolean);
  if (!values.length) return "text";

  if (values.every((v) => EMAIL_RE.test(v))) return "email";
  if (values.every((v) => URL_RE.test(v))) return "url";
  if (values.every((v) => BOOL_VALUES.has(v.toLowerCase()))) return "boolean";
  if (values.every((v) => NUMBER_RE.test(v))) return "number";
  if (values.every((v) => !NUMBER_RE.test(v) && !Number.isNaN(Date.parse(v)))) return "date";

  return "text";
}

/** Coerces a cell string into the shape its column type expects. */
export function coerceValue(raw: string, type: ColumnType): unknown {
  const v = raw.trim();
  if (!v) return null;

  switch (type) {
    case "number":
    case "currency": {
      const n = Number(v.replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    case "boolean":
      return ["true", "yes", "y", "1"].includes(v.toLowerCase());
    case "json":
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    case "multiselect":
      return v.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    default:
      return v;
  }
}

/* -------------------------------------------------------------------------- */
/* Mapping + execution                                                         */
/* -------------------------------------------------------------------------- */

export type ColumnMapping =
  /** Write into a column that already exists. */
  | { headerIndex: number; action: "map"; columnKey: string }
  /** Create a new column for this header. */
  | { headerIndex: number; action: "create"; name: string; type: StaticColumnType }
  /** Ignore this file column entirely. */
  | { headerIndex: number; action: "skip" };

/**
 * Default mapping for a freshly-parsed file: reuse an existing column when the
 * header matches one (by key or case-insensitive name), otherwise propose
 * creating one with an inferred type.
 */
export function suggestMapping(
  headers: string[],
  rows: string[][],
  existing: { key: string; name: string }[],
): ColumnMapping[] {
  const byKey = new Map(existing.map((c) => [c.key.toLowerCase(), c]));
  const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c]));

  return headers.map((header, headerIndex) => {
    if (!header.trim()) return { headerIndex, action: "skip" as const };

    const match =
      byKey.get(toColumnKey(header).toLowerCase()) ?? byName.get(header.trim().toLowerCase());

    if (match) return { headerIndex, action: "map" as const, columnKey: match.key };

    const samples = rows.slice(0, 50).map((r) => r[headerIndex] ?? "");
    return {
      headerIndex,
      action: "create" as const,
      name: header.trim(),
      type: inferColumnType(samples),
    };
  });
}

export type ImportResult = {
  rowsInserted: number;
  columnsCreated: number;
  truncated: boolean;
};

/**
 * Fresh tables are seeded with an empty row so a blank grid is immediately
 * editable. An import should replace that placeholder, not append below it.
 */
export function isInitialPlaceholderRow(
  rows: Array<{ cells: Record<string, unknown>; cellMeta: Record<string, unknown> }>,
): boolean {
  return rows.length === 1 && Object.keys(rows[0].cells).length === 0 && Object.keys(rows[0].cellMeta).length === 0;
}

/** New tables carry this editable starter column until their first import. */
export function isInitialSeedColumn(columns: Array<{ key: string; name: string }>): boolean {
  return columns.length === 1 && columns[0].key === "name" && columns[0].name === "New Column";
}

/**
 * Creates any columns the mapping asks for, then inserts the rows.
 *
 * Columns are created first and in one transaction so a failure part-way
 * cannot leave rows referencing a key with no column behind it.
 */
export async function importRows(
  tableId: string,
  sheet: ParsedSheet,
  mapping: ColumnMapping[],
): Promise<ImportResult> {
  if (!(await tableInOrganization(tableId))) throw new Error("That table no longer exists");
  const [existing, existingRows] = await Promise.all([
    listColumns(tableId),
    db
      .select({ id: gridRows.id, cells: gridRows.cells, cellMeta: gridRows.cellMeta })
      .from(gridRows)
      .where(and(inOrgTables(gridRows.tableId), eq(gridRows.tableId, tableId)))
      .orderBy(asc(gridRows.position))
      .limit(2),
  ]);
  const placeholderId = isInitialPlaceholderRow(existingRows) ? existingRows[0].id : null;
  const canReuseSeedColumn = Boolean(placeholderId && isInitialSeedColumn(existing));
  const taken = new Set(existing.map((c) => c.key));

  // A fresh grid has a placeholder row and a "New Column" column. Reuse that
  // column for the first imported field instead of leaving an empty column in
  // front of the imported data. Prefer an explicit mapping to it (e.g. a
  // "Name" header); otherwise promote the first newly-created file column.
  const seedMapping = canReuseSeedColumn
    ? mapping.find((m) => m.action === "map" && m.columnKey === existing[0].key)
      ?? mapping.find((m) => m.action === "create")
    : undefined;
  const creates = mapping.filter(
    (m): m is Extract<ColumnMapping, { action: "create" }> => m.action === "create" && m !== seedMapping,
  );
  let position = existing.reduce((max, c) => Math.max(max, c.position), 0);

  /** headerIndex -> the column key its values land in. */
  const target = new Map<number, string>();
  for (const m of mapping) {
    if (m.action === "map") target.set(m.headerIndex, m.columnKey);
  }

  if (seedMapping) {
    const seed = existing[0];
    const nextName = seedMapping.action === "create"
      ? seedMapping.name.trim()
      : sheet.headers[seedMapping.headerIndex]?.trim() || seed.name;
    const nextType: ColumnType = seedMapping.action === "create" ? seedMapping.type : seed.type;
    await db
      .update(gridColumns)
      .set({ name: nextName || seed.name, type: nextType, updatedAt: new Date() })
      .where(eq(gridColumns.id, seed.id));
    target.set(seedMapping.headerIndex, seed.key);
  }

  if (creates.length) {
    const toInsert = creates.map((m) => {
      const key = uniqueColumnKey(m.name, taken);
      taken.add(key);
      position += 1;
      target.set(m.headerIndex, key);
      return {
        tableId,
        key,
        name: m.name.trim() || key,
        type: m.type as ColumnType,
        config: {},
        dependsOn: [],
        position,
      };
    });

    await db.transaction(async (tx) => {
      await tx.insert(gridColumns).values(toInsert);
    });
  }

  // Type per target key, so values are coerced the way their column expects.
  const typeByKey = new Map<string, ColumnType>(existing.map((c) => [c.key, c.type]));
  if (seedMapping && seedMapping.action === "create") {
    typeByKey.set(existing[0].key, seedMapping.type);
  }
  for (const m of creates) {
    const key = target.get(m.headerIndex);
    if (key) typeByKey.set(key, m.type);
  }

  const records: CellValues[] = sheet.rows.map((row) => {
    const out: CellValues = {};
    for (const [headerIndex, key] of target) {
      const value = coerceValue(row[headerIndex] ?? "", typeByKey.get(key) ?? "text");
      if (value !== null) out[key] = value;
    }
    return out;
  }).filter((record) => Object.keys(record).length > 0);

  const rowsInserted = await insertRows(tableId, records);

  // Insert before deleting so a failed import leaves a fresh table usable.
  // Re-check the JSONB fields in the DELETE in case another editor populated
  // the placeholder while the import was being parsed.
  if (rowsInserted > 0 && placeholderId) {
    await db
      .delete(gridRows)
      .where(and(
        inOrgTables(gridRows.tableId),
        eq(gridRows.id, placeholderId),
        sql`${gridRows.cells} = '{}'::jsonb`,
        sql`${gridRows.cellMeta} = '{}'::jsonb`,
      ));
  }

  return { rowsInserted, columnsCreated: creates.length, truncated: sheet.truncated };
}
