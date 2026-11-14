import type { NextRequest } from "next/server";
import { crmOperationErrorResponse } from "@/lib/crm/api";
import { CrmConfigurationValidationError, assertExactKeys, assertObject, parseUuid, readCrmJson } from "@/lib/crm/categories";
import { requireCrmMutationContext } from "@/lib/crm/http";
import { answerMeetingOutcome } from "@/lib/crm/meetings";
import type { MeetingOutcomeAnswer } from "@/lib/crm/meetingRules";
import { runInOrganization } from "@/lib/tenancy/scope";

const OUTCOMES: readonly MeetingOutcomeAnswer[] = ["showed", "no_show"];

/**
 * "Did they show up?" — a person answers for one of the record's meetings:
 * `{ meetingId, outcome: "showed" | "no_show" }`. Moves the record to Meeting
 * Done / Meeting No-show when the pipeline has that stage. 404 for another
 * organization's record or meeting; 409 once answered.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCrmMutationContext(request);
    return await runInOrganization(ctx.organizationId, async () => {
      const value = await readCrmJson(request);
      assertObject(value);
      assertExactKeys(value, ["meetingId", "outcome"]);
      if (!OUTCOMES.includes(value.outcome as MeetingOutcomeAnswer)) {
        throw new CrmConfigurationValidationError(`outcome must be one of: ${OUTCOMES.join(", ")}`);
      }
      const result = await answerMeetingOutcome({
        recordId: parseUuid((await params).id, "record id"),
        meetingId: parseUuid(value.meetingId, "meetingId"),
        outcome: value.outcome as MeetingOutcomeAnswer,
        actorName: ctx.userName?.trim() || ctx.userEmail,
      });
      return Response.json(result);
    });
  } catch (error) {
    return crmOperationErrorResponse(error);
  }
}
