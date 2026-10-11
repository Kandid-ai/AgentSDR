import "server-only";

import { timingSafeEqual } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, people } from "@/lib/leads/schema";
import { personCompanyName } from "@/lib/leads/companyName";
import { getPlatformCredentials } from "@/lib/platform/credentials";
import { currentOrganizationId, inOrg, runInOrganization } from "@/lib/tenancy/scope";
import { callSessions, callingStations } from "./schema";
import { normalizePhone } from "./phone";
import { CallApiError, finishCall, recorderLeadFor } from "./sessions";
import { createRecorderToken } from "./token";
import {
  STATION_LAUNCHERS,
  type CallingStation,
  type CloudCallPhase,
  type CreateStationRequest,
  type StationLauncher,
  type UpdateStationRequest,
  type WorkerCallStatus,
  type WorkerClaimRequest,
  type WorkerJob,
  type WorkerStation,
  type WorkerStationStateRequest,
} from "./stationContract";
import { MAX_AGENT_BRIEF_CHARS, TERMINAL_CALL_STATUSES, type RecorderCallPhase } from "./contract";

/**
 * Cloud calling stations: WhatsApp numbers whose WhatsApp Web runs in a remote
 * browser that the call worker (services/call-worker) opens for each job.
 * The app manages them in its organization's scope; the worker's API is
 * platform-wide — it claims across organizations, like the grid worker, and
 * runs each job's reads in the organization the station belongs to.
 *
 * A cloud call is a call_sessions row with mode "agent_cloud" and a station.
 * It waits unclaimed (status pending, claimed_at null) until a worker that can
 * open its station's launcher claims it; the claim mints the recorder token
 * the extension in that browser will report with. One call at a time per
 * station: the claim locks the station row and skips stations already on a
 * call.
 */

type StationRow = typeof callingStations.$inferSelect;
type CallSessionRow = typeof callSessions.$inferSelect;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
/** A link attempt whose worker has said nothing for this long is offered to another worker. */
const LINK_STALE_MS = 5 * 60 * 1000;
/** Cloud calls nobody claimed in this long are failed rather than placed hours late. */
export const CLOUD_UNCLAIMED_EXPIRES_MS = 15 * 60 * 1000;
/** A claimed cloud call still open after this long lost its worker (the worker gives a call 30 minutes). */
export const CLOUD_CLAIMED_EXPIRES_MS = 45 * 60 * 1000;
const OPEN_STATUSES = ["pending", "in_progress"] as const;

// --- the app's view -------------------------------------------------------------

export function toCallingStation(row: StationRow, busyCallId: string | null): CallingStation {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    launcher: row.launcher,
    gologinProfileId: row.gologinProfileId,
    status: row.status,
    busyCallId,
    link: row.linkRequestedAt
      ? {
          requestedAt: row.linkRequestedAt.toISOString(),
          code: row.linkCode,
          screenshot: row.linkScreenshot,
          updatedAt: row.linkUpdatedAt ? row.linkUpdatedAt.toISOString() : null,
        }
      : null,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    lastCallAt: row.lastCallAt ? row.lastCallAt.toISOString() : null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The open, claimed cloud call on each of `stationIds`. */
async function busyCalls(stationIds: string[]): Promise<Map<string, string>> {
  if (stationIds.length === 0) return new Map();
  const rows = await db
    .select({ id: callSessions.id, stationId: callSessions.stationId })
    .from(callSessions)
    .where(
      and(
        inOrg(callSessions),
        eq(callSessions.mode, "agent_cloud"),
        inArray(callSessions.stationId, stationIds),
        inArray(callSessions.status, [...OPEN_STATUSES]),
        isNotNull(callSessions.claimedAt),
      ),
    );
  return new Map(rows.flatMap((row) => (row.stationId ? [[row.stationId, row.id] as const] : [])));
}

export async function listStations(): Promise<CallingStation[]> {
  const rows = await db.select().from(callingStations).where(inOrg(callingStations)).orderBy(asc(callingStations.createdAt));
  const busy = await busyCalls(rows.map((row) => row.id));
  return rows.map((row) => toCallingStation(row, busy.get(row.id) ?? null));
}

async function requireStation(id: string): Promise<StationRow> {
  if (!UUID_PATTERN.test(id)) throw new CallApiError(404, "Calling number not found");
  const [row] = await db.select().from(callingStations).where(and(inOrg(callingStations), eq(callingStations.id, id))).limit(1);
  if (!row) throw new CallApiError(404, "Calling number not found");
  return row;
}

async function stationView(row: StationRow): Promise<CallingStation> {
  return toCallingStation(row, (await busyCalls([row.id])).get(row.id) ?? null);
}

function parseLauncher(value: unknown): StationLauncher {
  if (typeof value === "string" && (STATION_LAUNCHERS as readonly string[]).includes(value)) return value as StationLauncher;
  throw new CallApiError(400, `launcher must be one of ${STATION_LAUNCHERS.join(", ")}`);
}

function parseName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new CallApiError(400, "Give the number a name");
  if (name.length > 80) throw new CallApiError(400, "The name is over 80 characters");
  return name;
}

