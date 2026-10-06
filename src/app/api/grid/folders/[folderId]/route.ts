import { NextRequest, NextResponse } from "next/server";
import { deleteFolder, getFolder, listFolders, updateFolder } from "@/lib/grid/folders";
import { listWorkbooks } from "@/lib/grid/workbooks";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

// GET /api/grid/folders/[folderId] — the folder plus its direct contents.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> },
) {
  try {
    return await withOrgContext(_req, async () => {
      const { folderId } = await params;
      const folder = await getFolder(folderId);
      if (!folder) return NextResponse.json({ error: "not found" }, { status: 404 });

      const [folders, workbooks] = await Promise.all([
        listFolders(folderId),
        listWorkbooks(folderId),
      ]);
      return NextResponse.json({ folder, folders, workbooks });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// PATCH /api/grid/folders/[folderId] — { name?, parentId? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { folderId } = await params;

      let body: { name?: string; parentId?: string | null };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }

      try {
        const folder = await updateFolder(folderId, body);
        if (!folder) return NextResponse.json({ error: "not found" }, { status: 404 });
        return NextResponse.json({ folder });
      } catch (cause) {
        // updateFolder rejects cycles and dead destinations — both are the
        // caller's fault, not a server fault.
        const message = cause instanceof Error ? cause.message : "Could not move that folder";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// DELETE /api/grid/folders/[folderId] — removes the folder and its subfolders.
// Workbooks inside are released to the root rather than deleted.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> },
) {
  try {
    return await withOrgContext(_req, async () => {
      const { folderId } = await params;
      const { deleted, released } = await deleteFolder(folderId);
      if (!deleted) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.json({ ok: true, released });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
