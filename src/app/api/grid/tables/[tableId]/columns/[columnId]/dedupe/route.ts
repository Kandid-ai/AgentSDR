import { NextResponse } from "next/server";
import { dedupeRowsByColumn } from "@/lib/grid/column-operations";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tableId: string; columnId: string }> },
) {
  try {
    return await withOrgContext(_req, async () => {
      const { tableId, columnId } = await params;
      try {
        const deleted = await dedupeRowsByColumn(tableId, columnId);
        return NextResponse.json({ deleted });
      } catch (cause) {
        return NextResponse.json(
          { error: cause instanceof Error ? cause.message : "could not dedupe this column" },
          { status: 400 },
        );
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
