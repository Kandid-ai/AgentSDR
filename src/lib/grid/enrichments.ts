import { db } from "@/lib/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { getIntegrationAction } from "@/lib/integrations/catalog";
import { gridCellRuns, gridColumns, gridRows, type GridColumn } from "./schema";
import { inOrgTables, tableInOrganization } from "./scope";
import { assertNoCycle, listColumns, uniqueColumnKey, validateColumnConfig } from "./columns";
import { getIntegrationConnection } from "./providers";
import { responseOutputKey, valueAtJsonPointer } from "./json-pointer";
import type { EnrichmentConfig, IntegrationOutputConfig } from "./types";
import { inferResponseValueType } from "./value-types";

export async function createEnrichmentColumns(input: {
  tableId: string;
  integrationKey: string;
  actionKey: string;
  inputs: Record<string, string>;
  selectedOutputs: string[];
  connectionId: string;
  autoRun: boolean;
  runCondition?: string;
  delaySeconds?: number;
  runInBatches?: boolean;
  afterColumnId?: string;
  beforeColumnId?: string;
}): Promise<GridColumn[]> {
  const action = getIntegrationAction(input.integrationKey, input.actionKey);
  if (!action) throw new Error("Unknown integration action");
  const connection = await getIntegrationConnection(input.connectionId);
  if (!connection || connection.integrationKey !== input.integrationKey || !connection.verified) {
    throw new Error("Select a verified integration account before saving");
  }

  if (!(await tableInOrganization(input.tableId))) throw new Error("That table no longer exists");
  const existing = await listColumns(input.tableId);
  const selected = action.outputs.filter((output) => input.selectedOutputs.includes(output.key));
  if (!selected.length) throw new Error("Select at least one output");
  if (selected.length !== new Set(input.selectedOutputs).size) {
    throw new Error("One or more selected outputs are invalid");
  }

  const bindings = Object.fromEntries(
    Object.entries(input.inputs).map(([key, columnKey]) => [key, { source: "column" as const, columnKey }]),
  );

  const taken = new Set(existing.map((column) => column.key));
  const outputKeys = new Map<string, string>();
  for (const output of selected) {
    const key = uniqueColumnKey(output.name, taken);
    taken.add(key);
    outputKeys.set(output.key, key);
  }

  const actionColumnKey = uniqueColumnKey(action.name, taken);
  taken.add(actionColumnKey);
  const config: EnrichmentConfig = {
    integrationKey: input.integrationKey,
    actionKey: input.actionKey,
    handlerKey: action.handlerKey,
    inputs: bindings,
    outputs: Object.fromEntries(outputKeys),
    connectionId: input.connectionId,
    runCondition: input.runCondition?.trim() || undefined,
    delaySeconds: input.delaySeconds,
    runInBatches: input.runInBatches,
  };
  validateColumnConfig("enrichment", config, existing);

  const positions = insertionPositions(
    existing,
    selected.length + 1,
    input.beforeColumnId,
    input.afterColumnId,
  );
  const dependencies = [...new Set(Object.values(bindings).map((binding) => binding.columnKey))];

  const values = [
    {
      tableId: input.tableId,
      key: actionColumnKey,
      name: action.name,
      type: "enrichment" as const,
      config,
      dependsOn: dependencies,
      position: positions[0],
      autoRun: input.autoRun,
    },
    ...selected.map((output, index) => {
    const key = outputKeys.get(output.key)!;
    const outputConfig: IntegrationOutputConfig = {
      integrationKey: input.integrationKey,
      actionKey: input.actionKey,
      sourceColumnKey: actionColumnKey,
      outputKey: output.key,
      valueType: output.columnType,
    };
    return {
      tableId: input.tableId,
      key,
      name: output.name,
      type: "integration_output" as const,
      config: outputConfig,
      dependsOn: [actionColumnKey],
      position: positions[index + 1],
      autoRun: false,
    };
    }),
  ];

  return db.insert(gridColumns).values(values).returning();
}

