import { NextRequest, NextResponse } from "next/server";
import { listColumns } from "@/lib/grid/columns";
import { listRowIds } from "@/lib/grid/rows";
import { getTable } from "@/lib/grid/tables";
import type { FilterGroup, GridQuery, SortSpec } from "@/lib/grid/query";
import type { TableView } from "@/lib/grid/types";
import { effectiveColumnType } from "@/lib/grid/value-types";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

/**
 * GET /api/grid/tables/[tableId]/selection?search=
 *
 * Returns IDs for all rows matching the current saved filters and transient
 * search. The grid only loads one page, so this is the authoritative source
 * for "select all matching rows".
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { tableId } = await params;
      const search = req.nextUrl.searchParams.get("search") ?? undefined;
      const [table, columns] = await Promise.all([getTable(tableId), listColumns(tableId)]);
      if (!table) return NextResponse.json({ error: "not found" }, { status: 404 });

      const view = (table.view ?? {}) as TableView;
      const query: GridQuery = {
        filters: view.filters as FilterGroup | undefined,
        sorts: view.sorts as SortSpec[] | undefined,
        search: search || undefined,
      };

      try {
        const rowIds = await listRowIds(tableId, {
          query,
          columns: columns.map((column) => ({ key: column.key, type: effectiveColumnType(column) })),
        });
        return NextResponse.json({ rowIds });
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "could not select rows" }, { status: 400 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
