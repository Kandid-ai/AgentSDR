import {
  AGENT_OUTCOME_LABELS,
  CALL_DISPOSITION_DEFINITIONS,
  type AgentOutcome,
  type CallDisposition,
  type CallStatus,
} from "@/lib/calls/contract";

/**
 * A call-only CRM record: a called lead whose WhatsApp Calling follow-up date
 * is mirrored onto the record (src/lib/calls/crmFollowUp.ts) — channel
 * "whatsapp" and no reply on any channel. Nothing to quote and no thread to
 * answer: Action required and the record page show it as a follow-up call,
 * with the last call standing in for "their latest message". Client-safe.
 */
export function isCallFollowUpRecord(record: { activeChannel: unknown; latestInboundMessageId: unknown }): boolean {
  return record.activeChannel === "whatsapp" && !record.latestInboundMessageId;
}

/** The call a call-only record follows up, as Action required and the record page show it. */
export type LastCall = {
  id: string;
  /** When it ended (or started, or was placed), ISO. */
  at: string;
  /** "Meeting agreed", "Call back later", "Not connected"…; null when nothing says. */
  outcome: string | null;
  /** One to three sentences from the agent or the transcript; null when there is none. */
  summary: string | null;
};

export type LastCallRow = {
  id: string;
  status: CallStatus;
  disposition: CallDisposition | null;
  agentOutcome: Pick<AgentOutcome, "outcome" | "summary"> | null;
  transcriptSummary: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
};

const STATUS_OUTCOME: Partial<Record<CallStatus, string>> = {
  no_recording: "Not connected",
  failed: "Call failed",
};

function summaryOf(row: LastCallRow): string | null {
  return row.agentOutcome?.summary?.trim() || row.transcriptSummary?.trim() || null;
}

/**
 * The call worth showing from a person's finished calls, newest first: the
 * latest one where something was said or decided (a summary, the agent's
 * outcome or the rep's), so a later unanswered retry does not hide the
 * conversation the follow-up is about; else the latest attempt. Pure.
 */
export function lastCallOf(rows: readonly LastCallRow[]): LastCall | null {
  const row = rows.find((call) => summaryOf(call) || call.agentOutcome || call.disposition) ?? rows[0];
  if (!row) return null;
  const outcome = row.agentOutcome
    ? AGENT_OUTCOME_LABELS[row.agentOutcome.outcome] ?? null
    : row.disposition
    ? CALL_DISPOSITION_DEFINITIONS[row.disposition]?.label ?? null
    : STATUS_OUTCOME[row.status] ?? null;
  return {
    id: row.id,
    at: (row.endedAt ?? row.startedAt ?? row.createdAt).toISOString(),
    outcome,
    summary: summaryOf(row),
  };
}