export async function updateEnrichmentColumns(input: {
  columnId: string;
  tableId: string;
  integrationKey: string;
  actionKey: string;
  inputs: Record<string, string>;
  selectedOutputs: string[];
  connectionId: string;
  autoRun: boolean;
  runCondition?: string;
  delaySeconds?: number;
  runInBatches?: boolean;
}): Promise<GridColumn[]> {
  const action = getIntegrationAction(input.integrationKey, input.actionKey);
  if (!action) throw new Error("Unknown integration action");
  const connection = await getIntegrationConnection(input.connectionId);
  if (!connection || connection.integrationKey !== input.integrationKey || !connection.verified) {
    throw new Error("Select a verified integration account before saving");
  }

  const existing = await listColumns(input.tableId);
  const current = existing.find((column) => column.id === input.columnId);
  if (!current || current.type !== "enrichment") throw new Error("Enrichment column not found");
  const previous = current.config as EnrichmentConfig;
  if (previous.integrationKey !== input.integrationKey || previous.actionKey !== input.actionKey) {
    throw new Error("Create a new enrichment column to use a different action");
  }

  const selected = action.outputs.filter((output) => input.selectedOutputs.includes(output.key));
  if (selected.length !== new Set(input.selectedOutputs).size) {
    throw new Error("One or more selected outputs are invalid");
  }
  const bindings = Object.fromEntries(
    Object.entries(input.inputs).map(([key, columnKey]) => [key, { source: "column" as const, columnKey }]),
  );
  const taken = new Set(existing.map((column) => column.key));
  const outputKeys = new Map(Object.entries(previous.outputs ?? {}));
  const additions = selected.filter((output) => !outputKeys.has(output.key));
  for (const output of additions) {
    const key = uniqueColumnKey(output.name, taken);
    taken.add(key);
    outputKeys.set(output.key, key);
  }

  const config: EnrichmentConfig = {
    integrationKey: input.integrationKey,
    actionKey: input.actionKey,
    handlerKey: action.handlerKey,
    inputs: bindings,
    outputs: Object.fromEntries(outputKeys),
    connectionId: input.connectionId,
    runCondition: input.runCondition?.trim() || undefined,
    delaySeconds: input.delaySeconds,
    runInBatches: input.runInBatches,
  };
  validateColumnConfig("enrichment", config, existing);
  const dependencies = [...new Set(Object.values(bindings).map((binding) => binding.columnKey))];

  // An input mapped to one of this action's own outputs would feed the run its
  // own result — a loop that re-queues forever.
  const ownKeys = new Set([
    current.key,
    ...outputKeys.values(),
    ...existing
      .filter((column) => (column.config as { sourceColumnKey?: string }).sourceColumnKey === current.key)
      .map((column) => column.key),
  ]);
  const selfReference = dependencies.find((key) => ownKeys.has(key));
  if (selfReference) throw new Error("An input cannot use this enrichment's own output column");
  assertNoCycle(existing, { key: current.key, dependsOn: dependencies });

  const related = existing
    .filter((column) => column.key === current.key || column.dependsOn.includes(current.key))
    .sort((a, b) => a.position - b.position);
  const positions = insertionPositions(existing, additions.length, undefined, related.at(-1)?.id ?? current.id);

  await db.transaction(async (tx) => {
    await tx.update(gridColumns).set({
      config,
      dependsOn: dependencies,
      autoRun: input.autoRun,
      updatedAt: new Date(),
    }).where(eq(gridColumns.id, current.id));

    if (additions.length) {
      await tx.insert(gridColumns).values(additions.map((output, index) => ({
        tableId: input.tableId,
        key: outputKeys.get(output.key)!,
        name: output.name,
        type: "integration_output" as const,
        config: {
          integrationKey: input.integrationKey,
          actionKey: input.actionKey,
          sourceColumnKey: current.key,
          outputKey: output.key,
          valueType: output.columnType,
        } satisfies IntegrationOutputConfig,
        dependsOn: [current.key],
        position: positions[index],
        autoRun: false,
      })));
    }
  });

  return listColumns(input.tableId);
}

/**
 * Promotes any leaf in a saved provider response to a durable output column.
 * Existing audited responses are backfilled, and the response pointer is also
 * added to the source action config so future runs populate the same column.
 */
