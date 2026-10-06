import { NextRequest, NextResponse } from "next/server";
import { createCampaignFromGrid, type CreateGridCampaignInput } from "@/lib/leads/gridCampaigns";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

export async function POST(req: NextRequest, { params }: { params: Promise<{ tableId: string }> }) {
  try {
    return await withOrgContext(req, async () => {
      try {
        const { tableId } = await params;
        const body = await req.json() as Omit<CreateGridCampaignInput, "tableId">;
        if (body.channel !== "email" && body.channel !== "linkedin") {
          return NextResponse.json({ error: "channel must be email or linkedin" }, { status: 400 });
        }
        if (!Array.isArray(body.rowIds) || body.rowIds.length === 0 || body.rowIds.length > 5000) {
          return NextResponse.json({ error: "Select between 1 and 5000 rows" }, { status: 400 });
        }
        const result = await createCampaignFromGrid({ ...body, tableId });
        return NextResponse.json(result, { status: 201 });
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
