import "server-only";

/**
 * The rep dialer's server half (spec: dialer.ts). Runs inside the
 * organization's scope (the routes open it). The engine (engine.ts) owns the
 * rules. This module only decides which lead a rep calls next and records
 * how the call went.
 */
import { and, asc, count, eq, gt, inArray, isNotNull, lte, min, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { channelRules } from "@/lib/channels/rules.server";
import { isPersonDoNotContact } from "@/lib/crm/policies";
import { personCompanyName } from "@/lib/leads/companyName";
import { companies, people } from "@/lib/leads/schema";
import { isMigrationControlPaused } from "@/lib/migration/controls";
import { latestDailySlot } from "@/lib/scheduler/slots";
import { inOrg } from "@/lib/tenancy/scope";
import { WhatsappApiError, WhatsappSendRefusedError } from "@/lib/whatsapp/errors";
import { queueStationMessage } from "@/lib/whatsapp/stationMessaging";
import type { AgentOutcome } from "../contract";
import { syncCallFollowUpSafely } from "../crmFollowUp";
import { callCampaignContacts, callCampaigns, callCampaignStations, callCampaignStepRuns, callSessions, callingStations } from "../schema";
import { CallApiError, startCall } from "../sessions";
import { currentStepLabel } from "./campaigns.server";
import { AI_OPEN_STATUSES } from "./contract";
import {
  REP_CALL_OUTCOMES,
  REP_MESSAGE_MAX_CHARS,
  REP_NOTES_MAX_CHARS,
  REP_OUTCOME_AS_AGENT,
  repOutcomeTakesTime,
  type DialerLead,
  type DialerMessageRequest,
  type DialerMessageResponse,
  type DialerNextRequest,
  type DialerNextResponse,
  type DialerNumber,
  type DialerOverview,
  type DialerWrapUpRequest,
  type DialerWrapUpResponse,
  type RepCallOutcome,
} from "./dialer";
import {
  actForStation,
  bookingLinkSent,
  claimStep,
  contactInScope,
  decisionOf,
  engineCampaign,
  engineContact,
  failStart,
  moveOnFromExistingRun,
  nextActionIsCall,
  pickDialerContact,
  settleOrganization,
  writeDecision,
  type AiCallingTickResult,
  type CampaignRow,
  type ContactRow,
  type StationRow,
} from "./engine";
import { dailyCallLimit, plannedAction, withinCallingHours } from "./engineRules";

/** A number busy with a call that is ending: ask again this soon. */
const BUSY_RETRY_MS = 2_000;
/** Leads looked at on one number before moving on. */
const MAX_PICKS = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: unknown, what: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new CallApiError(400, `${what} id is invalid`);
  return value;
}

function asObject(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CallApiError(400, "Expected a JSON object");
  const body = value as Record<string, unknown>;
  const unknown = Object.keys(body).find((key) => !allowed.includes(key));
  if (unknown) throw new CallApiError(400, `Unknown field: ${unknown}`);
  return body;
}

// --- requests -------------------------------------------------------------------------

export function parseDialerNextRequest(value: unknown): DialerNextRequest {
  if (value === null || value === undefined) return {};
  const body = asObject(value, ["preferContactId"]);
  if (body.preferContactId === undefined || body.preferContactId === null) return {};
  return { preferContactId: assertUuid(body.preferContactId, "Lead") };
}

export function parseDialerWrapUpRequest(value: unknown): DialerWrapUpRequest {
  const body = asObject(value, ["callId", "outcome", "whenAt", "notes"]);
  const callId = assertUuid(body.callId, "Call");
  if (!(REP_CALL_OUTCOMES as readonly unknown[]).includes(body.outcome)) throw new CallApiError(400, "Choose how the call went");
  const outcome = body.outcome as RepCallOutcome;
  let whenAt: string | null = null;
  if (body.whenAt !== undefined && body.whenAt !== null && body.whenAt !== "") {
    const time = typeof body.whenAt === "string" ? Date.parse(body.whenAt) : NaN;
    if (!Number.isFinite(time)) throw new CallApiError(400, "The time is not a valid date");
    whenAt = new Date(time).toISOString();
  }
  if (repOutcomeTakesTime(outcome) === "required" && !whenAt) throw new CallApiError(400, "Choose when to call back");
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== "string") throw new CallApiError(400, "notes must be text");
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > REP_NOTES_MAX_CHARS) throw new CallApiError(400, `Notes must be at most ${REP_NOTES_MAX_CHARS} characters`);
  return { callId, outcome, whenAt: repOutcomeTakesTime(outcome) ? whenAt : null, notes: notes || null };
}

