import { NextRequest, NextResponse } from "next/server";
import { setCellValue, setCellValues, type CellValueUpdate } from "@/lib/grid/rows";
import { listColumns } from "@/lib/grid/columns";
import { isStaticColumnType } from "@/lib/grid/types";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// PATCH /api/grid/tables/[tableId]/cells — { rowId, columnKey, value }
//
// Editing is only allowed on static columns. A runner column's value is
// owned by the worker, and letting the UI write it would be silently undone
// by the next run — confusing rather than useful.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { tableId } = await params;

      let body: {
        rowId?: string;
        columnKey?: string;
        value?: unknown;
        updates?: CellValueUpdate[];
      };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ error: "body must be an object" }, { status: 400 });
      }

      const columns = await listColumns(tableId);
      const columnsByKey = new Map(columns.map((column) => [column.key, column]));

      if (body.updates !== undefined) {
        if (!Array.isArray(body.updates) || body.updates.length === 0 || body.updates.length > 50_000) {
          return NextResponse.json(
            { error: "updates must contain between 1 and 50,000 cells" },
            { status: 400 },
          );
        }
        const cells = new Set<string>();
        const rowIds = new Set<string>();
        for (const update of body.updates) {
          if (!update || typeof update.rowId !== "string" || typeof update.columnKey !== "string") {
            return NextResponse.json({ error: "every update needs a rowId and columnKey" }, { status: 400 });
          }
          rowIds.add(update.rowId);
          if (rowIds.size > 1_000) {
            return NextResponse.json({ error: "updates cannot span more than 1,000 rows" }, { status: 400 });
          }
          if (!UUID.test(update.rowId)) {
            return NextResponse.json({ error: "every update needs a valid rowId" }, { status: 400 });
          }
          const cell = `${update.rowId}\u0000${update.columnKey}`;
          if (cells.has(cell)) {
            return NextResponse.json({ error: "updates cannot contain the same cell twice" }, { status: 400 });
          }
          cells.add(cell);
          const column = columnsByKey.get(update.columnKey);
          if (!column) {
            return NextResponse.json({ error: `unknown column "${update.columnKey}"` }, { status: 400 });
          }
          if (!isStaticColumnType(column.type)) {
            return NextResponse.json(
              { error: `"${column.name}" is a ${column.type} column — its value is set by running it` },
              { status: 400 },
            );
          }
        }

        try {
          const result = await setCellValues(tableId, body.updates);
          return NextResponse.json({ updatedCells: body.updates.length, ...result });
        } catch (cause) {
          return NextResponse.json(
            { error: cause instanceof Error ? cause.message : "could not update cells" },
            { status: 400 },
          );
        }
      }

      if (!body.rowId || !body.columnKey) {
        return NextResponse.json({ error: "rowId and columnKey are required" }, { status: 400 });
      }
      if (!UUID.test(body.rowId)) {
        return NextResponse.json({ error: "rowId must be a valid UUID" }, { status: 400 });
      }

      const column = columnsByKey.get(body.columnKey);
      if (!column) return NextResponse.json({ error: "unknown column" }, { status: 400 });
      if (!isStaticColumnType(column.type)) {
        return NextResponse.json(
          { error: `"${column.name}" is a ${column.type} column — its value is set by running it` },
          { status: 400 },
        );
      }

      const row = await setCellValue(tableId, body.rowId, body.columnKey, body.value);
      if (!row) return NextResponse.json({ error: "row not found" }, { status: 404 });

      return NextResponse.json({ row });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