export async function addEnrichmentResponseColumn(input: {
  tableId: string;
  rowId: string;
  runId: string;
  sourceColumnKey: string;
  pointer: string;
  name: string;
}): Promise<GridColumn> {
  if (!input.pointer.startsWith("/")) throw new Error("Select a response field");

  const existing = await listColumns(input.tableId);
  const source = existing.find(
    (column) => column.key === input.sourceColumnKey && column.type === "enrichment",
  );
  if (!source) throw new Error("Enrichment column not found");

  const [selectedRun] = await db
    .select({ response: gridCellRuns.response })
    .from(gridCellRuns)
    .where(and(
      inOrgTables(gridCellRuns.tableId),
      eq(gridCellRuns.id, input.runId),
      eq(gridCellRuns.tableId, input.tableId),
      eq(gridCellRuns.rowId, input.rowId),
      eq(gridCellRuns.columnKey, source.key),
    ))
    .orderBy(desc(gridCellRuns.createdAt))
    .limit(1);
  if (!selectedRun) throw new Error("No API result is available for this cell");

  const selectedValue = valueAtJsonPointer(selectedRun.response, input.pointer);
  if (selectedValue === undefined) throw new Error("That field is not present in the saved response");

  const outputKey = responseOutputKey(input.pointer);
  const previous = source.config as EnrichmentConfig;
  const existingColumnKey = previous.outputs[outputKey];
  if (existingColumnKey) {
    const existingOutput = existing.find((column) => column.key === existingColumnKey);
    if (existingOutput) return existingOutput;
  }

  const name = input.name.trim() || "Enrichment result";
  const valueType = inferResponseValueType(selectedValue, `${name} ${input.pointer}`);
  const key = uniqueColumnKey(name, new Set(existing.map((column) => column.key)));
  const related = existing
    .filter((column) => column.key === source.key || column.dependsOn.includes(source.key))
    .sort((a, b) => a.position - b.position);
  const anchor = related.at(-1) ?? source;
  const ordered = [...existing].sort((a, b) => a.position - b.position);
  const anchorIndex = ordered.findIndex((column) => column.id === anchor.id);
  const nextPosition = ordered[anchorIndex + 1]?.position;
  const position = nextPosition === undefined ? anchor.position + 1 : (anchor.position + nextPosition) / 2;
  const config: EnrichmentConfig = {
    ...previous,
    outputs: { ...previous.outputs, [outputKey]: key },
  };
  validateColumnConfig("enrichment", config, existing);

  const runs = await db
    .select({
      rowId: gridCellRuns.rowId,
      response: gridCellRuns.response,
      provider: gridCellRuns.provider,
      outcome: gridCellRuns.outcome,
      costCents: gridCellRuns.costCents,
      createdAt: gridCellRuns.createdAt,
    })
    .from(gridCellRuns)
    .where(and(
      inOrgTables(gridCellRuns.tableId),
      eq(gridCellRuns.tableId, input.tableId),
      eq(gridCellRuns.columnKey, source.key),
    ))
    .orderBy(desc(gridCellRuns.createdAt));

  return db.transaction(async (tx) => {
    await tx.update(gridColumns).set({ config, updatedAt: new Date() }).where(eq(gridColumns.id, source.id));
    const [column] = await tx.insert(gridColumns).values({
      tableId: input.tableId,
      key,
      name,
      type: "integration_output",
      config: {
        integrationKey: previous.integrationKey,
        actionKey: previous.actionKey,
        sourceColumnKey: source.key,
        outputKey,
        valueType,
      } satisfies IntegrationOutputConfig,
      dependsOn: [source.key],
      position,
      autoRun: false,
    }).returning();

    const seenRows = new Set<string>();
    for (const run of runs) {
      // Runs are newest-first. A failed or skipped run has no response to read, and must
      // not shadow the older successful run that does.
      if (run.outcome === "error" || run.outcome === "skipped") continue;
      if (seenRows.has(run.rowId)) continue;
      seenRows.add(run.rowId);
      const value = valueAtJsonPointer(run.response, input.pointer);
      if (value === undefined) continue;
      const meta = {
        status: "success" as const,
        provider: run.provider ?? undefined,
        costCents: Number(run.costCents ?? 0),
        runAt: run.createdAt?.toISOString() ?? new Date().toISOString(),
      };
      await tx.update(gridRows).set({
        cells: sql`${gridRows.cells} || ${JSON.stringify({ [key]: value ?? null })}::jsonb`,
        cellMeta: sql`${gridRows.cellMeta} || ${JSON.stringify({ [key]: meta })}::jsonb`,
        version: sql`nextval('grid_row_version_seq')`,
        updatedAt: new Date(),
      }).where(and(eq(gridRows.id, run.rowId), eq(gridRows.tableId, input.tableId)));
    }

    return column;
  });
}

export function insertionPositions(
  columns: GridColumn[],
  count: number,
  beforeColumnId?: string,
  afterColumnId?: string,
): number[] {
  const ordered = [...columns].sort((a, b) => a.position - b.position);
  let lower = ordered.at(-1)?.position ?? 0;
  let upper = lower + count + 1;

  if (beforeColumnId) {
    const index = ordered.findIndex((column) => column.id === beforeColumnId);
    if (index >= 0) {
      upper = ordered[index].position;
      lower = ordered[index - 1]?.position ?? upper - count - 1;
    }
  } else if (afterColumnId) {
    const index = ordered.findIndex((column) => column.id === afterColumnId);
    if (index >= 0) {
      lower = ordered[index].position;
      upper = ordered[index + 1]?.position ?? lower + count + 1;
    }
  }

  const step = (upper - lower) / (count + 1);
  return Array.from({ length: count }, (_, index) => lower + step * (index + 1));
}
