/**
 * The database half of stepChannel.ts: gathers what decideStepChannel needs
 * about a record's Person, and turns its decision into the conversation a
 * step's draft goes on — creating the other channel's conversation when the
 * record has none yet. Runs inside the drafting transaction.
 *
 * Every identity comes from the record's own Person: their people.email, the
 * outreach emails sent to that Person, and the LinkedIn Connection of that
 * Person's own Lead. Every query is scoped to the current organization.
 */
import { and, desc, eq, inArray, isNotNull, ne, or, isNull, sql } from "drizzle-orm";
import { people } from "@/lib/leads/schema";
import {
  campaigns as linkedinCampaigns,
  connections as linkedinConnections,
  leads as linkedinLeads,
  linkedInAccounts,
} from "@/lib/linkedin/schema";
import { mailboxes, outreachCampaigns, outreachEmails, outreachLeads, suppressionList } from "@/lib/outreach/schema";
import { inOrg } from "@/lib/tenancy/scope";
import { upsertConversationInTransaction, type CrmConversation } from "./conversations";
import { backfillOutreachHistoryInTransaction } from "./outreachHistory";
import { isEmailDoNotContact, isPersonDoNotContact } from "./policies";
import type { CrmRecord } from "./records";
import { CrmConflictError, type CrmTransaction } from "./repository";
import { crmConversations, type CrmSequenceStepChannel } from "./schema";
import {
  decideStepChannel,
  otherChannelOf,
  type OtherConversationFact,
  type StepChannelDecision,
  type StepChannelFacts,
  type StepChannelFallbackReason,
} from "./stepChannel";

type RecordRef = Pick<CrmRecord, "id" | "personId">;

async function recordConversations(tx: CrmTransaction, record: RecordRef, channel: "email" | "linkedin") {
  return tx.select().from(crmConversations)
    .where(and(
      inOrg(crmConversations),
      eq(crmConversations.crmRecordId, record.id),
      eq(crmConversations.personId, record.personId),
      eq(crmConversations.channel, channel),
      eq(crmConversations.status, "active"),
    ))
    .orderBy(desc(crmConversations.updatedAt));
}

async function connectedMailboxes(tx: CrmTransaction, addresses: string[]): Promise<Set<string>> {
  if (!addresses.length) return new Set();
  const rows = await tx.select({ address: mailboxes.emailAddress }).from(mailboxes)
    .where(and(inOrg(mailboxes), inArray(mailboxes.emailAddress, addresses), eq(mailboxes.status, "connected")));
  return new Set(rows.map((row) => row.address));
}

async function connectedLinkedinAccounts(tx: CrmTransaction, linkedinIds: string[]): Promise<Set<string>> {
  if (!linkedinIds.length) return new Set();
  const rows = await tx.select({ linkedinId: linkedInAccounts.linkedinId }).from(linkedInAccounts)
    .where(and(inOrg(linkedInAccounts), inArray(linkedInAccounts.linkedinId, linkedinIds), eq(linkedInAccounts.status, "CONNECTED")));
  return new Set(rows.map((row) => row.linkedinId));
}

async function emailFacts(tx: CrmTransaction, record: RecordRef): Promise<StepChannelFacts["email"]> {
  const [person] = await tx.select({ email: people.email }).from(people)
    .where(and(inOrg(people), eq(people.id, record.personId))).limit(1);
  const address = person?.email?.trim().toLowerCase() || null;
  const conversations = await recordConversations(tx, record, "email");
  // The last outreach email this Person was actually sent, and the mailbox it went from.
  const [last] = await tx.select({
    mailbox: mailboxes.emailAddress,
    status: mailboxes.status,
    threadId: outreachEmails.threadId,
  })
    .from(outreachEmails)
    .innerJoin(outreachLeads, eq(outreachLeads.id, outreachEmails.leadId))
    .innerJoin(mailboxes, eq(mailboxes.id, outreachEmails.mailboxId))
    .where(and(
      inArray(outreachLeads.campaignId, tx.select({ id: outreachCampaigns.id }).from(outreachCampaigns).where(inOrg(outreachCampaigns))),
      inOrg(mailboxes),
      eq(outreachLeads.personId, record.personId),
      eq(outreachEmails.status, "sent"),
    ))
    .orderBy(sql`${outreachEmails.sentAt} DESC NULLS LAST`)
    .limit(1);
  const connected = await connectedMailboxes(tx, conversations.map((conversation) => conversation.accountRef));
  const [suppressed] = address
    ? await tx.select({ email: suppressionList.email }).from(suppressionList)
      .where(and(inOrg(suppressionList), eq(suppressionList.email, address))).limit(1)
    : [];
  return {
    address,
    suppressed: Boolean(suppressed),
    doNotContact: address ? await isEmailDoNotContact(tx, address) : false,
    conversations: conversations.map((conversation): OtherConversationFact => ({
      id: conversation.id,
      accountRef: conversation.accountRef,
      providerThreadId: conversation.providerThreadId,
      accountConnected: connected.has(conversation.accountRef),
    })),
    lastOutreach: last ? { mailbox: last.mailbox, connected: last.status === "connected", threadId: last.threadId } : null,
  };
}

