import { type NextRequest } from "next/server";
import { crmConfigurationErrorResponse, readCrmJson } from "@/lib/crm/categories";
import { deleteBoardView, updateBoardView } from "@/lib/crm/boardViews.server";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { runInOrganization } from "@/lib/tenancy/scope";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const ctx = await requireCrmMutationContext(request);
    return await runInOrganization(ctx.organizationId, async () => {
      const { id } = await params;
      const body = await readCrmJson(request) as { name?: unknown; config?: unknown; position?: unknown } | null;
      return Response.json({ view: await updateBoardView(id, { name: body?.name, config: body?.config, position: body?.position }) });
    });
  } catch (error) {
    return crmConfigurationErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const ctx = await requireCrmMutationContext(request);
    return await runInOrganization(ctx.organizationId, async () => {
      const { id } = await params;
      await deleteBoardView(id);
      return Response.json({ ok: true });
    });
  } catch (error) {
    return crmConfigurationErrorResponse(error);
  }
}
