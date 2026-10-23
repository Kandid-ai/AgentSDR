import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { crmRecords } from "@/lib/crm/schema";
import { people } from "@/lib/leads/schema";
import type {
  CallCampaignStatus,
  CallDisposition,
  CallStatus,
  CallTranscript,
  CampaignContactStage,
  ContactCallStatus,
  TranscriptStatus,
} from "./contract";
import { organizations } from "@/lib/auth/schema";
import type { CloudCallPhase, StationLauncher, StationStatus } from "./stationContract";

/** Who talks on a call: the rep, the AI agent in the rep's browser, or the AI agent on a cloud station. */
export type CallMode = "rep" | "agent" | "agent_cloud";

/**
 * A cloud calling station: one WhatsApp number whose WhatsApp Web runs in a
 * remote browser that the call worker opens (services/call-worker). Created by
 * scripts/create-calling-stations.ts; see src/lib/calls/stationContract.ts.
 */
export const callingStations = pgTable(
  "calling_stations",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** E.164. */
    phone: text("phone").notNull(),
    launcher: text("launcher").notNull().default("cloak").$type<StationLauncher>(),
    gologinProfileId: text("gologin_profile_id"),
    status: text("status").notNull().default("onboarding").$type<StationStatus>(),
    /** Set while the operator wants WhatsApp Web linked; the worker shows its login screen. */
    linkRequestedAt: timestamp("link_requested_at", { withTimezone: true }),
    linkCode: text("link_code"),
    /** PNG data URL of the login screen (QR or code), cleared once linked. */
    linkScreenshot: text("link_screenshot"),
    linkUpdatedAt: timestamp("link_updated_at", { withTimezone: true }),
    workerId: text("worker_id"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastCallAt: timestamp("last_call_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("calling_stations_organization_idx").on(table.organizationId),
    unique("calling_stations_org_phone_uq").on(table.organizationId, table.phone),
    check("calling_stations_launcher_chk", sql`${table.launcher} IN ('cloak', 'local', 'gologin_sdk', 'gologin_cloud')`),
    check(
      "calling_stations_status_chk",
      sql`${table.status} IN ('onboarding', 'active', 'paused', 'logged_out', 'banned')`,
    ),
  ],
);

/**
 * A cold-calling campaign: the list of people a rep works through. Created
 * with the rest of the calling tables by scripts/create-call-campaigns.ts.
 */
export const callCampaigns = pgTable(
  "call_campaigns",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active").$type<CallCampaignStatus>(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("call_campaigns_organization_idx").on(table.organizationId),
    check("call_campaigns_name_chk", sql`length(btrim(${table.name})) > 0`),
    check("call_campaigns_status_chk", sql`${table.status} IN ('active', 'paused')`),
  ],
);

/**
 * A person in a campaign. `stage` is which tab they sit in; `status` is the
 * outcome of the latest call (or "new"). The person itself lives in `people`,
 * so one lead keeps one identity across email, LinkedIn and calls.
 */
export const callCampaignContacts = pgTable(
  "call_campaign_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    personId: uuid("person_id").notNull(),
    stage: text("stage").notNull().default("to_call").$type<CampaignContactStage>(),
    /**
     * The outcome a rep marked, before call_status replaced it (Sep 2026).
     * Nothing writes it any more; kept so a deployment still running the old
     * code keeps working against the shared database. Drop it once none is.
     */
    status: text("status").notNull().default("new").$type<CallDisposition | "new">(),
    /** Where calling this lead stands; see src/lib/calls/contactCallStatus.ts. */
    callStatus: text("call_status").notNull().default("new").$type<ContactCallStatus>(),
    statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }),
    /** Unanswered (or busy) calls in a row — the retry schedule's position. */
    unansweredAttempts: integer("unanswered_attempts").notNull().default(0),
    /** When to get back to them — a callback time, or a follow-up date. */
    followUpAt: timestamp("follow_up_at", { withTimezone: true }),
    notes: text("notes"),
    callCount: integer("call_count").notNull().default(0),
    lastCalledAt: timestamp("last_called_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.campaignId],
      foreignColumns: [callCampaigns.id],
      name: "call_campaign_contacts_campaign_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.personId],
      foreignColumns: [people.id],
      name: "call_campaign_contacts_person_fk",
    }).onDelete("restrict"),
    unique("call_campaign_contacts_campaign_person_uq").on(table.campaignId, table.personId),
    index("call_campaign_contacts_campaign_stage_idx").on(table.campaignId, table.stage),
    check("call_campaign_contacts_stage_chk", sql`${table.stage} IN ('to_call', 'follow_up', 'done')`),
    check("call_campaign_contacts_call_count_chk", sql`${table.callCount} >= 0`),
    check(
      "call_campaign_contacts_call_status_chk",
      sql`${table.callStatus} IN ('new', 'calling', 'no_answer', 'busy', 'connected', 'not_on_whatsapp', 'wrong_number', 'failed')`,
    ),
    check("call_campaign_contacts_unanswered_attempts_chk", sql`${table.unansweredAttempts} >= 0`),
  ],
);

