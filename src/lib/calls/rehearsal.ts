import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inOrg } from "@/lib/tenancy/scope";
import { loadRehearsalContext, type AgentPromptContext } from "./agentContext";
import { MAX_AGENT_BRIEF_CHARS, type AgentTokenRequest } from "./contract";
import { agentKnowledge, parseAgentName, parseAgentVoice, type KnowledgeDocument } from "./liveAgent";
import { callCampaigns } from "./schema";
import { CallApiError } from "./sessions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A made-up lead, so a rehearsal needs no real person. */
export const REHEARSAL_LEAD = { name: "Asha Verma", detail: "Marketing head · Acme", firstName: "Asha", company: "Acme" };

export type Rehearsal = { request: AgentTokenRequest; knowledge: KnowledgeDocument[]; context: AgentPromptContext };

/**
 * What a rehearsal plays: the session an AI campaign's call would get
 * (campaignId: its saved instructions, this call step, name, voice and goal)
 * or a free brief. Typed (POST …/rehearse) and spoken (POST …/rehearse/voice)
 * rehearsals both build it here, so they cannot drift apart. Runs in the
 * caller's organization scope.
 */
export async function resolveRehearsal(body: Record<string, unknown>): Promise<Rehearsal> {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  let brief = text(body.brief);
  let name = parseAgentName(body.name);
  let voice = parseAgentVoice(body.voice);
  let goal: AgentPromptContext["goal"] = null;
  let knowledgeIds: string[] | null = null;
  if (body.campaignId !== undefined && body.campaignId !== null && body.campaignId !== "") {
    const campaignId = text(body.campaignId);
    if (!UUID_RE.test(campaignId)) throw new CallApiError(400, "campaignId must be a UUID");
    const [campaign] = await db
      .select()
      .from(callCampaigns)
      .where(and(inOrg(callCampaigns), eq(callCampaigns.id, campaignId), eq(callCampaigns.runBy, "ai")))
      .limit(1);
    if (!campaign) throw new CallApiError(404, "AI campaign not found");
    const callSteps = [...campaign.aiSteps, ...campaign.aiChaseSteps].filter((step) => step.kind === "call");
    const step = callSteps.find((candidate) => candidate.id === body.stepId) ?? callSteps[0];
    brief = [campaign.aiInstructions.trim(), step?.kind === "call" ? step.instructions.trim() : ""].filter(Boolean).join("\n\n");
    name = campaign.aiAgentName?.trim() || name;
    voice = campaign.aiAgentVoice ?? voice;
    goal = { goal: campaign.aiGoal, bookingUrl: campaign.aiBookingUrl };
    knowledgeIds = campaign.aiKnowledgeIds ?? null;
  }
  if (!brief) throw new CallApiError(400, "The agent needs a brief");
  if (brief.length > MAX_AGENT_BRIEF_CHARS) throw new CallApiError(400, `The brief is over ${MAX_AGENT_BRIEF_CHARS} characters`);
  const [knowledge, context] = await Promise.all([agentKnowledge(knowledgeIds), loadRehearsalContext(goal)]);
  return { request: { brief, lead: REHEARSAL_LEAD, name, voice }, knowledge, context };
}
