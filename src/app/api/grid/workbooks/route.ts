import { NextRequest, NextResponse } from "next/server";
import { createWorkbook, listWorkbooks } from "@/lib/grid/workbooks";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

// GET /api/grid/workbooks             — every workbook
// GET /api/grid/workbooks?folder=<id>  — workbooks filed in one folder
// GET /api/grid/workbooks?folder=root  — workbooks at the root
export async function GET(req: NextRequest) {
  try {
    return await withOrgContext(req, async () => {
      const folder = req.nextUrl.searchParams.get("folder");
      const workbooks = await listWorkbooks(
        folder === null ? "all" : folder === "root" ? null : folder,
      );
      return NextResponse.json({ workbooks });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// POST /api/grid/workbooks — { name?, firstTableName?, folderId? }
export async function POST(req: NextRequest) {
  try {
    return await withOrgContext(req, async () => {
      let body: { name?: string; firstTableName?: string; folderId?: string | null };
      try {
        body = await req.json();
      } catch {
        body = {};
      }

      const created = await createWorkbook({
        name: body.name ?? "Untitled workbook",
        firstTableName: body.firstTableName,
        folderId: body.folderId ?? null,
      });
      return NextResponse.json(created, { status: 201 });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