export function parseDialerMessageRequest(value: unknown): DialerMessageRequest {
  const body = asObject(value, ["contactId", "body"]);
  const contactId = assertUuid(body.contactId, "Lead");
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) throw new CallApiError(400, "Write the message first");
  if (text.length > REP_MESSAGE_MAX_CHARS) throw new CallApiError(400, `The message must be at most ${REP_MESSAGE_MAX_CHARS} characters`);
  return { contactId, body: text };
}

// --- shared ---------------------------------------------------------------------------

/** A rep's campaign of this organization (any state); 404 for anything else. */
async function loadRepCampaign(campaignId: string): Promise<CampaignRow> {
  assertUuid(campaignId, "Campaign");
  const [row] = await db
    .select()
    .from(callCampaigns)
    .where(and(inOrg(callCampaigns), eq(callCampaigns.id, campaignId), eq(callCampaigns.runBy, "ai"), sql`${callCampaigns.archivedAt} is null`))
    .limit(1);
  if (!row) throw new CallApiError(404, "Campaign not found");
  if (row.aiCaller !== "rep") throw new CallApiError(409, "This campaign's calls are made by the AI agent, not the dialer");
  return row;
}

type DialerStation = {
  station: StationRow;
  /** Active, and linked to its own phone. */
  usable: boolean;
  open: boolean;
  withinHours: boolean;
  callsToday: number;
  limit: number;
};

/** The organization's day start, the WhatsApp rules, and the campaign's numbers with where each stands now. */
async function campaignNumbers(campaignId: string, now: Date): Promise<{ dayStart: Date; numbers: DialerStation[]; gapMinutes: [number, number] }> {
  const rules = await channelRules("whatsapp");
  const general = await channelRules("general");
  const dayStart = latestDailySlot(general.timeZone, general.dayStartsAt, now);
  const rows = await db
    .select({
      station: callingStations,
      // Qualified on purpose: see candidateStations in engine.ts.
      callsToday: sql<number>`(select count(*)::int from ${callSessions} today
                                where today.organization_id = calling_stations.organization_id
                                  and today.station_id = calling_stations.id
                                  and today.mode = 'agent_cloud'
                                  and today.created_at >= ${dayStart.toISOString()}::timestamptz)`,
    })
    .from(callCampaignStations)
    .innerJoin(callingStations, eq(callingStations.id, callCampaignStations.stationId))
    .where(and(eq(callCampaignStations.campaignId, campaignId), inOrg(callingStations)))
    // The number used longest ago first: calls rotate across numbers.
    .orderBy(sql`${callingStations.lastCallAt} asc nulls first`, asc(callingStations.name));
  const numbers = rows.map(({ station, callsToday }) => ({
    station,
    usable: station.status === "active" && (!station.linkedPhone || station.linkedPhone === station.phone),
    open: !!station.leaseUntil && station.leaseUntil.getTime() > now.getTime(),
    withinHours: withinCallingHours(station.callingHours ?? rules.callingHours, now),
    callsToday: Number(callsToday),
    limit: dailyCallLimit({
      stationLimit: station.callsPerDay,
      ruleLimit: rules.callsPerDay,
      warmupDays: rules.callWarmupDays,
      automationStartedAt: station.automationStartedAt,
      now,
    }),
  }));
  return { dayStart, numbers, gapMinutes: rules.callGapMinutes };
}

