/**
 * Which conversation a follow-up step goes out on. Pure and client-safe (no
 * database): stepChannel.server.ts gathers the facts, this decides.
 *
 * A step is 'same' (the conversation its run is on — what every step did
 * before) or 'other': the person's other channel, email if the run is on
 * LinkedIn and LinkedIn if it is on email, to reach someone who stopped
 * answering on one. WhatsApp has no other channel here.
 *
 * The other channel is only ever the same Person's: their own email address
 * (people.email), or the LinkedIn chat of their own outreach enrollment.
 * When there is no usable one — no address, suppressed, Do Not Contact, the
 * mailbox or LinkedIn account no longer connected, no chat — the step goes
 * out on the run's own conversation instead and says why. It never guesses.
 */
import type { CrmChannel, CrmSequenceStepChannel } from "./schema";

export type OtherChannel = "email" | "linkedin";

/** email ↔ linkedin; null for WhatsApp. */
export function otherChannelOf(channel: CrmChannel): OtherChannel | null {
  if (channel === "email") return "linkedin";
  if (channel === "linkedin") return "email";
  return null;
}

/** Why an 'other' step went out on the run's own conversation. */
export type StepChannelFallbackReason =
  | "no_other_channel"
  | "do_not_contact"
  | "no_email_address"
  | "email_suppressed"
  | "email_do_not_contact"
  | "no_mailbox_emailed_them"
  | "mailbox_not_connected"
  | "no_linkedin_chat"
  | "linkedin_account_not_connected"
  | "conversation_conflict";

export const STEP_CHANNEL_FALLBACK_LABELS: Record<StepChannelFallbackReason, string> = {
  no_other_channel: "this channel has no other channel to switch to",
  do_not_contact: "the person is Do Not Contact",
  no_email_address: "the person has no email address",
  email_suppressed: "their email address is on the suppression list",
  email_do_not_contact: "their email address is marked Do Not Contact",
  no_mailbox_emailed_them: "no outreach mailbox has emailed them",
  mailbox_not_connected: "the mailbox that emailed them is no longer connected",
  no_linkedin_chat: "they have no LinkedIn chat with us",
  linkedin_account_not_connected: "the LinkedIn account that reached them is no longer connected",
  conversation_conflict: "the other channel's thread belongs to another conversation",
};

/** One of the record's active conversations on the other channel. */
export type OtherConversationFact = {
  id: string;
  accountRef: string;
  providerThreadId: string | null;
  /** The mailbox / LinkedIn account behind accountRef is connected in this organization. */
  accountConnected: boolean;
};

export type StepChannelFacts = {
  runChannel: CrmChannel;
  /** Person-level Do Not Contact (every channel). */
  doNotContact: boolean;
  email: {
    /** people.email of the record's Person. */
    address: string | null;
    suppressed: boolean;
    /** The address is marked Do Not Contact (through any Person carrying it). */
    doNotContact: boolean;
    /** The record's active email conversations, newest first. */
    conversations: readonly OtherConversationFact[];
    /** The mailbox of the last outreach email sent to this Person, and its thread. */
    lastOutreach: { mailbox: string; connected: boolean; threadId: string | null } | null;
  };
  linkedin: {
    /** The record's active LinkedIn conversations, newest first. */
    conversations: readonly OtherConversationFact[];
    /** The chat of this Person's own LinkedIn outreach (their Lead's Connection), newest first. */
    chat: { accountRef: string; chatId: string; providerId: string; accountConnected: boolean } | null;
  };
};

export type StepChannelDecision =
  /** The run's own conversation. `reason` is null when the step asked for it. */
  | { use: "same"; reason: StepChannelFallbackReason | null }
  | { use: "existing"; channel: OtherChannel; conversationId: string }
  | {
      use: "create";
      channel: OtherChannel;
      accountRef: string;
      providerThreadId: string | null;
      providerContactId: string;
    };

const same = (reason: StepChannelFallbackReason | null): StepChannelDecision => ({ use: "same", reason });

export function decideStepChannel(step: CrmSequenceStepChannel, facts: StepChannelFacts): StepChannelDecision {
  if (step !== "other") return same(null);
  const target = otherChannelOf(facts.runChannel);
  if (!target) return same("no_other_channel");
  if (facts.doNotContact) return same("do_not_contact");
  return target === "email" ? decideEmail(facts.email) : decideLinkedin(facts.linkedin);
}

function decideEmail(email: StepChannelFacts["email"]): StepChannelDecision {
  const address = email.address?.trim().toLowerCase() || null;
  if (!address) return same("no_email_address");
  if (email.suppressed) return same("email_suppressed");
  if (email.doNotContact) return same("email_do_not_contact");
  const existing = email.conversations.find((conversation) => conversation.accountConnected);
  if (existing) return { use: "existing", channel: "email", conversationId: existing.id };
  if (!email.lastOutreach) {
    return same(email.conversations.length ? "mailbox_not_connected" : "no_mailbox_emailed_them");
  }
  if (!email.lastOutreach.connected) return same("mailbox_not_connected");
  return {
    use: "create",
    channel: "email",
    accountRef: email.lastOutreach.mailbox,
    providerThreadId: email.lastOutreach.threadId?.trim() || null,
    providerContactId: address,
  };
}

function decideLinkedin(linkedin: StepChannelFacts["linkedin"]): StepChannelDecision {
  // Sending on LinkedIn needs the chat (send.ts); a conversation without one cannot carry the step.
  const withChat = linkedin.conversations.filter((conversation) => conversation.providerThreadId);
  const existing = withChat.find((conversation) => conversation.accountConnected);
  if (existing) return { use: "existing", channel: "linkedin", conversationId: existing.id };
  if (!linkedin.chat) return same(withChat.length ? "linkedin_account_not_connected" : "no_linkedin_chat");
  if (!linkedin.chat.accountConnected) return same("linkedin_account_not_connected");
  return {
    use: "create",
    channel: "linkedin",
    accountRef: linkedin.chat.accountRef,
    providerThreadId: linkedin.chat.chatId,
    providerContactId: linkedin.chat.providerId,
  };
}
