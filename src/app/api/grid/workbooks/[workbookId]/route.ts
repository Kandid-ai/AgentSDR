import { NextRequest, NextResponse } from "next/server";
import {
  deleteWorkbook,
  getWorkbook,
  listWorkbookTables,
  updateWorkbook,
} from "@/lib/grid/workbooks";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

// GET /api/grid/workbooks/[workbookId] — workbook plus its sheet tabs.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workbookId: string }> },
) {
  try {
    return await withOrgContext(_req, async () => {
      const { workbookId } = await params;
      const workbook = await getWorkbook(workbookId);
      if (!workbook) return NextResponse.json({ error: "not found" }, { status: 404 });

      const tables = await listWorkbookTables(workbookId);
      return NextResponse.json({ workbook, tables });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// PATCH /api/grid/workbooks/[workbookId] — { name?, description?, folderId? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workbookId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { workbookId } = await params;

      let body: { name?: string; description?: string | null; folderId?: string | null };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }

      try {
        const workbook = await updateWorkbook(workbookId, body);
        if (!workbook) return NextResponse.json({ error: "not found" }, { status: 404 });
        return NextResponse.json({ workbook });
      } catch (cause) {
        // A move to a folder that has since been deleted — the caller's stale
        // view, not a server fault.
        const message = cause instanceof Error ? cause.message : "Could not update that workbook";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// DELETE /api/grid/workbooks/[workbookId] — cascades to every sheet.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ workbookId: string }> },
) {
  try {
    return await withOrgContext(_req, async () => {
      const { workbookId } = await params;
      const ok = await deleteWorkbook(workbookId);
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