/** The campaign's leads with a call due: how many now, and when the next one after now is. */
async function dueCalls(campaignId: string, now: Date): Promise<{ dueNow: number; nextDueAt: Date | null }> {
  const base = and(
    eq(callCampaignContacts.campaignId, campaignId),
    contactInScope(),
    inArray(callCampaignContacts.aiStatus, [...AI_OPEN_STATUSES]),
    isNotNull(callCampaignContacts.aiNextAt),
    nextActionIsCall,
  );
  const join = sql`own_campaign.id = ${callCampaignContacts.campaignId}`;
  const [[due], [next]] = await Promise.all([
    db
      .select({ n: count() })
      .from(callCampaignContacts)
      .innerJoin(sql`${callCampaigns} own_campaign`, join)
      .where(and(base, lte(callCampaignContacts.aiNextAt, now))),
    db
      .select({ at: min(callCampaignContacts.aiNextAt) })
      .from(callCampaignContacts)
      .innerJoin(sql`${callCampaigns} own_campaign`, join)
      .where(and(base, gt(callCampaignContacts.aiNextAt, now))),
  ]);
  return { dueNow: Number(due?.n ?? 0), nextDueAt: next?.at ?? null };
}

function personName(person: typeof people.$inferSelect): string {
  return person.fullName?.trim() || [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.phone || "Unknown";
}

// --- next call ------------------------------------------------------------------------

type Placement = { kind: "calling"; response: Extract<DialerNextResponse, { kind: "calling" }> } | { kind: "busy" } | { kind: "none" };

/**
 * Picks and places the next call: settles what has finished, sends any
 * WhatsApp step that is due from each number (with the rep dialing back to
 * back, the engine's tick would rarely find the number free), then claims the
 * most urgent due call on the least recently used free number.
 */
export async function dialNext(campaignId: string, request: DialerNextRequest): Promise<DialerNextResponse> {
  const campaign = await loadRepCampaign(campaignId);
  if (!campaign.aiLaunchedAt) throw new CallApiError(409, "Launch the campaign before you start calling");
  if (campaign.status !== "active") throw new CallApiError(409, "The campaign is paused — resume it to start calling");
  if (isMigrationControlPaused("aiCalling")) {
    return { kind: "idle", message: "Calling is switched off on this server (PAUSE_AI_CALLING)", nextDueAt: null };
  }

  await settleOrganization();
  const unfinished = await pendingWrapUp(campaign);
  if (unfinished) return unfinished;
  const now = new Date();
  const { numbers, gapMinutes } = await campaignNumbers(campaign.id, now);
  if (!numbers.length) return { kind: "idle", message: "Choose a calling number for this campaign first", nextDueAt: null };
  const ready = numbers.filter((number) => number.usable && number.open);
  if (!ready.length) {
    return { kind: "idle", message: "None of this campaign's numbers is open right now: the call worker is not running them", nextDueAt: null };
  }

  // The lead just called keeps its number: try that one first, so an instant redial goes out at once.
  const prefer = request.preferContactId ?? null;
  if (prefer) {
    const [preferred] = await db
      .select({ stationId: callCampaignContacts.aiStationId })
      .from(callCampaignContacts)
      .where(and(contactInScope(), eq(callCampaignContacts.id, prefer), eq(callCampaignContacts.campaignId, campaign.id)))
      .limit(1);
    if (preferred?.stationId) ready.sort((a, b) => Number(b.station.id === preferred.stationId) - Number(a.station.id === preferred.stationId));
  }

  const tally = { busy: 0, hours: 0, limit: 0 };
  const ignored: AiCallingTickResult = { organizations: 0, settled: 0, calls: 0, messages: 0, failed: 0 };
  for (const number of ready) {
    if (!number.withinHours) {
      tally.hours += 1;
      continue;
    }
    try {
      // Only WhatsApp steps: the engine never picks a rep campaign's calls (pickDueContact).
      await actForStation(number.station, new Map([[campaign.id, campaign]]), false, gapMinutes, now, ignored);
    } catch (error) {
      console.error(`[calls/dialer] sending due messages from ${number.station.id} failed:`, error);
    }
    if (number.callsToday >= number.limit) {
      tally.limit += 1;
      continue;
    }
    const placed = await placeOnStation(number.station, campaign, now, prefer);
    if (placed.kind === "calling") return placed.response;
    if (placed.kind === "busy") tally.busy += 1;
  }

  if (tally.busy) return { kind: "waiting", message: "Waiting for the number to finish its last call…", retryInMs: BUSY_RETRY_MS };
  const { nextDueAt } = await dueCalls(campaign.id, now);
  const next = nextDueAt?.toISOString() ?? null;
  if (tally.limit && tally.limit + tally.hours === ready.length) {
    return { kind: "idle", message: "Every number has reached today's call limit", nextDueAt: next };
  }
  if (tally.hours === ready.length) return { kind: "idle", message: "Outside calling hours", nextDueAt: next };
  return { kind: "idle", message: next ? "No calls due right now" : "No leads left to call", nextDueAt: next };
}

async function placeOnStation(station: StationRow, campaign: CampaignRow, now: Date, prefer: string | null): Promise<Placement> {
  const settings = engineCampaign(campaign);
  const passed: string[] = [];
  for (let picks = 0; picks < MAX_PICKS; picks += 1) {
    const contact = await pickDialerContact(station.id, campaign.id, now, passed, prefer);
    if (!contact) return { kind: "none" };
    passed.push(contact.id);
    const state = engineContact(contact, await bookingLinkSent(contact.id));
    const settle = async (decision: Parameters<typeof writeDecision>[2]) => {
      if (await writeDecision(db, contact.id, decision, now)) await syncCallFollowUpSafely(contact.personId);
    };

    if (await isPersonDoNotContact(db, contact.personId)) {
      await settle({ ...decisionOf(state), status: "stopped", nextAt: null, note: "Do Not Contact" });
      continue;
    }
    const plan = plannedAction(state, settings, now);
    if (plan.kind === "none") {
      await settle(plan.decision);
      continue;
    }
    if (plan.kind !== "call") continue;

    const [lead] = await db
      .select({ person: people, company: companies })
      .from(people)
      .leftJoin(companies, eq(people.companyId, companies.id))
      .where(and(inOrg(people), eq(people.id, contact.personId)))
      .limit(1);
    if (!lead || !lead.person.phone) {
      await settle({ ...decisionOf(state), status: "failed", nextAt: null, note: lead ? "No phone number" : "The person is no longer in this organization" });
      continue;
    }

    const claim = await claimStep({ station, contact, state, plan, now, requireIdle: true });
    if (claim.kind === "station_taken") return { kind: "busy" };
    if (claim.kind === "lost") continue;
    if (claim.kind === "existing") {
      await moveOnFromExistingRun(claim.run, contact, state, settings, now);
      continue;
    }

    let callId: string;
    try {
      const started = await startCall({
        personId: contact.personId,
        campaignContactId: contact.id,
        mode: "agent_cloud",
        stationId: station.id,
        remoteRep: true,
      });
      callId = started.call.id;
      await db.update(callCampaignStepRuns).set({ callSessionId: callId }).where(eq(callCampaignStepRuns.id, claim.run.id));
    } catch (error) {
      await failStart(claim.run.id, contact, state, settings, error, now, "call");
      // Most failures here are the number's (not connected, its browser), not the lead's: tell the rep.
      throw error instanceof CallApiError ? error : new CallApiError(502, error instanceof Error ? error.message : "Could not place the call");
    }
    const stepNote = plan.step?.kind === "call" ? plan.step.instructions.trim() || null : null;
    return { kind: "calling", response: { kind: "calling", callId, numberName: station.name, lead: dialerLead(contact, lead, campaign, stepNote) } };
  }
  return { kind: "none" };
}

/**
 * The oldest picked-up rep call of this campaign still waiting for its
 * wrap-up: its step is open, the call is over and recorded, and nobody gave
 * it an outcome — the tab that placed it was reloaded or closed. The engine
 * would hand it to a person after REP_OUTCOME_GRACE_MS anyway; asking now
 * gets the rep's own word on it while it is fresh.
 */
export async function pendingWrapUp(campaign: CampaignRow): Promise<Extract<DialerNextResponse, { kind: "wrap-up" }> | null> {
  const [row] = await db
    .select({ callId: callSessions.id, contact: callCampaignContacts, person: people, company: companies })
    .from(callCampaignStepRuns)
    .innerJoin(callSessions, and(eq(callSessions.id, callCampaignStepRuns.callSessionId), inOrg(callSessions)))
    .innerJoin(callCampaignContacts, eq(callCampaignContacts.id, callCampaignStepRuns.contactId))
    .innerJoin(people, and(eq(people.id, callCampaignContacts.personId), inOrg(people)))
    .leftJoin(companies, eq(companies.id, people.companyId))
    .where(and(
      contactInScope(),
      eq(callCampaignContacts.campaignId, campaign.id),
      eq(callCampaignStepRuns.status, "started"),
      eq(callCampaignStepRuns.kind, "call"),
      isNotNull(callSessions.remoteRep),
      eq(callSessions.status, "recorded"),
      sql`${callSessions.agentOutcome} is null`,
    ))
    .orderBy(asc(callSessions.createdAt))
    .limit(1);
  if (!row) return null;
  return { kind: "wrap-up", callId: row.callId, lead: dialerLead(row.contact, { person: row.person, company: row.company }, campaign, null) };
}

function dialerLead(
  contact: ContactRow,
  lead: { person: typeof people.$inferSelect; company: typeof companies.$inferSelect | null },
  campaign: CampaignRow,
  stepNote: string | null,
): DialerLead {
  return {
    contactId: contact.id,
    personId: contact.personId,
    name: personName(lead.person),
    company: personCompanyName(lead.person.raw, lead.company?.name ?? null),
    title: lead.person.title ?? null,
    phone: lead.person.phone ?? "",
    stepLabel: currentStepLabel(contact, campaign) ?? "Call",
    stepNote,
    notes: contact.notes,
    status: contact.aiStatus ?? "queued",
    lastNote: contact.aiNote,
    previousCalls: contact.callCount,
  };
}

// --- wrap-up --------------------------------------------------------------------------

/**
 * The rep's word on a call the lead picked up: stored as the call's
 * agent_outcome, so the engine applies it exactly like the agent's
 * record_outcome. The lead's notes keep the rep's note too. Then the call is
 * settled at once, so the lead's next step is in place before the next call.
 */
export async function wrapUpDialerCall(campaignId: string, request: DialerWrapUpRequest): Promise<DialerWrapUpResponse> {
  const campaign = await loadRepCampaign(campaignId);
  const [row] = await db
    .select({ call: callSessions, contact: callCampaignContacts })
    .from(callSessions)
    .innerJoin(callCampaignContacts, eq(callCampaignContacts.id, callSessions.campaignContactId))
    .where(and(inOrg(callSessions), contactInScope(), eq(callSessions.id, request.callId), eq(callCampaignContacts.campaignId, campaign.id)))
    .limit(1);
  if (!row) throw new CallApiError(404, "Call not found");
  if (!row.call.remoteRep) throw new CallApiError(409, "This call was not made by a rep");
  if (row.call.status === "no_recording" || row.call.status === "pending") throw new CallApiError(409, "The lead did not pick up this call");

  const now = new Date();
  const { timeZone } = await channelRules("general");
  const whenAt = request.whenAt ?? null;
  const outcome: AgentOutcome = {
    outcome: REP_OUTCOME_AS_AGENT[request.outcome],
    summary: request.notes ?? null,
    when: whenAt
      ? new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(whenAt))
      : null,
    whenAt,
    recordedAt: now.toISOString(),
  };
  await db.update(callSessions).set({ agentOutcome: outcome, updatedAt: now }).where(and(inOrg(callSessions), eq(callSessions.id, row.call.id)));
  if (request.notes) {
    const day = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" }).format(now);
    const line = `${day}: ${request.notes}`;
    await db
      .update(callCampaignContacts)
      .set({ notes: row.contact.notes?.trim() ? `${row.contact.notes.trim()}\n${line}` : line, updatedAt: now })
      .where(and(contactInScope(), eq(callCampaignContacts.id, row.contact.id)));
  }

  await settleOrganization();
  const [after] = await db
    .select({ status: callCampaignContacts.aiStatus, note: callCampaignContacts.aiNote })
    .from(callCampaignContacts)
    .where(and(contactInScope(), eq(callCampaignContacts.id, row.contact.id)))
    .limit(1);
  return { status: after?.status ?? "queued", note: after?.note ?? null };
}