function parseProfileId(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > 100) throw new CallApiError(400, "gologinProfileId must be a GoLogin profile id");
  return value.trim();
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CallApiError(400, "Expected a JSON object");
  return value as Record<string, unknown>;
}

export function parseCreateStationRequest(value: unknown): CreateStationRequest {
  const body = asObject(value);
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
  if (!phone) throw new CallApiError(400, "Enter the number with its country code, e.g. +91…");
  return { name: parseName(body.name), phone, launcher: parseLauncher(body.launcher), gologinProfileId: parseProfileId(body.gologinProfileId) };
}

export function parseUpdateStationRequest(value: unknown): UpdateStationRequest {
  const body = asObject(value);
  const update: UpdateStationRequest = {};
  if (body.name !== undefined) update.name = parseName(body.name);
  if (body.launcher !== undefined) update.launcher = parseLauncher(body.launcher);
  if (body.gologinProfileId !== undefined) update.gologinProfileId = parseProfileId(body.gologinProfileId);
  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "paused") throw new CallApiError(400, "status can only be set to active or paused");
    update.status = body.status;
  }
  return update;
}

export async function createStation(input: CreateStationRequest): Promise<CallingStation> {
  if (input.launcher !== "local" && !input.gologinProfileId) {
    throw new CallApiError(400, "A GoLogin number needs its GoLogin profile id");
  }
  const [existing] = await db
    .select({ id: callingStations.id })
    .from(callingStations)
    .where(and(inOrg(callingStations), eq(callingStations.phone, input.phone)))
    .limit(1);
  if (existing) throw new CallApiError(409, "That number is already a calling number");
  const [row] = await db
    .insert(callingStations)
    .values({
      organizationId: currentOrganizationId(),
      name: input.name,
      phone: input.phone,
      launcher: input.launcher,
      gologinProfileId: input.gologinProfileId ?? null,
    })
    .returning();
  if (!row) throw new Error("calling_stations insert did not return a row");
  return toCallingStation(row, null);
}

export async function updateStation(id: string, input: UpdateStationRequest): Promise<CallingStation> {
  const current = await requireStation(id);
  const launcher = input.launcher ?? current.launcher;
  const profileId = input.gologinProfileId !== undefined ? input.gologinProfileId : current.gologinProfileId;
  if (launcher !== "local" && !profileId) throw new CallApiError(400, "A GoLogin number needs its GoLogin profile id");
  if (input.status === "active" && current.status === "banned") throw new CallApiError(409, "A banned number can't be resumed");
  const [row] = await db
    .update(callingStations)
    .set({ ...input, updatedAt: new Date() })
    .where(and(inOrg(callingStations), eq(callingStations.id, id)))
    .returning();
  return stationView(row ?? current);
}

export async function deleteStation(id: string): Promise<void> {
  await requireStation(id);
  const busy = await busyCalls([id]);
  if (busy.size > 0) throw new CallApiError(409, "This number is on a call — wait for it to end");
  await db.delete(callingStations).where(and(inOrg(callingStations), eq(callingStations.id, id)));
}

/** The operator wants WhatsApp Web linked: the next free worker opens its login screen. */
export async function requestLink(id: string): Promise<CallingStation> {
  const current = await requireStation(id);
  if (current.status === "banned") throw new CallApiError(409, "A banned number can't be linked");
  const [row] = await db
    .update(callingStations)
    .set({ linkRequestedAt: new Date(), linkCode: null, linkScreenshot: null, linkUpdatedAt: null, lastError: null, updatedAt: new Date() })
    .where(and(inOrg(callingStations), eq(callingStations.id, id)))
    .returning();
  return stationView(row ?? current);
}

