import "server-only";

/**
 * AgentSDR's own WhatsApp messaging, through a calling station's WhatsApp Web
 * (no Unipile). A message is reserved as a whatsapp_messages row (origin
 * 'agentsdr') on the station's own whatsapp_accounts row (provider
 * 'station'), and queued as a station_message_jobs row that the station's
 * call worker sends through the open WhatsApp Web; the worker also reports
 * the replies it sees, which land in whatsapp_messages and the CRM exactly
 * like Unipile's.
 *
 * INTERFACE STUB (27 Oct 2026): the AI campaign engine calls
 * queueStationMessage and reads station_message_jobs.status to settle its
 * step; the implementation is being written alongside it.
 */

export type QueueStationMessageInput = {
  stationId: string;
  /** The lead, when known: links the chat to the Person (CRM, Messages tab). */
  personId: string | null;
  /** E.164. */
  phone: string;
  body: string;
};

export type QueuedStationMessage = {
  /** The reserved whatsapp_messages row. */
  whatsappMessageId: string;
  /** The station_message_jobs row; its status says when it was sent or failed. */
  jobId: string;
};

/** Must run inside the station's organization scope (runInOrganization). */
export async function queueStationMessage(input: QueueStationMessageInput): Promise<QueuedStationMessage> {
  void input;
  throw new Error("queueStationMessage is not implemented yet");
}
