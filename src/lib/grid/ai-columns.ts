import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getAiModel } from "@/lib/ai/catalog";
import { getByokSettings } from "@/lib/ai/byok";
import { getAiConnection, getAiCredentials } from "@/lib/ai/connections";
import { listOpenRouterByokCatalog } from "@/lib/ai/server/openrouter";
import { gridColumns, type GridColumn } from "./schema";
import { tableInOrganization } from "./scope";
import { listColumns, uniqueColumnKey, validateColumnConfig } from "./columns";
import { insertionPositions } from "./enrichments";
import { promptColumnKeys } from "@/lib/ai/catalog";
import type { AiConfig, AiExample, AiOutputConfig, AiOutputField, AiUseCase } from "./types";

export type AiColumnInput = {
  tableId: string;
  useCase: AiUseCase;
  providerKey: string;
  modelKey: string;
  upstreamProvider?: string;
  connectionId: string;
  prompt: string;
  outputFormat: "fields" | "json_schema";
  outputs: AiOutputField[];
  jsonSchema?: Record<string, unknown>;
  examples?: AiExample[];
  autoRun: boolean;
  runCondition?: string;
  delaySeconds?: number;
  afterColumnId?: string;
  beforeColumnId?: string;
};

async function assertUsable(input: AiColumnInput) {
  const model = getAiModel(input.providerKey, input.modelKey, input.useCase);
  if (!model) throw new Error("Select an AI model");
  const connection = await getAiConnection(input.connectionId);
  if (!connection || connection.providerKey !== input.providerKey || !connection.verified) {
    throw new Error("Connect a verified account for this provider before saving");
  }
  if (input.providerKey === "openrouter") {
    const settings = await getByokSettings();
    if (!input.upstreamProvider || !settings.modelsByProvider[input.upstreamProvider]?.includes(input.modelKey)) {
      throw new Error("Select a model enabled for a BYOK provider in AI Settings");
    }
    if (!settings.byokOnlyConfirmed) throw new Error("Confirm BYOK-only routing in AI Settings");
    if (settings.connectionId !== input.connectionId) {
      throw new Error("This AI column must use the OpenRouter connection selected in AI Settings");
    }
    const credentials = await getAiCredentials(connection.id);
    if (!credentials?.apiKey || !credentials.managementKey) {
      throw new Error("Reconnect OpenRouter in AI Settings");
    }
    const catalog = await listOpenRouterByokCatalog(credentials.managementKey);
    const liveModel = catalog
      .find((provider) => provider.slug === input.upstreamProvider)
      ?.models.find((candidate) => candidate.id === input.modelKey);
    if (!liveModel) throw new Error("That model is no longer available through the selected BYOK provider");
    const modalities = liveModel.outputModalities ?? ["text"];
    const requiredModality = input.useCase === "image-generation" ? "image" : "text";
    if (!modalities.includes(requiredModality)) {
      throw new Error(`${liveModel.name} does not support this use case`);
    }
    return {
      ...model,
      name: liveModel.name,
      description: liveModel.description ?? model.description,
      producesImages: requiredModality === "image",
    };
  }
  return model;
}

function resultFields(input: AiColumnInput, producesImages: boolean): AiOutputField[] {
  if (producesImages) {
    return [{ key: "response", name: "Generated image", type: "image" }];
  }
  if (input.outputFormat === "json_schema") {
    return [{ key: "response", name: "AI response", type: "json" }];
  }
  return input.outputs;
}

/**
 * Creates the AI column, plus one column per output field.
 *
 * Same two-tier shape as an enrichment: the AI column is what runs and what
 * holds only run status, and each output column is a generated landing spot
 * the runner writes into. Single-result JSON and image runs get one output too.
 */
