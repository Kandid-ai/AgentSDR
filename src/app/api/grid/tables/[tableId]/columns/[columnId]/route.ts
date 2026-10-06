import { NextRequest, NextResponse } from "next/server";
import { deleteColumn, moveColumn, updateColumn } from "@/lib/grid/columns";
import { ALL_COLUMN_TYPES, type ColumnConfig, type ColumnType } from "@/lib/grid/types";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

// PATCH /api/grid/tables/[tableId]/columns/[columnId]
//   { name?, type?, config?, autoRun?, afterColumnId? }
// Renaming only touches this row — grid_rows.cells is keyed by the immutable
// `key`, never by `name`.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string; columnId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { columnId } = await params;

      let body: {
        name?: string;
        type?: ColumnType;
        config?: ColumnConfig;
        autoRun?: boolean;
        afterColumnId?: string | null;
      };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }

      if (body.type && !ALL_COLUMN_TYPES.includes(body.type)) {
        return NextResponse.json(
          { error: `type must be one of: ${ALL_COLUMN_TYPES.join(", ")}` },
          { status: 400 },
        );
      }

      try {
        if (body.afterColumnId !== undefined) {
          const moved = await moveColumn(columnId, body.afterColumnId);
          if (!moved) return NextResponse.json({ error: "not found" }, { status: 404 });
          return NextResponse.json({ column: moved });
        }

        const column = await updateColumn(columnId, body);
        if (!column) return NextResponse.json({ error: "not found" }, { status: 404 });
        return NextResponse.json({ column });
      } catch (err) {
        const message = err instanceof Error ? err.message : "could not update column";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// DELETE /api/grid/tables/[tableId]/columns/[columnId]
// Also strips the key from every row's JSONB — see deleteColumn().
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tableId: string; columnId: string }> },
) {
  try {
    return await withOrgContext(_req, async () => {
      const { columnId } = await params;
      try {
        const ok = await deleteColumn(columnId);
        if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
        return NextResponse.json({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "could not delete column";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
