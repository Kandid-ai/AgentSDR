import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addEnrichmentResponseColumn } from "@/lib/grid/enrichments";
import { tableInOrganization } from "@/lib/grid/scope";
import { gridCellRuns, gridColumns, gridRows } from "@/lib/grid/schema";
import type { AiConfig, AiOutputConfig, IntegrationOutputConfig } from "@/lib/grid/types";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

async function resolveCell(tableId: string, rowId: string, columnKey: string) {
  // Every query below is keyed by table id; another organization's table reads as not found.
  if (!(await tableInOrganization(tableId))) return null;
  const [row] = await db.select({ id: gridRows.id }).from(gridRows).where(and(
    eq(gridRows.id, rowId),
    eq(gridRows.tableId, tableId),
  )).limit(1);
  if (!row) return null;

  const [column] = await db.select().from(gridColumns).where(and(
    eq(gridColumns.tableId, tableId),
    eq(gridColumns.key, columnKey),
  )).limit(1);
  if (!column) return null;

  let sourceColumnKey: string | null = null;
  if (column.type === "enrichment" || column.type === "ai") {
    sourceColumnKey = column.key;
  } else if (column.type === "integration_output") {
    sourceColumnKey = (column.config as IntegrationOutputConfig).sourceColumnKey;
  } else if (column.type === "ai_output") {
    sourceColumnKey = (column.config as AiOutputConfig).sourceColumnKey;
  } else {
    // AI output columns created before ai_output existed were ordinary static
    // columns. Keep their historical run details reachable.
    const candidates = await db.select().from(gridColumns).where(and(
      eq(gridColumns.tableId, tableId),
      eq(gridColumns.type, "ai"),
    ));
    sourceColumnKey = candidates.find((candidate) =>
      Object.values((candidate.config as AiConfig).outputColumns ?? {}).includes(column.key),
    )?.key ?? null;
  }
  if (!sourceColumnKey) return null;
  const [source] = await db.select().from(gridColumns).where(and(
    eq(gridColumns.tableId, tableId),
    eq(gridColumns.key, sourceColumnKey),
  )).limit(1);
  if (!source || (source.type !== "enrichment" && source.type !== "ai")) return null;
  return { column, source };
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(request, async () => {
      const { tableId } = await params;
      const rowId = request.nextUrl.searchParams.get("rowId") ?? "";
      const columnKey = request.nextUrl.searchParams.get("columnKey") ?? "";
      const resolved = await resolveCell(tableId, rowId, columnKey);
      if (!resolved) return NextResponse.json({ error: "Cell not found" }, { status: 404 });

      const [run] = await db.select({
        id: gridCellRuns.id,
        provider: gridCellRuns.provider,
        outcome: gridCellRuns.outcome,
        costCents: gridCellRuns.costCents,
        latencyMs: gridCellRuns.latencyMs,
        request: gridCellRuns.request,
        response: gridCellRuns.response,
        createdAt: gridCellRuns.createdAt,
      }).from(gridCellRuns).where(and(
        eq(gridCellRuns.tableId, tableId),
        eq(gridCellRuns.rowId, rowId),
        eq(gridCellRuns.columnKey, resolved.source.key),
      )).orderBy(desc(gridCellRuns.createdAt)).limit(1);

      if (!run) return NextResponse.json({
        sourceColumnKey: resolved.source.key,
        sourceColumnName: resolved.source.name,
        sourceColumnType: resolved.source.type,
        canAddResponseColumn: resolved.source.type === "enrichment",
        run: null,
      });

      return NextResponse.json({
        sourceColumnKey: resolved.source.key,
        sourceColumnName: resolved.source.name,
        sourceColumnType: resolved.source.type,
        canAddResponseColumn: resolved.source.type === "enrichment",
        run: {
          ...run,
          costCents: Number(run.costCents ?? 0),
        },
      });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(request, async () => {
      const { tableId } = await params;
      let body: { rowId?: string; columnKey?: string; runId?: string; pointer?: string; name?: string };
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      if (!body.rowId || !body.columnKey || !body.runId || !body.pointer || !body.name?.trim()) {
        return NextResponse.json({ error: "Row, cell run, response field, and column name are required" }, { status: 400 });
      }
      if (body.pointer.length > 1000 || body.name.length > 120) {
        return NextResponse.json({ error: "Response field or column name is too long" }, { status: 400 });
      }
      const resolved = await resolveCell(tableId, body.rowId, body.columnKey);
      if (!resolved) return NextResponse.json({ error: "Cell not found" }, { status: 404 });
      if (resolved.source.type !== "enrichment") {
        return NextResponse.json({ error: "Adding response fields is only available for enrichments" }, { status: 400 });
      }

      try {
        const column = await addEnrichmentResponseColumn({
          tableId,
          rowId: body.rowId,
          runId: body.runId,
          sourceColumnKey: resolved.source.key,
          pointer: body.pointer,
          name: body.name,
        });
        return NextResponse.json({ column }, { status: 201 });
      } catch (error) {
        return NextResponse.json({
          error: error instanceof Error ? error.message : "Could not add response field",
        }, { status: 400 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
