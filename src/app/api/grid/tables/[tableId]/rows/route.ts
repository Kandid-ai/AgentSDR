import { NextRequest, NextResponse } from "next/server";
import { addBlankRows, deleteRows, listRows } from "@/lib/grid/rows";
import { getTable } from "@/lib/grid/tables";
import { GRID_PAGE_SIZE } from "@/lib/grid/pagination";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

// GET /api/grid/tables/[tableId]/rows?limit&offset
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { tableId } = await params;
      const limit = Number(req.nextUrl.searchParams.get("limit") ?? GRID_PAGE_SIZE);
      const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);
      const rows = await listRows(tableId, { limit, offset });
      return NextResponse.json({ rows });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// POST /api/grid/tables/[tableId]/rows — { count } appends blank rows.
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

      let body: { count?: number };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }

      const count = Number(body.count ?? 1);
      if (!Number.isFinite(count) || count < 1) {
        return NextResponse.json({ error: "count must be a positive number" }, { status: 400 });
      }

      const rows = await addBlankRows(tableId, count);
      return NextResponse.json({ rows }, { status: 201 });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// DELETE /api/grid/tables/[tableId]/rows — { rowIds: string[] }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { tableId } = await params;

      let body: { rowIds?: string[] };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }

      if (!Array.isArray(body.rowIds) || !body.rowIds.length) {
        return NextResponse.json({ error: "rowIds must be a non-empty array" }, { status: 400 });
      }

      const deleted = await deleteRows(tableId, body.rowIds);
      return NextResponse.json({ deleted });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
