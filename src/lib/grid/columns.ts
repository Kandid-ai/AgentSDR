import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inOrg } from "@/lib/tenancy/scope";
import { inOrgTables, tableInOrganization } from "./scope";
import { gridColumns, gridRows, gridTables, type GridColumn } from "./schema";
import { getIntegrationAction } from "@/lib/integrations/catalog";
import { getAiModel, promptColumnKeys } from "@/lib/ai/catalog";
import type {
  AiConfig,
  AiOutputConfig,
  ColumnConfig,
  ColumnType,
  EnrichmentConfig,
  FormulaConfig,
  HttpConfig,
  IntegrationOutputConfig,
  TableView,
} from "./types";
import { isStaticColumnType } from "./types";
import { resolveDeps } from "./runners";
import { isResponseOutputKey } from "./json-pointer";
import { effectiveColumnType } from "./value-types";
import { resolveFormulaConfig } from "./formula-lookups";

// ---------------------------------------------------------------------------
// Column keys
// ---------------------------------------------------------------------------

/**
 * "Job Title" -> "jobTitle".
 *
 * Deliberately the same shape as toCamelCaseKey() in outreach/leadImport.ts,
 * because an unmapped grid/file column pushed into a campaign lands in
 * people.raw and has to resolve as {{jobTitle}} through
 * outreach/scheduler.ts. This version additionally strips punctuation, so
 * "Email (work)" yields a usable token rather than "email(work)".
 */
export function toColumnKey(label: string): string {
  const words = label
    .trim()
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const key = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
  // A key starting with a digit is legal JSON but confusing in a {{token}};
  // prefix it so it stays a readable identifier.
  return /^[0-9]/.test(key) ? `c${key}` : key;
}

