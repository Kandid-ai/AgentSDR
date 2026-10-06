import { NextRequest, NextResponse } from "next/server";
import { createTable } from "@/lib/grid/tables";
import { getWorkbook, listWorkbookTables } from "@/lib/grid/workbooks";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

// GET /api/grid/tables?workbookId=... — the sheet tabs for one workbook.
export async function GET(req: NextRequest) {
  try {
    return await withOrgContext(req, async () => {
      const workbookId = req.nextUrl.searchParams.get("workbookId");
      if (!workbookId) {
        return NextResponse.json({ error: "workbookId is required" }, { status: 400 });
      }
      const tables = await listWorkbookTables(workbookId);
      return NextResponse.json({ tables });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// POST /api/grid/tables — { workbookId, name?, description? } adds a sheet.
export async function POST(req: NextRequest) {
  try {
    return await withOrgContext(req, async () => {
      let body: { workbookId?: string; name?: string; description?: string };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }

      if (!body.workbookId) {
        return NextResponse.json({ error: "workbookId is required" }, { status: 400 });
      }
      if (!(await getWorkbook(body.workbookId))) {
        return NextResponse.json({ error: "workbook not found" }, { status: 404 });
      }

      const table = await createTable({
        workbookId: body.workbookId,
        name: body.name,
        description: body.description,
      });
      return NextResponse.json({ table }, { status: 201 });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