async function linkedinFacts(tx: CrmTransaction, record: RecordRef): Promise<StepChannelFacts["linkedin"]> {
  const conversations = await recordConversations(tx, record, "linkedin");
  // The chat of this Person's own LinkedIn outreach. Personal campaigns are
  // private outreach and never reach the CRM, so they are not a channel here.
  const [chat] = await tx.select({
    chatId: linkedinConnections.chatId,
    providerId: linkedinConnections.providerId,
    accountRef: linkedInAccounts.linkedinId,
    accountStatus: linkedInAccounts.status,
  })
    .from(linkedinConnections)
    .innerJoin(linkedinLeads, eq(linkedinLeads.id, linkedinConnections.leadId))
    .innerJoin(linkedInAccounts, eq(linkedInAccounts.id, linkedinConnections.linkedinAccountId))
    .leftJoin(linkedinCampaigns, eq(linkedinCampaigns.id, linkedinLeads.campaignId))
    .where(and(
      inOrg(linkedinConnections),
      inOrg(linkedinLeads),
      inOrg(linkedInAccounts),
      eq(linkedinLeads.personId, record.personId),
      isNotNull(linkedinConnections.chatId),
      or(isNull(linkedinCampaigns.id), ne(linkedinCampaigns.type, "PERSONAL")),
    ))
    .orderBy(desc(linkedinConnections.updatedAt))
    .limit(1);
  const connected = await connectedLinkedinAccounts(tx, conversations.map((conversation) => conversation.accountRef));
  return {
    conversations: conversations.map((conversation): OtherConversationFact => ({
      id: conversation.id,
      accountRef: conversation.accountRef,
      providerThreadId: conversation.providerThreadId,
      accountConnected: connected.has(conversation.accountRef),
    })),
    chat: chat?.chatId
      ? { accountRef: chat.accountRef, chatId: chat.chatId, providerId: chat.providerId, accountConnected: chat.accountStatus === "CONNECTED" }
      : null,
  };
}

/** What decideStepChannel needs; only the other channel's facts are read. */
export async function loadStepChannelFacts(
  tx: CrmTransaction,
  record: RecordRef,
  runConversation: Pick<CrmConversation, "channel">,
): Promise<StepChannelFacts> {
  const target = otherChannelOf(runConversation.channel);
  const emptyEmail: StepChannelFacts["email"] = { address: null, suppressed: false, doNotContact: false, conversations: [], lastOutreach: null };
  const emptyLinkedin: StepChannelFacts["linkedin"] = { conversations: [], chat: null };
  return {
    runChannel: runConversation.channel,
    doNotContact: await isPersonDoNotContact(tx, record.personId),
    email: target === "email" ? await emailFacts(tx, record) : emptyEmail,
    linkedin: target === "linkedin" ? await linkedinFacts(tx, record) : emptyLinkedin,
  };
}

export type ResolvedStepConversation = {
  conversation: CrmConversation;
  /** Set when the step goes out on a different channel than the run's. */
  switched: { from: CrmConversation["channel"]; to: CrmConversation["channel"] } | null;
  /** Set when an 'other' step fell back to the run's own conversation. */
  fallbackReason: StepChannelFallbackReason | null;
  decision: StepChannelDecision;
};

/**
 * The conversation a step's new draft goes on. 'same' steps (and every
 * fallback) get the run's own conversation; an 'other' step gets the
 * person's existing conversation on the other channel, or a new one created
 * from the outreach that reached them there, with that outreach's history
 * copied in (so the draft and the email's thread headers see it).
 */
export async function resolveStepConversationInTransaction(
  tx: CrmTransaction,
  input: {
    record: RecordRef;
    runConversation: CrmConversation;
    stepChannel: CrmSequenceStepChannel;
  },
): Promise<ResolvedStepConversation> {
  const { record, runConversation, stepChannel } = input;
  const fallback = (decision: StepChannelDecision, reason: StepChannelFallbackReason | null): ResolvedStepConversation => ({
    conversation: runConversation,
    switched: null,
    fallbackReason: reason,
    decision,
  });
  if (stepChannel !== "other") return fallback({ use: "same", reason: null }, null);

  const decision = decideStepChannel(stepChannel, await loadStepChannelFacts(tx, record, runConversation));
  if (decision.use === "same") return fallback(decision, decision.reason);

  let conversation: CrmConversation | undefined;
  if (decision.use === "existing") {
    [conversation] = await tx.select().from(crmConversations)
      .where(and(
        inOrg(crmConversations),
        eq(crmConversations.id, decision.conversationId),
        eq(crmConversations.crmRecordId, record.id),
        eq(crmConversations.personId, record.personId),
      ))
      .limit(1);
  } else {
    try {
      ({ conversation } = await upsertConversationInTransaction(tx, {
        crmRecordId: record.id,
        personId: record.personId,
        channel: decision.channel,
        accountRef: decision.accountRef,
        providerThreadId: decision.providerThreadId,
        providerContactId: decision.providerContactId,
      }));
    } catch (error) {
      // The thread is another record's (or its identities disagree): never
      // borrow it, send on the run's own conversation instead.
      if (error instanceof CrmConflictError) return fallback(decision, "conversation_conflict");
      throw error;
    }
    await backfillOutreachHistoryInTransaction(tx, {
      conversationId: conversation.id,
      personId: record.personId,
      channel: decision.channel,
      accountRef: conversation.accountRef,
    });
  }
  if (!conversation || conversation.channel !== decision.channel) return fallback(decision, "conversation_conflict");
  return {
    conversation,
    switched: { from: runConversation.channel, to: conversation.channel },
    fallbackReason: null,
    decision,
  };
}