/** Appends a numeric suffix until the key is free within the table. */
export function uniqueColumnKey(label: string, taken: Set<string>): string {
  const base = toColumnKey(label) || "column";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

// ---------------------------------------------------------------------------
// Dependency resolution — the DAG edges
// ---------------------------------------------------------------------------

/**
 * Which column keys a config reads — the DAG edges.
 *
 * Delegated to the runner registry so each runner owns the answer for its own
 * config shape. Two copies of this logic would drift the moment a runner grew
 * a new templated field.
 */
export { resolveDeps } from "./runners";

/** Reject malformed runnable configs even when callers bypass the UI. */
export function validateColumnConfig(
  type: ColumnType,
  config: ColumnConfig,
  columns: Pick<GridColumn, "key" | "type">[] = [],
): void {
  if (type === "formula") {
    const expression = (config as FormulaConfig).expression;
    if (typeof expression !== "string" || !expression.trim()) {
      throw new Error("Formula expression is required");
    }
  }

  if (type === "http") {
    const http = config as HttpConfig;
    if (!(["GET", "POST", "PUT", "PATCH"] as const).includes(http.method)) {
      throw new Error("HTTP method must be GET, POST, PUT, or PATCH");
    }
    if (typeof http.url !== "string" || !http.url.trim()) {
      throw new Error("HTTP URL is required");
    }
    if (http.costCents !== undefined && (!Number.isFinite(http.costCents) || http.costCents < 0)) {
      throw new Error("HTTP cost must be zero or a positive number");
    }
  }

  if (type === "enrichment") {
    const enrichment = config as EnrichmentConfig;
    const action = getIntegrationAction(enrichment.integrationKey, enrichment.actionKey);
    if (!action) throw new Error("Unknown integration action");
    if (enrichment.handlerKey !== action.handlerKey) throw new Error("Integration handler does not match the action");
    if (!enrichment.connectionId) throw new Error("Select a connected integration account");
    if (
      enrichment.delaySeconds !== undefined &&
      (!Number.isInteger(enrichment.delaySeconds) || enrichment.delaySeconds < 0 || enrichment.delaySeconds > 600)
    ) {
      throw new Error("Run delay must be between 0 and 600 seconds");
    }
    const knownInputs = new Set(action.inputs.map((input) => input.key));
    if (Object.keys(enrichment.inputs ?? {}).some((key) => !knownInputs.has(key))) {
      throw new Error("The enrichment contains an unknown input");
    }

    if (action.filterBuilder) {
      const mappedFilters = action.inputs.filter(
        (input) => input.group === "filter" && enrichment.inputs?.[input.key]?.columnKey,
      );
      if (mappedFilters.length < action.filterBuilder.minFilters) {
        throw new Error(
          `Map at least ${action.filterBuilder.minFilters} search filter${action.filterBuilder.minFilters === 1 ? "" : "s"}`,
        );
      }
    }

    for (const input of action.inputs) {
      const binding = enrichment.inputs?.[input.key];
      if (!binding && input.required) throw new Error(`${input.name} is required`);
      if (!binding) continue;
      if (binding.source !== "column" || !binding.columnKey) {
        throw new Error(`${input.name} must be mapped to a column`);
      }
      const source = columns.find((column) => column.key === binding.columnKey);
      if (!source) throw new Error(`${input.name} references a missing column`);
      const sourceType = effectiveColumnType(source);
      if (!input.acceptedColumnTypes.some((accepted) => accepted === sourceType)) {
        throw new Error(`${input.name} cannot use a ${sourceType} column`);
      }
    }

    const selectedOutputs = Object.keys(enrichment.outputs ?? {});
    if (!selectedOutputs.length) throw new Error("Select at least one output");
    const knownOutputs = new Set(action.outputs.map((output) => output.key));
    if (selectedOutputs.some((key) => !knownOutputs.has(key) && !isResponseOutputKey(key))) {
      throw new Error("The enrichment contains an unknown output");
    }
  }

  if (type === "ai") {
    const ai = config as AiConfig;
    const model = getAiModel(ai.providerKey, ai.modelKey, ai.useCase);
    if (!model) throw new Error("Select an AI model");
    if (!model.useCases.includes(ai.useCase)) {
      throw new Error(`${model.name} cannot be used for this use case`);
    }
    if (!ai.connectionId) throw new Error("Connect an AI provider account");
    if (typeof ai.prompt !== "string" || !ai.prompt.trim()) {
      throw new Error("A prompt is required");
    }

    // Every {{token}} must name a real column, or the prompt silently reaches
    // the model with a blank where the user expected data.
    const known = new Set(columns.map((column) => column.key));
    const missing = promptColumnKeys(ai.prompt).find((key) => !known.has(key));
    if (missing) throw new Error(`The prompt references a missing column: ${missing}`);

    if (ai.outputFormat === "json_schema") {
      if (!ai.jsonSchema || typeof ai.jsonSchema !== "object") {
        throw new Error("Provide a JSON Schema, or switch the output format to Fields");
      }
    } else {
      if (!ai.outputs?.length) throw new Error("Add at least one output field");
      const keys = new Set<string>();
      for (const field of ai.outputs) {
        if (!field.key?.trim() || !field.name?.trim()) {
          throw new Error("Every output needs a name");
        }
        if (keys.has(field.key)) throw new Error(`Duplicate output field: ${field.key}`);
        keys.add(field.key);
        if (!isStaticColumnType(field.type)) {
          throw new Error(`${field.name} has an invalid output type`);
        }
      }
    }

    if (
      ai.delaySeconds !== undefined &&
      (!Number.isInteger(ai.delaySeconds) || ai.delaySeconds < 0 || ai.delaySeconds > 600)
    ) {
      throw new Error("Run delay must be between 0 and 600 seconds");
    }
  }

  if (type === "integration_output") {
    const output = config as IntegrationOutputConfig;
    if (!output.integrationKey || !output.actionKey || !output.sourceColumnKey || !output.outputKey) {
      throw new Error("Integration output configuration is incomplete");
    }
    if (output.valueType && !isStaticColumnType(output.valueType)) {
      throw new Error("Integration output value type is invalid");
    }
  }

  if (type === "ai_output") {
    const output = config as AiOutputConfig;
    if (!output.sourceColumnKey || !output.outputKey) {
      throw new Error("AI output configuration is incomplete");
    }
    if (!isStaticColumnType(output.valueType)) {
      throw new Error("AI output value type is invalid");
    }
  }
}

/**
 * Throws if adding/updating `candidate` would create a cycle.
 *
 * Cycles are rejected here, at save time, rather than being discovered by a
 * worker mid-run — a cyclic graph would otherwise enqueue cells forever.
 */
export function assertNoCycle(
  columns: Pick<GridColumn, "key" | "dependsOn">[],
  candidate: { key: string; dependsOn: string[] },
): void {
  const graph = new Map<string, string[]>();
  for (const c of columns) {
    if (c.key === candidate.key) continue;
    graph.set(c.key, c.dependsOn);
  }
  graph.set(candidate.key, candidate.dependsOn);

  const state = new Map<string, "visiting" | "done">();

  const visit = (key: string, path: string[]): void => {
    const s = state.get(key);
    if (s === "done") return;
    if (s === "visiting") {
      const cycle = [...path.slice(path.indexOf(key)), key].join(" → ");
      throw new Error(`Circular dependency: ${cycle}`);
    }
    state.set(key, "visiting");
    for (const dep of graph.get(key) ?? []) visit(dep, [...path, key]);
    state.set(key, "done");
  };

  for (const key of graph.keys()) visit(key, []);
}

/** Columns ordered so every column appears after everything it depends on. */
export function topoSort(columns: GridColumn[]): GridColumn[] {
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const state = new Map<string, "visiting" | "done">();
  const out: GridColumn[] = [];

  const visit = (key: string) => {
    if (state.get(key) === "done") return;
    if (state.get(key) === "visiting") throw new Error(`Circular dependency at "${key}"`);
    const col = byKey.get(key);
    if (!col) return; // dependency on a deleted column — treated as a constant
    state.set(key, "visiting");
    for (const dep of col.dependsOn) visit(dep);
    state.set(key, "done");
    out.push(col);
  };

  for (const c of columns) visit(c.key);
  return out;
}

/** Direct dependents — the cascade set when a cell finishes. */
export function columnsDependingOn(columns: GridColumn[], key: string): GridColumn[] {
  return columns.filter((c) => c.dependsOn.includes(key));
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listColumns(tableId: string): Promise<GridColumn[]> {
  return db
    .select()
    .from(gridColumns)
    .where(and(inOrgTables(gridColumns.tableId), eq(gridColumns.tableId, tableId)))
    .orderBy(asc(gridColumns.position));
}

export async function createColumn(input: {
  tableId: string;
  name: string;
  type: ColumnType;
  config?: ColumnConfig;
  autoRun?: boolean;
  /** Insert after this column; appended to the end when omitted. */
  afterColumnId?: string;
  /** Insert immediately before this column. Takes precedence over afterColumnId. */
  beforeColumnId?: string;
}): Promise<GridColumn> {
  if (!(await tableInOrganization(input.tableId))) throw new Error("That table no longer exists");
  const existing = await listColumns(input.tableId);
  const key = uniqueColumnKey(input.name, new Set(existing.map((c) => c.key)));
  const config = input.type === "formula"
    ? await resolveFormulaConfig(input.tableId, (input.config as FormulaConfig | undefined)?.expression ?? "")
    : input.config ?? {};
  validateColumnConfig(input.type, config, existing);
  const dependsOn = resolveDeps(input.type, config);

  assertNoCycle(existing, { key, dependsOn });

  const [column] = await db
    .insert(gridColumns)
    .values({
      tableId: input.tableId,
      key,
      name: input.name.trim(),
      type: input.type,
      config,
      autoRun: input.autoRun ?? true,
      dependsOn,
      position: input.beforeColumnId
        ? positionBefore(existing, input.beforeColumnId)
        : nextPosition(existing, input.afterColumnId),
    })
    .returning();

  return column;
}

export async function updateColumn(
  id: string,
  patch: { name?: string; type?: ColumnType; config?: ColumnConfig; autoRun?: boolean },
): Promise<GridColumn | null> {
  const [current] = await db
    .select()
    .from(gridColumns)
    .where(and(inOrgTables(gridColumns.tableId), eq(gridColumns.id, id)))
    .limit(1);
  if (!current) return null;

  const values: Record<string, unknown> = { updatedAt: new Date() };
  // `name` is cosmetic; `key` deliberately never changes, so a rename here
  // does not touch a single row's JSONB.
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.autoRun !== undefined) values.autoRun = patch.autoRun;

  if (patch.type !== undefined || patch.config !== undefined) {
    const type = patch.type ?? current.type;
    const candidateConfig = patch.config ?? current.config;
    const config = type === "formula"
      ? await resolveFormulaConfig(
          current.tableId,
          (candidateConfig as FormulaConfig).expression ?? "",
          current.type === "formula" ? (current.config as FormulaConfig).lookupRefs : [],
        )
      : candidateConfig;
    const siblings = await listColumns(current.tableId);
    validateColumnConfig(type, config, siblings);
    const dependsOn = resolveDeps(type, config);
    assertNoCycle(siblings, { key: current.key, dependsOn });

    values.type = type;
    values.config = config;
    values.dependsOn = dependsOn;
  }

  const [row] = await db
    .update(gridColumns)
    .set(values)
    .where(and(inOrgTables(gridColumns.tableId), eq(gridColumns.id, id)))
    .returning();
  return row ?? null;
}

/**
 * Deletes a column and strips its key from every row's JSONB.
 *
 * The strip is not cosmetic: leaving the key behind means a later column
 * created with the same key would silently inherit the old values.
 */
export async function deleteColumn(id: string): Promise<boolean> {
  const [column] = await db
    .select()
    .from(gridColumns)
    .where(and(inOrgTables(gridColumns.tableId), eq(gridColumns.id, id)))
    .limit(1);
  if (!column) return false;

  const siblings = await listColumns(column.tableId);
  const dependents = siblings.filter((candidate) => candidate.dependsOn.includes(column.key));
  if (dependents.length) {
    throw new Error(
      `Column is used by: ${dependents.map((candidate) => candidate.name).join(", ")}`,
    );
  }

  const [sourceTable] = await db
    .select({ workbookId: gridTables.workbookId })
    .from(gridTables)
    .where(and(inOrg(gridTables), eq(gridTables.id, column.tableId)))
    .limit(1);
  if (sourceTable) {
    const workbookTables = await db
      .select({ id: gridTables.id })
      .from(gridTables)
      .where(and(inOrg(gridTables), eq(gridTables.workbookId, sourceTable.workbookId)));
    const formulaColumns = workbookTables.length
      ? await db.select().from(gridColumns).where(inArray(gridColumns.tableId, workbookTables.map((table) => table.id)))
      : [];
    const lookupDependents = formulaColumns.filter((candidate) =>
      candidate.type === "formula"
      && (candidate.config as FormulaConfig).lookupRefs?.some((ref) =>
        ref.tableId === column.tableId
        && (ref.lookupColumnKey === column.key || ref.returnColumnKey === column.key),
      ),
    );
    if (lookupDependents.length) {
      throw new Error(
        `Column is used by cross-table formula${lookupDependents.length === 1 ? "" : "s"}: ${lookupDependents.map((candidate) => candidate.name).join(", ")}`,
      );
    }
  }

  const [table] = await db
    .select({ view: gridTables.view })
    .from(gridTables)
    .where(and(inOrg(gridTables), eq(gridTables.id, column.tableId)))
    .limit(1);
  const nextView = removeColumnFromView((table?.view ?? {}) as TableView, column.key);

  await db.transaction(async (tx) => {
    await tx.delete(gridColumns).where(and(inOrgTables(gridColumns.tableId), eq(gridColumns.id, id)));
    await tx
      .update(gridTables)
      .set({ view: nextView, updatedAt: new Date() })
      .where(and(inOrg(gridTables), eq(gridTables.id, column.tableId)));
    await tx
      .update(gridRows)
      .set({
        cells: sql`${gridRows.cells} - ${column.key}`,
        cellMeta: sql`${gridRows.cellMeta} - ${column.key}`,
        version: sql`nextval('grid_row_version_seq')`,
        updatedAt: new Date(),
      })
      .where(and(inOrgTables(gridRows.tableId), eq(gridRows.tableId, column.tableId)));
  });

  return true;
}

function removeColumnFromView(view: TableView, columnKey: string): TableView {
  const cleanConditions = (conditions: unknown[]): unknown[] =>
    conditions
      .map((condition) => {
        if (!condition || typeof condition !== "object") return condition;
        if ("conditions" in condition && Array.isArray(condition.conditions)) {
          return { ...condition, conditions: cleanConditions(condition.conditions) };
        }
        if ("columnKey" in condition && condition.columnKey === columnKey) return null;
        return condition;
      })
      .filter((condition) => condition !== null);

  return {
    ...view,
    hiddenColumns: view.hiddenColumns?.filter((key) => key !== columnKey),
    pinnedColumns: view.pinnedColumns?.filter((key) => key !== columnKey),
    sorts: view.sorts?.filter((sort) => sort.columnKey !== columnKey),
    filters: view.filters
      ? { ...view.filters, conditions: cleanConditions(view.filters.conditions) }
      : undefined,
  };
}

/** Fractional reposition — moving a column rewrites one row, not the table. */
export async function moveColumn(id: string, afterColumnId: string | null): Promise<GridColumn | null> {
  const [column] = await db
    .select()
    .from(gridColumns)
    .where(and(inOrgTables(gridColumns.tableId), eq(gridColumns.id, id)))
    .limit(1);
  if (!column) return null;

  const siblings = (await listColumns(column.tableId)).filter((c) => c.id !== id);
  const [row] = await db
    .update(gridColumns)
    .set({ position: nextPosition(siblings, afterColumnId ?? undefined, true), updatedAt: new Date() })
    .where(and(inOrgTables(gridColumns.tableId), eq(gridColumns.id, id)))
    .returning();

  return row ?? null;
}

/**
 * Position midway between the anchor and the next item, so inserts never
 * renumber neighbours. `atStartWhenNoAnchor` distinguishes "append" (new
 * column) from "move to front" (reorder with a null anchor).
 */
function nextPosition(
  ordered: { id: string; position: number }[],
  afterId?: string,
  atStartWhenNoAnchor = false,
): number {
  if (!afterId) {
    if (!ordered.length) return 1;
    return atStartWhenNoAnchor
      ? ordered[0].position / 2
      : ordered[ordered.length - 1].position + 1;
  }
  const idx = ordered.findIndex((c) => c.id === afterId);
  if (idx === -1) return (ordered[ordered.length - 1]?.position ?? 0) + 1;
  const before = ordered[idx].position;
  const after = ordered[idx + 1]?.position;
  return after === undefined ? before + 1 : (before + after) / 2;
}

/** Position immediately before an existing column without renumbering siblings. */
function positionBefore(
  ordered: { id: string; position: number }[],
  beforeId: string,
): number {
  const idx = ordered.findIndex((column) => column.id === beforeId);
  if (idx === -1) return (ordered[ordered.length - 1]?.position ?? 0) + 1;
  if (idx === 0) return ordered[0].position / 2;
  return (ordered[idx - 1].position + ordered[idx].position) / 2;
}
