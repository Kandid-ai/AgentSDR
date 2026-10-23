/**
 * Cloud calling: the shapes shared by the app, its API, and the call worker
 * (services/call-worker). Keep this file free of runtime imports — the
 * worker imports it across the repo, like the extension imports contract.ts.
 *
 * A calling station is one WhatsApp number whose WhatsApp Web runs in a
 * remote browser (a GoLogin profile, or Playwright's own Chromium for local
 * testing). The call worker opens that browser for each call and hands the
 * call to the recorder extension inside it (station mode); from there it is
 * the same AI-agent call a rep places from their laptop.
 */

import type { RecorderCallPhase, RecorderLead } from "./contract";

export const STATION_LAUNCHERS = ["cloak", "local", "gologin_sdk", "gologin_cloud"] as const;
/**
 * How the worker opens a station's browser:
 *   cloak          CloakBrowser (stealth Chromium) with a profile folder on the worker's disk; the
 *                  profile keeps its own fixed fingerprint and its WhatsApp login between calls;
 *   local          Playwright's Chromium with a profile folder on the worker's own disk (testing, self-hosted);
 *   gologin_sdk    the GoLogin SDK starts the profile on the worker's machine;
 *   gologin_cloud  GoLogin's Cloud Browser, reached over CDP.
 */
export type StationLauncher = (typeof STATION_LAUNCHERS)[number];

/** The launchers that open a GoLogin profile, and so need its id and the GoLogin integration. */
export function usesGoLogin(launcher: StationLauncher): boolean {
  return launcher === "gologin_sdk" || launcher === "gologin_cloud";
}

export const STATION_STATUSES = ["onboarding", "active", "paused", "logged_out", "banned"] as const;
export type StationStatus = (typeof STATION_STATUSES)[number];

/** A station as the app shows it. */
export type CallingStation = {
  id: string;
  name: string;
  /** E.164. */
  phone: string;
  launcher: StationLauncher;
  gologinProfileId: string | null;
  status: StationStatus;
  /** A call is running on it now. */
  busyCallId: string | null;
  /** Set while the worker is linking WhatsApp Web; see StationLinkState. */
  link: StationLinkState | null;
  lastSeenAt: string | null;
  lastCallAt: string | null;
  lastError: string | null;
  createdAt: string;
};

/**
 * Linking WhatsApp Web on a station: the operator asks for it, a worker opens
 * the browser and shows the login screen; the operator types the 8-character
 * code into the phone's Linked devices (or scans the QR in the screenshot).
 */
export type StationLinkState = {
  requestedAt: string;
  /** "Log in with phone number" code, when the worker could read one. */
  code: string | null;
  /** PNG data URL of WhatsApp Web's login screen, so the QR or code is visible either way. */
  screenshot: string | null;
  updatedAt: string | null;
};

/** GET /api/calling/stations */
export type ListStationsResponse = { stations: CallingStation[] };

/** POST /api/calling/stations */
export type CreateStationRequest = {
  name: string;
  phone: string;
  launcher: StationLauncher;
  gologinProfileId?: string | null;
};

/** PATCH /api/calling/stations/:id — every field optional. */
export type UpdateStationRequest = {
  name?: string;
  launcher?: StationLauncher;
  gologinProfileId?: string | null;
  /** Only active ⇄ paused from the app; the worker sets the rest. */
  status?: "active" | "paused";
};

/** POST /api/calling/stations/:id/link — ask a worker to open WhatsApp Web's login. DELETE cancels it. */
export type StationResponse = { station: CallingStation };

// --- the call worker's API (/api/call-worker/*, Bearer CALL_WORKER_SECRET) ---

/** POST /api/call-worker/claim */
export type WorkerClaimRequest = {
  /** A name for this worker, shown on the station while it holds it. */
  workerId: string;
  /** The launchers this worker can open; it is only given stations that use one of them. */
  launchers: StationLauncher[];
};

export type WorkerStation = {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  launcher: StationLauncher;
  gologinProfileId: string | null;
  /** The organization's GoLogin API token, for the gologin_* launchers. */
  gologinToken: string | null;
};

export type WorkerJob =
  | {
      kind: "call";
      station: WorkerStation;
      call: {
        id: string;
        /** E.164. */
        phone: string;
        /** The call's bearer token for /api/call-recorder/*, minted at claim time. */
        recorderToken: string;
        lead: RecorderLead | null;
        brief: string;
      };
    }
  | { kind: "link"; station: WorkerStation };

export type WorkerClaimResponse = { job: WorkerJob | null };

/** POST /api/call-worker/stations/:id/state — the worker's report on a station. */
export type WorkerStationStateRequest = {
  /** "logged_out" when WhatsApp Web shows its login screen; "active" once it shows the chats. */
  status?: "active" | "logged_out";
  /** While linking: the code and screenshot to show the operator. null clears them. */
  link?: { code: string | null; screenshot: string | null } | null;
  /** The link attempt is over (linked, or given up); clears the request. */
  linkDone?: boolean;
  error?: string | null;
};

/** POST /api/call-worker/calls/:id/release — the worker could not run the call; it is failed with `error`. */
export type WorkerReleaseRequest = { error: string };

/** GET /api/call-worker/calls/:id */
export type WorkerCallStatus = {
  status: "pending" | "in_progress" | "recorded" | "no_recording" | "failed";
  /** Terminal: the call is over and reported (recording uploaded, if any). */
  done: boolean;
};

// --- live phase of a cloud call --------------------------------------------

/** POST /api/call-recorder/calls/:id/phase — from the extension in station mode. */
export type RecorderPhaseRequest = { phase: RecorderCallPhase };

/** The phase a call is in before the extension reports any: queued for a worker, or its browser opening. */
export type CloudCallPhase =
  | { kind: "queued" }
  | { kind: "starting-browser" }
  | RecorderCallPhase;
