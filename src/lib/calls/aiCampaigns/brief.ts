/**
 * The agentBrief an AI campaign call carries: the campaign's instructions,
 * then what this one call is for. Kept short on purpose — the token mint
 * (src/lib/calls/liveAgent.ts) adds the goal guidance and the lead's
 * history, so none of that is repeated here. Pure.
 */
import { MAX_AGENT_BRIEF_CHARS } from "../contract";
import type { AiStepPurpose } from "./engineRules";

const FALLBACK_STEP = "Introduce yourself and find out whether this is relevant to them.";

export function composeAgentBrief(input: {
  campaignInstructions: string;
  purpose: AiStepPurpose;
  /** The call step's own instructions (none for a call-back). */
  stepInstructions: string | null;
  /** A call-back: the time they asked for, in their words if the agent kept them. */
  callbackWhen?: string | null;
}): string {
  const parts: string[] = [];
  if (input.purpose === "callback") {
    const when = input.callbackWhen?.trim() || "the time they gave";
    parts.push(`They asked you to call back at this time (${when}); remind them gently why you are calling.`);
  } else if (input.purpose === "chase") {
    parts.push("They agreed to a meeting on an earlier call and were sent a booking link on WhatsApp, but have not booked yet.");
  }
  const step = input.stepInstructions?.trim();
  if (step) parts.push(step);
  else if (input.purpose === "reach") parts.push(FALLBACK_STEP);

  const campaign = input.campaignInstructions.trim();
  const thisCall = `This call: ${parts.join(" ")}`;
  const brief = campaign ? `${campaign}\n\n${thisCall}` : thisCall;
  if (brief.length <= MAX_AGENT_BRIEF_CHARS) return brief;
  // Over the limit only when both texts are near their own maximum: keep this call's part whole.
  const room = Math.max(0, MAX_AGENT_BRIEF_CHARS - thisCall.length - 3);
  return `${campaign.slice(0, room).trimEnd()}…\n\n${thisCall}`.slice(0, MAX_AGENT_BRIEF_CHARS);
}