export async function cancelLink(id: string): Promise<CallingStation> {
  const current = await requireStation(id);
  const [row] = await db
    .update(callingStations)
    .set({ linkRequestedAt: null, linkCode: null, linkScreenshot: null, linkUpdatedAt: null, updatedAt: new Date() })
    .where(and(inOrg(callingStations), eq(callingStations.id, id)))
    .returning();
  return stationView(row ?? current);
}

// --- queueing a cloud call (from startCall) ---------------------------------------

/**
 * The station a cloud call goes out from: the one asked for, or the active
 * station that has gone longest without a call. Checked here, in the rep's
 * request, so a misconfigured number fails at the click rather than later.
 */
export async function stationForCloudCall(stationId: string | null | undefined, brief: string | null | undefined): Promise<{ station: StationRow; brief: string }> {
  const trimmed = brief?.trim() ?? "";
  if (!trimmed) throw new CallApiError(400, "The AI agent needs a brief");
  if (trimmed.length > MAX_AGENT_BRIEF_CHARS) throw new CallApiError(400, `The brief is over ${MAX_AGENT_BRIEF_CHARS} characters`);

  let station: StationRow | undefined;
  if (stationId) {
    station = await requireStation(stationId);
    if (station.status !== "active") throw new CallApiError(409, `${station.name} isn't active (${station.status.replace("_", " ")})`);
  } else {
    [station] = await db
      .select()
      .from(callingStations)
      .where(and(inOrg(callingStations), eq(callingStations.status, "active")))
      .orderBy(sql`${callingStations.lastCallAt} asc nulls first`)
      .limit(1);
    if (!station) throw new CallApiError(409, "No active cloud calling number — add one in Settings → WhatsApp → Calling numbers");
  }
  if (station.launcher !== "local" && !(await getPlatformCredentials("gologin"))) {
    throw new CallApiError(409, "Connect GoLogin in Settings → WhatsApp → Integrations to call from this number");
  }
  return { station, brief: trimmed };
}

export const QUEUED_PHASE: CloudCallPhase = { kind: "queued" };

// --- cloud calls that never finish ----------------------------------------------

/**
 * Closes cloud calls nobody will finish: never claimed (no worker can open
 * the station) or claimed by a worker that stopped reporting. Run in the
 * organization's scope, with the other stale-call sweeps.
 */
export async function expireStaleCloudCalls(): Promise<CallSessionRow[]> {
  const now = new Date();
  const [unclaimed, lost] = await Promise.all([
    db
      .update(callSessions)
      .set({
        status: "failed",
        error: "No call worker picked this call up within 15 minutes — is one running for this number?",
        livePhase: { kind: "error", message: "No call worker picked this call up", savedLocally: false },
        updatedAt: now,
      })
      .where(
        and(
          inOrg(callSessions),
          eq(callSessions.mode, "agent_cloud"),
          eq(callSessions.status, "pending"),
          isNull(callSessions.claimedAt),
          lt(callSessions.createdAt, new Date(now.getTime() - CLOUD_UNCLAIMED_EXPIRES_MS)),
        ),
      )
      .returning(),
    db
      .update(callSessions)
      .set({
        status: "failed",
        error: "The call worker stopped reporting on this call",
        livePhase: { kind: "error", message: "The call worker stopped reporting", savedLocally: false },
        updatedAt: now,
      })
      .where(
        and(
          inOrg(callSessions),
          eq(callSessions.mode, "agent_cloud"),
          inArray(callSessions.status, [...OPEN_STATUSES]),
          lt(callSessions.claimedAt, new Date(now.getTime() - CLOUD_CLAIMED_EXPIRES_MS)),
        ),
      )
      .returning(),
  ]);
  return [...unclaimed, ...lost];
}

// --- the worker's API ---------------------------------------------------------------

/** Constant-time check of the worker's bearer token against CALL_WORKER_SECRET. */
export function authorizeWorker(request: Request): void {
  const secret = process.env.CALL_WORKER_SECRET?.trim();
  if (!secret) throw new CallApiError(503, "Cloud calling is not set up on this server (CALL_WORKER_SECRET is missing)");
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/.exec(header)?.[1]?.trim() ?? "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new CallApiError(401, "Invalid worker token");
}

export function parseWorkerClaimRequest(value: unknown): WorkerClaimRequest {
  const body = asObject(value);
  const workerId = typeof body.workerId === "string" && body.workerId.trim() ? body.workerId.trim().slice(0, 100) : null;
  if (!workerId) throw new CallApiError(400, "workerId is required");
  if (!Array.isArray(body.launchers) || body.launchers.length === 0) throw new CallApiError(400, "launchers is required");
  return { workerId, launchers: body.launchers.map(parseLauncher) };
}

