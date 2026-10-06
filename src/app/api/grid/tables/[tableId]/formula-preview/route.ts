import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { inOrgTables } from "@/lib/grid/scope";
import { gridRows } from "@/lib/grid/schema";
import { evaluateOnce } from "@/lib/grid/runners";
import { buildFormulaLookupRegistry, resolveFormulaConfig } from "@/lib/grid/formula-lookups";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

const MAX_EXPRESSION_LENGTH = 10_000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { tableId } = await params;
      let body: { expression?: string; rowId?: string };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
      }

      const expression = body.expression?.trim();
      if (!expression) {
        return NextResponse.json({ ok: false, error: "expression is required" }, { status: 400 });
      }
      if (expression.length > MAX_EXPRESSION_LENGTH) {
        return NextResponse.json({ ok: false, error: "expression is too long" }, { status: 400 });
      }

      const rows = await db
        .select({ id: gridRows.id, position: gridRows.position, cells: gridRows.cells })
        .from(gridRows)
        .where(
          body.rowId
            ? and(inOrgTables(gridRows.tableId), eq(gridRows.tableId, tableId), eq(gridRows.id, body.rowId))
            : and(inOrgTables(gridRows.tableId), eq(gridRows.tableId, tableId)),
        )
        .limit(1);
      const row = rows[0];
      if (!row) {
        return NextResponse.json({ ok: false, error: "preview row not found" }, { status: 404 });
      }

      let formula;
      let registry;
      try {
        formula = await resolveFormulaConfig(tableId, expression);
        registry = await buildFormulaLookupRegistry(formula.lookupRefs);
      } catch (error) {
        return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Invalid formula" }, { status: 422 });
      }
      const result = await evaluateOnce(expression, row.cells, registry);
      if (!result.ok) return NextResponse.json(result, { status: 422 });
      return NextResponse.json({ ...result, rowId: row.id, rowNumber: row.position });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
