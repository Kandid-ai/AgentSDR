import { type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { withOrgContext } from "@/lib/auth/context";
import { parseBookingUrl } from "@/lib/crm/bookingLinkToken";
import { CrmConfigurationValidationError, assertExactKeys, assertObject, crmConfigurationErrorResponse, readCrmJson } from "@/lib/crm/categories";
import { ensureCrmDefaults } from "@/lib/crm/defaults";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { crmSettings } from "@/lib/crm/schema";
import { runInOrganization } from "@/lib/tenancy/scope";

/**
 * The Cal.com booking page a CRM message's `{{booking_link}}` becomes
 * (crm_settings.booking_url of the default pipeline; src/lib/crm/bookingLink.ts).
 * crm_settings is reached through the organization's own pipeline.
 */
async function readBookingUrl(pipelineId: string) {
  const [row] = await db.select({ bookingUrl: crmSettings.bookingUrl }).from(crmSettings).where(eq(crmSettings.pipelineId, pipelineId)).limit(1);
  return { pipelineId, bookingUrl: row?.bookingUrl ?? null };
}

export async function GET(request: NextRequest) {
  try {
    return await withOrgContext(request, async () => {
      const { pipelineId } = await ensureCrmDefaults();
      return Response.json(await readBookingUrl(pipelineId));
    });
  } catch (error) {
    return crmConfigurationErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireCrmMutationContext(request);
    return await runInOrganization(ctx.organizationId, async () => {
      const value = await readCrmJson(request);
      assertObject(value);
      assertExactKeys(value, ["bookingUrl"]);
      const parsed = parseBookingUrl(value.bookingUrl);
      if (!parsed.ok) throw new CrmConfigurationValidationError(parsed.error);
      const { pipelineId } = await ensureCrmDefaults();
      await db
        .insert(crmSettings)
        .values({ pipelineId, bookingUrl: parsed.value })
        .onConflictDoUpdate({ target: crmSettings.pipelineId, set: { bookingUrl: parsed.value, updatedAt: new Date() } });
      return Response.json(await readBookingUrl(pipelineId));
    });
  } catch (error) {
    return crmConfigurationErrorResponse(error);
  }
}