async function workerStation(row: StationRow): Promise<WorkerStation> {
  const gologin = row.launcher === "local" ? null : await runInOrganization(row.organizationId, () => getPlatformCredentials("gologin"));
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    phone: row.phone,
    launcher: row.launcher,
    gologinProfileId: row.gologinProfileId,
    gologinToken: gologin?.apiToken ?? null,
  };
}

/**
 * The next job for a worker: a queued cloud call on a free station it can
 * open, else a station waiting to be linked. Global (no organization scope),
 * like the grid worker's claim; each job names its organization.
 */
export async function claimWorkerJob(input: WorkerClaimRequest): Promise<WorkerJob | null> {
  return (await claimCall(input)) ?? (await claimLink(input));
}

/** A station is free when no claimed cloud call on it is still open. */
const stationIsFree = sql`NOT EXISTS (
  SELECT 1 FROM call_sessions busy
   WHERE busy.station_id = ${callingStations.id}
     AND busy.mode = 'agent_cloud'
     AND busy.claimed_at IS NOT NULL
     AND busy.status IN ('pending', 'in_progress'))`;

async function claimCall({ workerId, launchers }: WorkerClaimRequest): Promise<WorkerJob | null> {
  const claimed = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ call: callSessions, station: callingStations })
      .from(callSessions)
      .innerJoin(
        callingStations,
        and(eq(callingStations.id, callSessions.stationId), eq(callingStations.organizationId, callSessions.organizationId)),
      )
      .where(
        and(
          eq(callSessions.mode, "agent_cloud"),
          eq(callSessions.status, "pending"),
          isNull(callSessions.claimedAt),
          eq(callingStations.status, "active"),
          inArray(callingStations.launcher, launchers),
          stationIsFree,
        ),
      )
      .orderBy(asc(callSessions.createdAt))
      .limit(1)
      .for("update", { of: [callSessions, callingStations], skipLocked: true });
    if (!locked) return null;

    const now = new Date();
    const { token, hash } = createRecorderToken();
    const startingPhase: CloudCallPhase = { kind: "starting-browser" };
    await tx
      .update(callSessions)
      .set({
        claimedAt: now,
        claimedBy: workerId,
        uploadTokenHash: hash,
        tokenExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
        livePhase: startingPhase,
        updatedAt: now,
      })
      .where(eq(callSessions.id, locked.call.id));
    await tx
      .update(callingStations)
      .set({ workerId, lastCallAt: now, updatedAt: now })
      .where(eq(callingStations.id, locked.station.id));
    return { ...locked, token };
  });
  if (!claimed) return null;

  const { call, station, token } = claimed;
  const lead = await runInOrganization(call.organizationId, async () => {
    const [found] = await db
      .select({ person: people, companyName: companies.name })
      .from(people)
      .leftJoin(companies, eq(people.companyId, companies.id))
      .where(and(inOrg(people), eq(people.id, call.personId)))
      .limit(1);
    return found ? recorderLeadFor(found.person, personCompanyName(found.person.raw, found.companyName)) : null;
  });
  return {
    kind: "call",
    station: await workerStation(station),
    call: { id: call.id, phone: call.phone, recorderToken: token, lead, brief: call.agentBrief ?? "" },
  };
}

async function claimLink({ workerId, launchers }: WorkerClaimRequest): Promise<WorkerJob | null> {
  const station = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(callingStations)
      .where(
        and(
          isNotNull(callingStations.linkRequestedAt),
          ne(callingStations.status, "banned"),
          inArray(callingStations.launcher, launchers),
          or(isNull(callingStations.linkUpdatedAt), lt(callingStations.linkUpdatedAt, new Date(Date.now() - LINK_STALE_MS))),
          stationIsFree,
        ),
      )
      .orderBy(asc(callingStations.linkRequestedAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!locked) return null;
    await tx
      .update(callingStations)
      .set({ workerId, linkUpdatedAt: new Date(), updatedAt: new Date() })
      .where(eq(callingStations.id, locked.id));
    return locked;
  });
  return station ? { kind: "link", station: await workerStation(station) } : null;
}

async function workerStationRow(id: string): Promise<StationRow> {
  if (!UUID_PATTERN.test(id)) throw new CallApiError(404, "Calling number not found");
  // Deliberately unscoped: the worker serves every organization, and the
  // station row is how it names one.
  const [row] = await db.select().from(callingStations).where(eq(callingStations.id, id)).limit(1);
  if (!row) throw new CallApiError(404, "Calling number not found");
  return row;
}