export async function createAiColumns(input: AiColumnInput): Promise<GridColumn[]> {
  const model = await assertUsable(input);
  if (!(await tableInOrganization(input.tableId))) throw new Error("That table no longer exists");
  const existing = await listColumns(input.tableId);

  const fields = resultFields(input, Boolean(model.producesImages));

  const taken = new Set(existing.map((column) => column.key));
  const outputColumns = new Map<string, string>();
  for (const field of fields) {
    const key = uniqueColumnKey(field.name, taken);
    taken.add(key);
    outputColumns.set(field.key, key);
  }

  const aiColumnKey = uniqueColumnKey(model.name, taken);
  taken.add(aiColumnKey);

  const config: AiConfig = {
    useCase: input.useCase,
    providerKey: input.providerKey,
    modelKey: input.modelKey,
    upstreamProvider: input.upstreamProvider,
    connectionId: input.connectionId,
    prompt: input.prompt,
    outputFormat: input.outputFormat,
    outputs: input.outputs,
    jsonSchema: input.jsonSchema,
    outputColumns: Object.fromEntries(outputColumns),
    examples: input.examples?.length ? input.examples : undefined,
    runCondition: input.runCondition?.trim() || undefined,
    delaySeconds: input.delaySeconds,
  };
  validateColumnConfig("ai", config, existing);

  const positions = insertionPositions(
    existing,
    fields.length + 1,
    input.beforeColumnId,
    input.afterColumnId,
  );
  const dependsOn = promptColumnKeys(input.prompt);

  const values = [
    {
      tableId: input.tableId,
      key: aiColumnKey,
      name: model.producesImages ? model.name : `${model.name} (AI)`,
      type: "ai" as const,
      config,
      dependsOn,
      position: positions[0],
      autoRun: input.autoRun,
    },
    ...fields.map((field, index) => {
      const outputConfig: AiOutputConfig = {
        sourceColumnKey: aiColumnKey,
        outputKey: field.key,
        valueType: field.type,
      };
      return {
        tableId: input.tableId,
        key: outputColumns.get(field.key)!,
        name: field.name,
        type: "ai_output" as const,
        config: outputConfig,
        dependsOn: [aiColumnKey],
        position: positions[index + 1],
        // Written by the AI column's run, never executed on its own.
        autoRun: false,
      };
    }),
  ];

  return db.insert(gridColumns).values(values).returning();
}

/**
 * Rewrites an existing AI column in place.
 *
 * Output columns already on the table are reused by name so the data in them
 * survives an edit; only genuinely new fields get a new column. Removing a
 * field leaves its column alone rather than dropping it — silently deleting a
 * populated column because a field was renamed would lose user data.
 */
export async function updateAiColumns(
  input: AiColumnInput & { columnId: string },
): Promise<GridColumn[]> {
  const model = await assertUsable(input);

  const existing = await listColumns(input.tableId);
  const target = existing.find((column) => column.id === input.columnId);
  if (!target || target.type !== "ai") throw new Error("That AI column no longer exists");

  const previous = target.config as AiConfig;
  const fields = resultFields(input, Boolean(model.producesImages));

  const byName = new Map(existing.map((column) => [column.name.toLowerCase(), column]));
  const taken = new Set(existing.map((column) => column.key));
  const outputColumns = new Map<string, string>();
  const created: typeof gridColumns.$inferInsert[] = [];
  const reused: Array<{ id: string; config: AiOutputConfig }> = [];

  const positions = insertionPositions(existing, fields.length + 1);
  let positionIndex = 1;

  for (const field of fields) {
    const reusable =
      (previous.outputColumns?.[field.key] &&
        existing.find((column) => column.key === previous.outputColumns[field.key])) ||
      byName.get(field.name.toLowerCase());

    if (reusable && reusable.id !== target.id) {
      outputColumns.set(field.key, reusable.key);
      reused.push({
        id: reusable.id,
        config: { sourceColumnKey: target.key, outputKey: field.key, valueType: field.type },
      });
      continue;
    }
    const key = uniqueColumnKey(field.name, taken);
    taken.add(key);
    outputColumns.set(field.key, key);
    created.push({
      tableId: input.tableId,
      key,
      name: field.name,
      type: "ai_output",
      config: { sourceColumnKey: target.key, outputKey: field.key, valueType: field.type },
      dependsOn: [target.key],
      position: positions[positionIndex++],
      autoRun: false,
    });
  }

  const config: AiConfig = {
    useCase: input.useCase,
    providerKey: input.providerKey,
    modelKey: input.modelKey,
    upstreamProvider: input.upstreamProvider,
    connectionId: input.connectionId,
    prompt: input.prompt,
    outputFormat: input.outputFormat,
    outputs: input.outputs,
    jsonSchema: input.jsonSchema,
    outputColumns: Object.fromEntries(outputColumns),
    examples: input.examples?.length ? input.examples : undefined,
    runCondition: input.runCondition?.trim() || undefined,
    delaySeconds: input.delaySeconds,
  };
  validateColumnConfig("ai", config, existing);

  return db.transaction(async (tx) => {
    await tx
      .update(gridColumns)
      .set({
        config,
        dependsOn: promptColumnKeys(input.prompt),
        autoRun: input.autoRun,
        updatedAt: new Date(),
      })
      .where(eq(gridColumns.id, target.id));

    if (created.length) await tx.insert(gridColumns).values(created);
    for (const output of reused) {
      await tx.update(gridColumns).set({
        type: "ai_output",
        config: output.config,
        dependsOn: [target.key],
        autoRun: false,
        updatedAt: new Date(),
      }).where(eq(gridColumns.id, output.id));
    }
    return listColumns(input.tableId);
  });
}
