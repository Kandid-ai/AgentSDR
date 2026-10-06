import { NextRequest, NextResponse } from "next/server";
import { createColumn, listColumns } from "@/lib/grid/columns";
import { getTable } from "@/lib/grid/tables";
import { ALL_COLUMN_TYPES, type ColumnConfig, type ColumnType } from "@/lib/grid/types";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

// GET /api/grid/tables/[tableId]/columns
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(_req, async () => {
      const { tableId } = await params;
      const columns = await listColumns(tableId);
      return NextResponse.json({ columns });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// POST /api/grid/tables/[tableId]/columns — { name, type, config?, afterColumnId? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { tableId } = await params;
      if (!(await getTable(tableId))) {
        return NextResponse.json({ error: "table not found" }, { status: 404 });
      }

      let body: {
        name?: string;
        type?: ColumnType;
        config?: ColumnConfig;
        autoRun?: boolean;
        afterColumnId?: string;
        beforeColumnId?: string;
      };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }

      if (!body.name?.trim()) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }
      if (!body.type || !ALL_COLUMN_TYPES.includes(body.type)) {
        return NextResponse.json(
          { error: `type must be one of: ${ALL_COLUMN_TYPES.join(", ")}` },
          { status: 400 },
        );
      }

      try {
        const column = await createColumn({
          tableId,
          name: body.name,
          type: body.type,
          config: body.config,
          autoRun: body.autoRun,
          afterColumnId: body.afterColumnId,
          beforeColumnId: body.beforeColumnId,
        });
        return NextResponse.json({ column }, { status: 201 });
      } catch (err) {
        // assertNoCycle throws here — a 400 rather than a 500, since it's the
        // user's column config that's wrong, not the server.
        const message = err instanceof Error ? err.message : "could not create column";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
