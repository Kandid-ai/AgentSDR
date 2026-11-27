import { type NextRequest } from "next/server";
import { withOrgContext } from "@/lib/auth/context";
import { crmConfigurationErrorResponse, readCrmJson } from "@/lib/crm/categories";
import { createBoardView, listBoardViews } from "@/lib/crm/boardViews.server";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { runInOrganization } from "@/lib/tenancy/scope";

export async function GET(request: NextRequest) {
  try {
    return await withOrgContext(request, async () => Response.json({ views: await listBoardViews() }));
  } catch (error) {
    return crmConfigurationErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCrmMutationContext(request);
    return await runInOrganization(ctx.organizationId, async () => {
      const body = await readCrmJson(request) as { name?: unknown; config?: unknown } | null;
      const view = await createBoardView({ name: body?.name, config: body?.config, createdByUserId: ctx.userId });
      return Response.json({ view }, { status: 201 });
    });
  } catch (error) {
    return crmConfigurationErrorResponse(error);
  }
}
