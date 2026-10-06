import { NextRequest, NextResponse } from "next/server";
import { duplicateTable } from "@/lib/grid/tables";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

// POST /api/grid/tables/[tableId]/duplicate — copies the sheet, its columns
// and every row into the same workbook, directly after the original.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(_req, async () => {
      const { tableId } = await params;
      try {
        const table = await duplicateTable(tableId);
        return NextResponse.json({ table }, { status: 201 });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Could not duplicate that table";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