/**
 * One WhatsApp call placed from the app. The row is created when the rep
 * clicks Call; the recorder extension then reports on it with the per-call
 * token, whose SHA-256 is all the database keeps.
 *
 * The recording itself lives in R2 under `recording_key`; the row is the
 * index into it. scripts/create-call-sessions.ts creates the table.
 */
export const callSessions = pgTable(
  "call_sessions",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id").notNull(),
    /** The CRM record the call was placed from, when there was one. */
    crmRecordId: uuid("crm_record_id"),
    /** The campaign contact the call was placed from, when there was one. */
    campaignContactId: uuid("campaign_contact_id"),
    /** E.164, as dialed ("+919876543210"). */
    phone: text("phone").notNull(),
    status: text("status").notNull().default("pending").$type<CallStatus>(),
    uploadTokenHash: text("upload_token_hash").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    recordingKey: text("recording_key"),
    recordingBytes: integer("recording_bytes"),
    recordingContentType: text("recording_content_type"),
    /** Where the pick-up is in the recording (ringing before it). scripts/add-call-recording-offset.ts. */
    recordingOffsetMs: integer("recording_offset_ms"),
    error: text("error"),
    /** The outcome the rep marked for this call. */
    disposition: text("disposition").$type<CallDisposition>(),
    transcriptStatus: text("transcript_status").notNull().default("none").$type<TranscriptStatus>(),
    transcript: jsonb("transcript").$type<CallTranscript>(),
    transcriptError: text("transcript_error"),
    transcribedAt: timestamp("transcribed_at", { withTimezone: true }),
    /**
     * Who talks: the rep, the AI agent in the rep's own browser, or the AI
     * agent on a cloud calling station. scripts/create-calling-stations.ts.
     */
    mode: text("mode").notNull().default("rep").$type<CallMode>(),
    /** The calling station a cloud call runs on. */
    stationId: uuid("station_id"),
    /** The rep's brief for the AI agent (cloud calls; a laptop agent call keeps it in the extension). */
    agentBrief: text("agent_brief"),
    /** A cloud call's latest phase, as the extension reports it — the rep's page polls it. */
    livePhase: jsonb("live_phase").$type<CloudCallPhase>(),
    /** When a call worker took the cloud call, and which. Null while it waits in the queue. */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    claimedBy: text("claimed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("call_sessions_organization_idx").on(table.organizationId),
    foreignKey({
      columns: [table.stationId],
      foreignColumns: [callingStations.id],
      name: "call_sessions_station_fk",
    }).onDelete("set null"),
    check("call_sessions_mode_chk", sql`${table.mode} IN ('rep', 'agent', 'agent_cloud')`),
    index("call_sessions_cloud_open_idx")
      .on(table.createdAt)
      .where(sql`${table.mode} = 'agent_cloud' AND ${table.status} IN ('pending', 'in_progress')`),
    foreignKey({
      columns: [table.personId],
      foreignColumns: [people.id],
      name: "call_sessions_person_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.crmRecordId],
      foreignColumns: [crmRecords.id],
      name: "call_sessions_crm_record_fk",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.campaignContactId],
      foreignColumns: [callCampaignContacts.id],
      name: "call_sessions_campaign_contact_fk",
    }).onDelete("set null"),
    index("call_sessions_person_created_idx").on(table.personId, table.createdAt),
    check(
      "call_sessions_status_chk",
      sql`${table.status} IN ('pending', 'in_progress', 'recorded', 'no_recording', 'failed')`,
    ),
    check(
      "call_sessions_recording_chk",
      sql`(${table.status} = 'recorded') = (${table.recordingKey} IS NOT NULL)`,
    ),
    check("call_sessions_duration_chk", sql`${table.durationMs} IS NULL OR ${table.durationMs} >= 0`),
    check(
      "call_sessions_transcript_status_chk",
      sql`${table.transcriptStatus} IN ('none', 'pending', 'done', 'failed')`,
    ),
    index("call_sessions_campaign_contact_idx").on(table.campaignContactId),
  ],
);

/**
 * A follow-up message opened in WhatsApp for a lead, prefilled and sent by
 * the rep. "Opened" is all the app can know — the rep presses Enter.
 */
export const callMessages = pgTable(
  "call_messages",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id").notNull(),
    campaignContactId: uuid("campaign_contact_id"),
    /** The call this message follows up on, when there was one. */
    callSessionId: uuid("call_session_id"),
    phone: text("phone").notNull(),
    body: text("body").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("call_messages_organization_idx").on(table.organizationId),
    foreignKey({
      columns: [table.personId],
      foreignColumns: [people.id],
      name: "call_messages_person_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.campaignContactId],
      foreignColumns: [callCampaignContacts.id],
      name: "call_messages_campaign_contact_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.callSessionId],
      foreignColumns: [callSessions.id],
      name: "call_messages_call_session_fk",
    }).onDelete("set null"),
    index("call_messages_campaign_contact_idx").on(table.campaignContactId, table.openedAt),
    check("call_messages_body_chk", sql`length(btrim(${table.body})) > 0`),
  ],
);
