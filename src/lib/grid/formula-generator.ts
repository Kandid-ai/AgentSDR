import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { inOrg } from "@/lib/tenancy/scope";
import { completeStructuredWithOpenRouter } from "@/lib/ai/server/structuredCompletion";
import { gridColumns, gridTables } from "./schema";
import { effectiveColumnType } from "./value-types";
import { resolveFormulaConfig } from "./formula-lookups";

export class FormulaGeneratorUnavailableError extends Error {}

export async function generateFormula(tableId: string, request: string, currentExpression?: string) {
  const [currentTable] = await db.select().from(gridTables).where(and(inOrg(gridTables), eq(gridTables.id, tableId))).limit(1);
  if (!currentTable) throw new Error("Table not found");
  const tables = await db.select().from(gridTables).where(and(inOrg(gridTables), eq(gridTables.workbookId, currentTable.workbookId)));
  const columns = await db.select().from(gridColumns).where(inArray(gridColumns.tableId, tables.map((table) => table.id)));
  const schema = tables.map((table) => ({
    table: table.name,
    id: table.id,
    current: table.id === tableId,
    columns: columns.filter((column) => column.tableId === table.id).map((column) => ({
      name: column.name,
      key: column.key,
      type: effectiveColumnType(column),
    })),
  }));

  let result: Awaited<ReturnType<typeof completeStructuredWithOpenRouter>>;
  try {
    result = await completeStructuredWithOpenRouter({
      timeoutMs: 30_000,
      systemPrompt: [
        "Generate one safe formula expression for a spreadsheet-like grid.",
        "Current-row columns MUST be referenced as {{stableKey}} using only keys from the current table.",
        "JavaScript expressions, lodash (_), moment, and FormulaJS functions such as IF, AND, OR, CONCATENATE, SUM, ROUND, UPPER, LOWER and TEXT are available.",
        'For another table use LOOKUP("Table name", {{currentRowKey}}, "Lookup column name", "Return column name") exactly. It returns the first exact match or null. An optional fifth argument is the default value.',
        "LOOKUP table and column arguments must be quoted literal names from the supplied schema.",
        "Return an expression only in formula; do not include markdown, a leading equals sign, assignments, statements, network calls, or explanations inside it.",
      ].join("\n"),
      userPrompt: `Workbook schema:\n${JSON.stringify(schema)}\n\nUser request:\n${request}${currentExpression ? `\n\nCurrent formula to improve:\n${currentExpression}` : ""}`,
      maxOutputTokens: 800,
      jsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["formula", "explanation"],
        properties: {
          formula: { type: "string" },
          explanation: { type: "string" },
        },
      },
      schemaName: "generate_formula",
    });
  } catch (error) {
    throw new FormulaGeneratorUnavailableError(error instanceof Error ? error.message : "OpenRouter AI is not configured");
  }
  const parsed = JSON.parse(result.text) as { formula?: string; explanation?: string };
  const formula = parsed.formula?.trim().replace(/^=/, "").trim() ?? "";
  if (!formula || formula.length > 10_000) throw new Error("AI returned an invalid formula");
  await resolveFormulaConfig(tableId, formula);
  return { formula, explanation: parsed.explanation?.trim() || "Generated from your request." };
}
