import { NextRequest, NextResponse } from "next/server";
import { listCampaigns, createCampaign } from "@/lib/outreach/campaigns";
import { withOrgContext, authContextErrorResponse } from "@/lib/auth/context";
import { parseCampaignPriority, type CampaignPriority } from "@/lib/campaigns/priority";

// GET /api/outreach/campaigns — list campaigns with lead counts.
export async function GET(request: NextRequest) {
  try {
    return await withOrgContext(request, async () => {
      const rows = await listCampaigns();
      return NextResponse.json({ campaigns: rows });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// POST /api/outreach/campaigns — { name, priority? }
export async function POST(req: NextRequest) {
  try {
    return await withOrgContext(req, async () => {
      let body: { name?: string; priority?: unknown };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }
      if (!body.name?.trim()) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }
      let priority: CampaignPriority | undefined;
      if (body.priority !== undefined) {
        const parsed = parseCampaignPriority(body.priority);
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
        priority = parsed.priority;
      }
      const campaign = await createCampaign({ name: body.name, priority });
      return NextResponse.json({ campaign }, { status: 201 });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
