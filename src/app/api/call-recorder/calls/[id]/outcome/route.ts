import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { readCrmJson } from "@/lib/crm/categories";
import { setPersonDoNotContactInTransaction } from "@/lib/crm/policies";
import { withCrmTransaction } from "@/lib/crm/repository";
import { parseAgentOutcome } from "@/lib/calls/liveAgent";
import { callApiErrorResponse, withRecorderScope } from "@/lib/calls/sessions";
import { callSessions } from "@/lib/calls/schema";
import { inOrg } from "@/lib/tenancy/scope";

/**
 * The AI agent's record_outcome result for this call, posted by the recorder
 * extension (or the call worker's station) with the per-call bearer token,
 * like the rest of this prefix. The last one recorded wins.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withRecorderScope(request, (await params).id, async (row) => {
      const outcome = parseAgentOutcome(await readCrmJson(request));
      await db
        .update(callSessions)
        .set({ agentOutcome: outcome })
        .where(and(inOrg(callSessions), eq(callSessions.id, row.id)));
      // A lead who called back outside any AI campaign: no engine settles this call
      // (an AI campaign's settle sets Do Not Contact itself), and no rep was on it.
      if (outcome.outcome === "do_not_contact" && row.direction === "inbound" && !row.campaignContactId && row.personId) {
        const personId = row.personId;
        await withCrmTransaction((tx) =>
          setPersonDoNotContactInTransaction(tx, {
            personId,
            reason: "Asked not to be contacted when they called back",
            source: "inbound_request",
            actorType: "ai",
            actorRef: "ai-incoming-call",
          }),
        );
      }
      return Response.json({ ok: true });
    });
  } catch (error) {
    return callApiErrorResponse(error);
  }
}