// --- a message outside the sequence -------------------------------------------------------

/** A WhatsApp from the number that calls this lead (its own, ai_station_id), written by the rep. */
export async function sendDialerMessage(campaignId: string, request: DialerMessageRequest): Promise<DialerMessageResponse> {
  const campaign = await loadRepCampaign(campaignId);
  const [row] = await db
    .select({ contact: callCampaignContacts, phone: people.phone })
    .from(callCampaignContacts)
    .innerJoin(people, eq(people.id, callCampaignContacts.personId))
    .where(and(inOrg(people), contactInScope(), eq(callCampaignContacts.id, request.contactId), eq(callCampaignContacts.campaignId, campaign.id)))
    .limit(1);
  if (!row) throw new CallApiError(404, "Lead not found");
  if (!row.phone) throw new CallApiError(409, "This lead has no phone number");
  if (!row.contact.aiStationId) throw new CallApiError(409, "This lead has not been called from any number yet");
  try {
    const queued = await queueStationMessage({ stationId: row.contact.aiStationId, personId: row.contact.personId, phone: row.phone, body: request.body });
    return { whatsappMessageId: queued.whatsappMessageId };
  } catch (error) {
    if (error instanceof WhatsappSendRefusedError || error instanceof WhatsappApiError) throw new CallApiError(error.status, error.message);
    throw error;
  }
}

