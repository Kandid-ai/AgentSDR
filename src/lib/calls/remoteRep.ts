import "server-only";

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assertExactKeys, assertObject } from "@/lib/crm/categories";
import { inOrg } from "@/lib/tenancy/scope";
import type { CallAiLeadRequest } from "./aiCampaigns/api";
import { MAX_RTC_SDP_CHARS, type RecorderRemoteRep } from "./contract";
import { callSessions } from "./schema";
import { CallApiError, isTerminalStatus } from "./sessions";

/**
 * A rep talking through a calling station (contract.ts, RecorderRemoteRep):
 * the server only carries the two SDPs between the rep's tab and the
 * station, in call_sessions.remote_rep. Neither is ever shown to anyone but
 * the call's own organization.
 */

type CallSessionRow = typeof callSessions.$inferSelect;

/** One SDP from a browser: a session description, not empty, not huge. */
export function parseSdp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new CallApiError(400, `${label} must be an SDP`);
  if (value.length > MAX_RTC_SDP_CHARS) throw new CallApiError(400, `${label} is over ${MAX_RTC_SDP_CHARS} characters`);
  if (!value.startsWith("v=0")) throw new CallApiError(400, `${label} must be an SDP`);
  return value;
}

/** StartCallRequest.remoteRep: null/absent = not a rep call. */
export function parseRemoteRep(value: unknown): RecorderRemoteRep | null {
  if (value == null) return null;
  assertObject(value, "remoteRep");
  assertExactKeys(value, ["offer"]);
  return { offer: parseSdp(value.offer, "remoteRep.offer") };
}

/**
 * POST /api/calling/ai-campaigns/:id/leads/:contactId/call — the body is
 * optional (an empty one is the AI agent's call, as before this existed).
 */
export async function readCallAiLeadRequest(request: Request): Promise<CallAiLeadRequest> {
  const text = await request.text();
  if (!text.trim()) return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new CallApiError(400, "Request body must contain valid JSON");
  }
  assertObject(value);
  assertExactKeys(value, ["remoteRep"]);
  return { remoteRep: parseRemoteRep(value.remoteRep) };
}

/** POST /api/call-recorder/calls/:id/rtc. */
export function parseRtcAnswerRequest(value: unknown): string {
  assertObject(value);
  assertExactKeys(value, ["answer"]);
  return parseSdp(value.answer, "answer");
}

/** Whether a station may answer this call now; throws the route's error if not. */
export function assertRtcAnswerAllowed(row: Pick<CallSessionRow, "remoteRep" | "status">, answer: string): "store" | "repeat" {
  if (!row.remoteRep) throw new CallApiError(409, "This call is not one a rep talks on");
  if (isTerminalStatus(row.status)) throw new CallApiError(409, "This call is already over");
  if (row.remoteRep.answer == null) return "store";
  // A retried post of the same answer is fine; a second, different one is not.
  if (row.remoteRep.answer === answer) return "repeat";
  throw new CallApiError(409, "This call has already been answered");
}

/** Stores the station's answer, once — run inside withRecorderScope. */
export async function recordRtcAnswer(row: CallSessionRow, answer: string): Promise<void> {
  if (assertRtcAnswerAllowed(row, answer) === "repeat") return;
  const [stored] = await db
    .update(callSessions)
    .set({ remoteRep: sql`jsonb_set(${callSessions.remoteRep}, '{answer}', to_jsonb(${answer}::text))`, updatedAt: new Date() })
    .where(
      and(
        inOrg(callSessions),
        eq(callSessions.id, row.id),
        isNotNull(callSessions.remoteRep),
        sql`${callSessions.remoteRep}->>'answer' IS NULL`,
        inArray(callSessions.status, ["pending", "in_progress"]),
      ),
    )
    .returning({ remoteRep: callSessions.remoteRep, status: callSessions.status });
  if (stored) return;
  // Raced with another post, or the call ended meanwhile: judge against what is there now.
  const [current] = await db
    .select({ remoteRep: callSessions.remoteRep, status: callSessions.status })
    .from(callSessions)
    .where(and(inOrg(callSessions), eq(callSessions.id, row.id)))
    .limit(1);
  if (!current) throw new CallApiError(404, "Call not found");
  if (assertRtcAnswerAllowed(current, answer) === "store") throw new CallApiError(409, "The answer could not be stored");
}
