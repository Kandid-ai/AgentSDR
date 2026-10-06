import { NextRequest, NextResponse } from "next/server";
import { columnCoverage, deleteTable, getTable, moveTable, updateTable } from "@/lib/grid/tables";
import { listColumns } from "@/lib/grid/columns";
import { countRows, currentVersion, listRows } from "@/lib/grid/rows";
import { activeJobCount } from "@/lib/grid/queue";
import type { FilterGroup, GridQuery, SortSpec } from "@/lib/grid/query";
import type { TableView } from "@/lib/grid/types";
import { effectiveColumnType } from "@/lib/grid/value-types";
import { GRID_PAGE_SIZE } from "@/lib/grid/pagination";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

/**
 * GET /api/grid/tables/[tableId]
 *
 * Returns the table, its columns, and a page of rows with the table's saved
 * view (filters and sorts) applied. `?search=` narrows further and is NOT
 * saved — a search is a transient lookup, whereas filters and sorts are part
 * of the view and persist for whoever opens the table next.
 *
 * `total` is the filtered count; `unfilteredTotal` is the whole table, so the
 * toolbar can honestly say "12/400 rows".
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { tableId } = await params;

      const limit = Number(req.nextUrl.searchParams.get("limit") ?? GRID_PAGE_SIZE);
      const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);
      const search = req.nextUrl.searchParams.get("search") ?? undefined;

      // Fetched together: the column list is keyed off tableId alone, so waiting
      // for the table row first only bought an extra serial round trip on a path
      // the user sits and watches every time they switch tabs.
      const [table, columns] = await Promise.all([getTable(tableId), listColumns(tableId)]);
      if (!table) return NextResponse.json({ error: "not found" }, { status: 404 });

      const refs = columns.map((c) => ({ key: c.key, type: effectiveColumnType(c) }));

      const view = (table.view ?? {}) as TableView;
      const query: GridQuery = {
        filters: view.filters as FilterGroup | undefined,
        sorts: view.sorts as SortSpec[] | undefined,
        search: search || undefined,
      };

      try {
        const [rows, total, unfilteredTotal, cursor, coverage, activeJobs] = await Promise.all([
          listRows(tableId, { limit, offset, query, columns: refs }),
          countRows(tableId, { query, columns: refs }),
          countRows(tableId),
          currentVersion(tableId),
          columnCoverage(tableId, columns),
          activeJobCount(tableId),
        ]);

        return NextResponse.json({
          table,
          columns,
          rows,
          total,
          unfilteredTotal,
          cursor,
          coverage,
          activeJobs,
          view,
        });
      } catch (err) {
        // assertKnownColumns throws when a saved view names a deleted column.
        const message = err instanceof Error ? err.message : "could not read rows";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// PATCH /api/grid/tables/[tableId]
//   { name?, description?, autoRun?, view?, workbookId? }
//
// `workbookId` moves the sheet to another workbook and is applied first, so a
// combined rename-and-move does not half-apply if the move is rejected.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { tableId } = await params;

      let body: {
        name?: string;
        description?: string | null;
        autoRun?: boolean;
        view?: TableView;
        workbookId?: string;
      };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }

      const { workbookId, ...fields } = body;

      try {
        let table = workbookId ? await moveTable(tableId, workbookId) : null;

        if (Object.keys(fields).length > 0) {
          table = await updateTable(tableId, fields);
        }
        if (!table) return NextResponse.json({ error: "not found" }, { status: 404 });
        return NextResponse.json({ table });
      } catch (cause) {
        // moveTable rejects a dead destination and emptying a workbook.
        const message = cause instanceof Error ? cause.message : "Could not update that table";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// DELETE /api/grid/tables/[tableId] — columns, rows, jobs and runs cascade.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(_req, async () => {
      const { tableId } = await params;
      const ok = await deleteTable(tableId);
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