// --- the dialer's header ------------------------------------------------------------------

export async function getDialerOverview(campaignId: string): Promise<DialerOverview> {
  const campaign = await loadRepCampaign(campaignId);
  const now = new Date();
  const { dayStart, numbers } = await campaignNumbers(campaign.id, now);
  const [due, [today]] = await Promise.all([
    dueCalls(campaign.id, now),
    db
      .select({
        dials: count(),
        pickedUp: sql<number>`count(*) filter (where ${callSessions.status} = 'recorded' or ${callSessions.agentOutcome} is not null)`.mapWith(Number),
        meetings: sql<number>`count(*) filter (where ${callSessions.agentOutcome}->>'outcome' = 'meeting_booked')`.mapWith(Number),
      })
      .from(callSessions)
      .innerJoin(callCampaignContacts, eq(callCampaignContacts.id, callSessions.campaignContactId))
      .where(and(
        inOrg(callSessions),
        contactInScope(),
        eq(callCampaignContacts.campaignId, campaign.id),
        isNotNull(callSessions.remoteRep),
        eq(callSessions.direction, "outbound"),
        sql`${callSessions.createdAt} >= ${dayStart.toISOString()}::timestamptz`,
        // A call withdrawn before any number took it was never a dial.
        sql`not (${callSessions.status} = 'no_recording' and ${callSessions.claimedAt} is null)`,
      )),
  ]);
  return {
    script: campaign.aiInstructions,
    numbers: numbers.map(
      (number): DialerNumber => ({
        id: number.station.id,
        name: number.station.name,
        open: number.usable && number.open,
        callsToday: number.callsToday,
        limit: number.limit,
        withinHours: number.withinHours,
      }),
    ),
    dueNow: due.dueNow,
    nextDueAt: due.nextDueAt?.toISOString() ?? null,
    today: { dials: Number(today?.dials ?? 0), pickedUp: today?.pickedUp ?? 0, meetings: today?.meetings ?? 0 },
  };
}
