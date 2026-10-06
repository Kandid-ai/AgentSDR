import { NextRequest, NextResponse } from "next/server";
import { createFolder, listFolders, listAllFolders } from "@/lib/grid/folders";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

// GET /api/grid/folders?parent=<id>       — direct children of one folder
// GET /api/grid/folders?parent=root       — folders at the root
// GET /api/grid/folders                   — every folder, flat (move pickers)
export async function GET(req: NextRequest) {
  try {
    return await withOrgContext(req, async () => {
      const parent = req.nextUrl.searchParams.get("parent");
      if (parent === null) return NextResponse.json({ folders: await listAllFolders() });

      const folders = await listFolders(parent === "root" ? null : parent);
      return NextResponse.json({ folders });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// POST /api/grid/folders — { name?, parentId? }
export async function POST(req: NextRequest) {
  try {
    return await withOrgContext(req, async () => {
      let body: { name?: string; parentId?: string | null };
      try {
        body = await req.json();
      } catch {
        body = {};
      }

      const folder = await createFolder({
        name: body.name ?? "Untitled folder",
        parentId: body.parentId ?? null,
      });
      return NextResponse.json({ folder }, { status: 201 });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
