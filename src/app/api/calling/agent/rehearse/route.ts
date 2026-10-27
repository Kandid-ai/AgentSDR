import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { inOrg } from "@/lib/tenancy/scope";
import { loadRehearsalContext, type AgentPromptContext } from "@/lib/calls/agentContext";
import { agentKnowledge, parseAgentName, parseAgentVoice, rehearseAgent, type RehearsalTurn } from "@/lib/calls/liveAgent";
import { callCampaigns } from "@/lib/calls/schema";
import { CallApiError, callApiErrorResponse } from "@/lib/calls/sessions";
import { MAX_AGENT_BRIEF_CHARS } from "@/lib/calls/contract";

const MAX_TURNS = 40;
const MAX_TURN_CHARS = 1_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A made-up lead, so the rehearsal needs no real person. */
const REHEARSAL_LEAD = { name: "Asha Verma", detail: "Marketing head · Acme", firstName: "Asha", company: "Acme" };

/**
 * POST /api/calling/agent/rehearse — type as the lead and read what the AI
 * agent says, with the exact prompt a campaign call would get. Costs one
 * Gemini Live turn per request; the conversation lives in the browser.
 */
export async function POST(request: NextRequest) {
  try {
    return await withOrgContext(request, async () => {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== "object") throw new CallApiError(400, "Expected a JSON object");
      const turns = parseTurns(body.turns);
      const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

      let brief = text(body.brief);
      let name = parseAgentName(body.name);
      let voice = parseAgentVoice(body.voice);
      let goal: AgentPromptContext["goal"] = null;
      if (body.campaignId !== undefined && body.campaignId !== null && body.campaignId !== "") {
        const campaignId = text(body.campaignId);
        if (!UUID_RE.test(campaignId)) throw new CallApiError(400, "campaignId must be a UUID");
        const [campaign] = await db
          .select()
          .from(callCampaigns)
          .where(and(inOrg(callCampaigns), eq(callCampaigns.id, campaignId), eq(callCampaigns.runBy, "ai")))
          .limit(1);
        if (!campaign) throw new CallApiError(404, "AI campaign not found");
        const callSteps = campaign.aiSteps.filter((step) => step.kind === "call");
        const step = callSteps.find((candidate) => candidate.id === body.stepId) ?? callSteps[0];
        brief = [campaign.aiInstructions.trim(), step?.kind === "call" ? step.instructions.trim() : ""].filter(Boolean).join("\n\n");
        name = campaign.aiAgentName?.trim() || name;
        voice = campaign.aiAgentVoice ?? voice;
        goal = { goal: campaign.aiGoal, bookingUrl: campaign.aiBookingUrl };
      }
      if (!brief) throw new CallApiError(400, "The agent needs a brief");
      if (brief.length > MAX_AGENT_BRIEF_CHARS) throw new CallApiError(400, `The brief is over ${MAX_AGENT_BRIEF_CHARS} characters`);

      const [knowledge, context] = await Promise.all([agentKnowledge(), loadRehearsalContext(goal)]);
      const result = await rehearseAgent({ brief, lead: REHEARSAL_LEAD, name, voice }, knowledge, context, turns);
      return Response.json(result);
    });
  } catch (error) {
    return callApiErrorResponse(error);
  }
}

function parseTurns(value: unknown): RehearsalTurn[] {
  if (!Array.isArray(value)) throw new CallApiError(400, "turns must be a list");
  if (value.length > MAX_TURNS) throw new CallApiError(400, `At most ${MAX_TURNS} turns`);
  return value.map((raw) => {
    const turn = raw as { role?: unknown; text?: unknown } | null;
    if (!turn || (turn.role !== "lead" && turn.role !== "agent") || typeof turn.text !== "string" || !turn.text.trim()) {
      throw new CallApiError(400, "Each turn needs a role (lead or agent) and text");
    }
    return { role: turn.role, text: turn.text.trim().slice(0, MAX_TURN_CHARS) };
  });
}