export function parseWorkerStationStateRequest(value: unknown): WorkerStationStateRequest {
  const body = asObject(value);
  const state: WorkerStationStateRequest = {};
  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "logged_out") throw new CallApiError(400, "status must be active or logged_out");
    state.status = body.status;
  }
  if (body.link !== undefined) {
    if (body.link === null) state.link = null;
    else {
      const link = asObject(body.link);
      const code = typeof link.code === "string" ? link.code.slice(0, 20) : null;
      const screenshot =
        typeof link.screenshot === "string" && /^data:image\/(png|jpeg);base64,/.test(link.screenshot) && link.screenshot.length < 2_000_000
          ? link.screenshot
          : null;
      state.link = { code, screenshot };
    }
  }
  if (body.linkDone !== undefined) state.linkDone = body.linkDone === true;
  if (body.error !== undefined) state.error = typeof body.error === "string" ? body.error.slice(0, 500) : null;
  return state;
}

export async function reportStationState(id: string, state: WorkerStationStateRequest): Promise<void> {
  const row = await workerStationRow(id);
  const now = new Date();
  const set: Partial<StationRow> = { lastSeenAt: now, updatedAt: now };
  if (state.status === "logged_out") set.status = row.status === "banned" ? "banned" : "logged_out";
  // Logged in again: back to active, unless the operator paused it (or it is banned).
  if (state.status === "active" && row.status !== "paused" && row.status !== "banned") set.status = "active";
  if (state.link !== undefined) {
    set.linkCode = state.link?.code ?? null;
    set.linkScreenshot = state.link?.screenshot ?? null;
    set.linkUpdatedAt = now;
  }
  if (state.linkDone) {
    set.linkRequestedAt = null;
    set.linkCode = null;
    set.linkScreenshot = null;
    set.linkUpdatedAt = null;
  }
  if (state.error !== undefined) set.lastError = state.error;
  else if (state.status === "active") set.lastError = null;
  await db.update(callingStations).set(set).where(eq(callingStations.id, row.id));
}

async function workerCallRow(id: string): Promise<CallSessionRow> {
  if (!UUID_PATTERN.test(id)) throw new CallApiError(404, "Call not found");
  // Deliberately unscoped, like workerStationRow; only cloud calls are the worker's.
  const [row] = await db
    .select()
    .from(callSessions)
    .where(and(eq(callSessions.id, id), eq(callSessions.mode, "agent_cloud")))
    .limit(1);
  if (!row) throw new CallApiError(404, "Call not found");
  return row;
}

export async function workerCallStatus(id: string): Promise<WorkerCallStatus> {
  const row = await workerCallRow(id);
  return { status: row.status, done: (TERMINAL_CALL_STATUSES as readonly string[]).includes(row.status) };
}

/** The worker could not run the call (logged out, browser failed): it is failed, through the usual finish path. */
export async function releaseCall(id: string, error: string): Promise<void> {
  const row = await workerCallRow(id);
  await runInOrganization(row.organizationId, async () => {
    const message = error.trim().slice(0, 500) || "The call worker could not place the call";
    await db
      .update(callSessions)
      .set({ livePhase: { kind: "error", message, savedLocally: false }, updatedAt: new Date() })
      .where(and(inOrg(callSessions), eq(callSessions.id, row.id)));
    await finishCall(row, { outcome: "failed", error: message });
  });
}

// --- the extension's phase reports (station mode) -----------------------------------

export function parsePhaseRequest(value: unknown): RecorderCallPhase {
  const body = asObject(value);
  const phase = body.phase;
  if (!phase || typeof phase !== "object" || typeof (phase as { kind?: unknown }).kind !== "string") {
    throw new CallApiError(400, "phase must be a call phase");
  }
  // Stored as given for the rep's page to show; it is the extension's own shape and size-bounded.
  if (JSON.stringify(phase).length > 2_000) throw new CallApiError(400, "phase is too large");
  return phase as RecorderCallPhase;
}

/** POST /api/call-recorder/calls/:id/phase — run inside withRecorderScope. */
export async function recordPhase(row: CallSessionRow, phase: RecorderCallPhase): Promise<void> {
  if (row.mode !== "agent_cloud") return;
  await db
    .update(callSessions)
    .set({ livePhase: phase, updatedAt: new Date() })
    .where(and(inOrg(callSessions), eq(callSessions.id, row.id)));
}
