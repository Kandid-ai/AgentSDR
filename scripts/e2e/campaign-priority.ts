/**
 * End-to-end check of campaign priority (src/lib/campaigns/priority.ts) and
 * the referral campaigns, on every channel that has one:
 *
 *   - Email: the daily queue build plans Urgent → Low, the send tick drains it
 *     in that order, a rebuild never grants a second daily allowance, an
 *     Urgent/High campaign's new leads rebuild the queue the same day (only
 *     where the scheduler runs), and a lead that is no longer due is skipped.
 *   - WhatsApp: each tick a number sends its highest-priority due lead, and
 *     when first messages are refused it falls back to the highest-priority
 *     follow-up.
 *   - LinkedIn: invitations, profile lookups, follow-ups and missed
 *     acceptances are picked highest priority first.
 *   - Referrals: scripts/create-referral-campaigns.ts creates the two Urgent
 *     campaigns (idempotently); starting a referral enrolls the person, its
 *     email goes out first the same day with the referrer's name and brand,
 *     and an anonymous referral reads right without the name.
 *
 *   DATABASE_URL=postgres://postgres@127.0.0.1:55432/agentsdr_e2e DATABASE_SSL=disable \
 *     bun run --conditions=react-server scripts/e2e/campaign-priority.ts
 *
 * Runs the real library code against a disposable database with the live
 * schema (bun run db:setup). Gmail and Unipile are fakes: nothing is sent
 * anywhere. It creates its own organizations and refuses to run unless
 * DATABASE_URL points at localhost.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to run: DATABASE_URL must point at a local, disposable database.");
  process.exit(1);
}
// .env.development.local keeps every outbound switch paused for local work;
// the fakes are the only providers here, so lift them for this run.
for (const name of ["PAUSE_EMAIL_OUTBOUND", "PAUSE_LINKEDIN_OUTBOUND", "PAUSE_WHATSAPP_OUTBOUND", "PAUSE_CRM_AUTOSEND", "PEOPLE_MIGRATION_MODE", "OUTREACH_SAME_DAY_REFRESH"]) {
  process.env[name] = "false";
}
const env = process.env as Record<string, string | undefined>;
const ORIGINAL_NODE_ENV = env.NODE_ENV;

const { db } = await import("@/lib/db");
const { organizations } = await import("@/lib/auth/schema");
const { people } = await import("@/lib/leads/schema");
const { upsertPerson, withLeadTransaction } = await import("@/lib/leads/records");
const { personVariables } = await import("@/lib/leads/variables");
const { gridProviders, gridProviderCredentials } = await import("@/lib/grid/schema");
const { encryptIntegrationCredentials } = await import("@/lib/integrations/credentials");
const { mailboxes, outreachCampaigns, outreachLeads, outreachMailboxQueue, outreachEmails } = await import("@/lib/outreach/schema");
const { buildMailboxQueues } = await import("@/lib/outreach/buildQueue");
const { runSchedulerTick } = await import("@/lib/outreach/scheduler");
const { importRowsForCampaign } = await import("@/lib/outreach/leadImport");
const { updateCampaignPriority } = await import("@/lib/outreach/campaigns");
const { requestSameDayQueueRefresh, flushSameDayQueueRefreshes } = await import("@/lib/outreach/queueRefresh");
const { fillTemplate } = await import("@/lib/outreach/render");
const { whatsappAccounts, whatsappCampaigns, whatsappCampaignAccounts, whatsappCampaignLeads, whatsappCampaignSends, whatsappChats, whatsappMessages } = await import("@/lib/whatsapp/schema");
const { runWhatsappCampaignTick } = await import("@/lib/whatsapp/campaigns/engine");
const { WhatsappSendRefusedError } = await import("@/lib/whatsapp/errors");
const { linkedInAccounts, campaigns: linkedinCampaigns, campaignAccounts, leads: linkedinLeads, connections } = await import("@/lib/linkedin/schema");
const { selectInvitationCandidates } = await import("@/functions/sendInvitations");
const { selectResolveCandidates } = await import("@/functions/resolveProfiles");
const { selectFollowUpCandidates, selectMissedAcceptanceCandidates, FOLLOW_UP_STAGES } = await import("@/functions/sendFollowUps");
const { runInOrganization, currentOrganizationId } = await import("@/lib/tenancy/scope");
const { ensureCrmDefaults } = await import("@/lib/crm/defaults");
const { ingestInboundReply } = await import("@/lib/crm/conversations");
const { crmRecords } = await import("@/lib/crm/schema");
const { createManualReferral, startReferral, listReferralTargets } = await import("@/lib/crm/referrals");
type SendEmail = typeof import("@/lib/outreach/gmail").sendEmail;
type SendWhatsapp = typeof import("@/lib/whatsapp/send").sendWhatsapp;

const token = crypto.randomUUID().slice(0, 8);
const DAY = 86_400_000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs);
const ALWAYS = {
  timezone: "UTC",
  days: Object.fromEntries(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => [day, { enabled: true, from: "00:00", to: "23:59" }])),
};

let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

async function newOrganization(label: string, platforms: Array<"google" | "unipile">) {
  const [org] = await db.insert(organizations).values({ name: `Priority e2e ${label} ${token}`, slug: `priority-e2e-${label}-${token}` }).returning();
  assert(org);
  for (const key of platforms) {
    const credentials: Record<string, string> = key === "google" ? { serviceAccountJson: "{}", adminEmail: "admin@e2e.test" } : { apiKey: "fixture", dsn: "https://fixture.e2e.test" };
    const [provider] = await db.insert(gridProviders).values({ organizationId: org.id, key: `platform-${key}`, name: key, enabled: true }).returning();
    await db.insert(gridProviderCredentials).values({ providerId: provider!.id, encryptedPayload: encryptIntegrationCredentials(credentials) });
  }
  return org.id;
}

/** A Person labelled by name, so assertions read as the scenario does. */
async function person(label: string, extra: Partial<typeof people.$inferInsert> = {}) {
  const suffix = crypto.randomUUID().slice(0, 6);
  const [row] = await db.insert(people).values({
    organizationId: currentOrganizationId(),
    email: `${label}-${suffix}@lead.test`,
    firstName: label,
    fullName: label,
    source: "campaign-priority-e2e",
    ...extra,
  }).returning();
  assert(row);
  return row;
}

/** A row as the sheet import and the public API hand it to importRowsForCampaign. */
const parsedRow = (email: string, firstName: string) => ({
  email, firstName, lastName: null, linkedinUrl: null, title: null, company: null, domain: null, companyLinkedinUrl: null, customFields: {},
});

// ── Email ────────────────────────────────────────────────────────────────
const SEQUENCE = [
  { stepNumber: 1, subject: "Hello {{firstName}}", body: "First email for {{firstName}}", waitDays: 0 },
  { stepNumber: 2, subject: "", body: "Follow-up for {{firstName}}", waitDays: 2 },
];

async function emailScenario() {
  const sent: Array<{ from: string; to: string; subject: string; text: string }> = [];
  const fakeSend: SendEmail = async (input) => {
    sent.push({ from: input.from, to: input.to[0]!, subject: input.subject, text: input.text });
    return { id: `gmail-${crypto.randomUUID()}`, messageId: `<${crypto.randomUUID()}@e2e.test>`, threadId: `thread-${crypto.randomUUID()}` } as Awaited<ReturnType<SendEmail>>;
  };
  const orgId = currentOrganizationId();
  const [mailboxA] = await db.insert(mailboxes).values({ organizationId: orgId, emailAddress: `a-${token}@send.test`, status: "connected", dailySendLimit: 3, workingHours: ALWAYS as never }).returning();
  const [mailboxB] = await db.insert(mailboxes).values({ organizationId: orgId, emailAddress: `b-${token}@send.test`, status: "connected", dailySendLimit: 3, workingHours: ALWAYS as never }).returning();
  assert(mailboxA && mailboxB);

  const campaign = async (name: string, priority: string, status = "active", mailboxIds: string[] | null = null) => {
    const [row] = await db.insert(outreachCampaigns).values({ organizationId: orgId, name, status: status as never, priority: priority as never, sequence: SEQUENCE, mailboxIds }).returning();
    return row!;
  };
  // Created oldest to newest: without priority, the low campaign's leads would go first.
  const low = await campaign("Low", "low");
  const medium = await campaign("Medium", "medium");
  const urgent = await campaign("Urgent", "urgent");
  const highOnB = await campaign("High on B", "high", "active", [mailboxB.id]);
  const draftUrgent = await campaign("Draft urgent", "urgent", "draft");

  const labelOf = new Map<string, string>();
  let clock = 0;
  const lead = async (label: string, campaignId: string, extra: Partial<typeof outreachLeads.$inferInsert> = {}) => {
    const p = await person(label);
    const [row] = await db.insert(outreachLeads).values({ personId: p.id, campaignId, sequenceStatus: "pending", createdAt: at(-30 * DAY + clock++ * 60_000), ...extra }).returning();
    labelOf.set(row!.id, label);
    return row!;
  };
  await lead("low-fu-0", low.id, { sequenceStatus: "initial_sent", currentStep: 1, mailboxId: mailboxA.id, nextSendAt: at(-3 * DAY) });
  await lead("low-fu-1", low.id, { sequenceStatus: "initial_sent", currentStep: 1, mailboxId: mailboxA.id, nextSendAt: at(-2 * DAY) });
  await lead("low-0", low.id);
  await lead("low-1", low.id);
  for (let i = 0; i < 4; i++) await lead(`med-${i}`, medium.id);
  for (let i = 0; i < 3; i++) await lead(`urg-${i}`, urgent.id);
  for (let i = 0; i < 2; i++) await lead(`high-${i}`, highOnB.id);
  for (let i = 0; i < 2; i++) await lead(`draft-${i}`, draftUrgent.id);

  const queueOf = async (mailboxId: string) => {
    const rows = await db.select({ leadId: outreachMailboxQueue.leadId }).from(outreachMailboxQueue)
      .where(eq(outreachMailboxQueue.mailboxId, mailboxId)).orderBy(asc(outreachMailboxQueue.position));
    return rows.map((row) => labelOf.get(row.leadId) ?? row.leadId);
  };
  const tick = async () => {
    // The throttle is wall-clock; clear it so each tick may send once per mailbox.
    await db.update(mailboxes).set({ nextEmailTime: null }).where(eq(mailboxes.organizationId, orgId));
    return runSchedulerTick({ send: fakeSend, now: new Date() });
  };

  await check("email: the queue is planned Urgent → High → Medium → Low; a draft campaign and Low follow-ups get nothing when the day is full", async () => {
    const result = await buildMailboxQueues({ organizationIds: [orgId] });
    // Urgent round-robins over both mailboxes; High is limited to B and fills it;
    // Medium gets A's last slot; Low (follow-ups included) waits for another day.
    assert.deepEqual(await queueOf(mailboxA.id), ["urg-0", "urg-2", "med-0"]);
    assert.deepEqual(await queueOf(mailboxB.id), ["urg-1", "high-0", "high-1"]);
    assert.equal(result.newLeadsQueued, 6);
    assert.equal(result.followUpsQueued, 0);
  });

  await check("email: the send tick sends in queue order, one per mailbox per tick", async () => {
    for (let i = 0; i < 3; i++) await tick();
    const byMailbox = (address: string) => sent.filter((email) => email.from === address).map((email) => email.text.split("\n")[0]!.replace(/^First email for /, ""));
    assert.deepEqual(byMailbox(mailboxA.emailAddress), ["urg-0", "urg-2", "med-0"]);
    assert.deepEqual(byMailbox(mailboxB.emailAddress), ["urg-1", "high-0", "high-1"]);
    assert.equal(sent.find((email) => email.from === mailboxA.emailAddress)!.subject, "Hello urg-0");
    const extra = await tick();
    assert.equal(extra.sent, 0, "nothing more today: both mailboxes used their 3");
  });

  await check("email: rebuilding the same day does not grant a second daily allowance", async () => {
    const again = await buildMailboxQueues({ organizationIds: [orgId] });
    assert.equal(again.newLeadsQueued + again.followUpsQueued, 0);
    const counters = await db.select({ sent: mailboxes.todayEmailsSent }).from(mailboxes).where(eq(mailboxes.organizationId, orgId));
    assert.deepEqual(counters.map((row) => row.sent), [3, 3]);
  });

  await check("email: same-day rebuild is never requested where the scheduler does not run (the dev server shares production's database)", async () => {
    assert.equal(env.NODE_ENV === "production", false);
    assert.equal(await requestSameDayQueueRefresh([urgent.id]), false);
    assert.deepEqual(await flushSameDayQueueRefreshes(), []);
  });

  // From here on, behave like the production process: the scheduler runs.
  env.NODE_ENV = "production";
  try {
    await db.update(mailboxes).set({ dailySendLimit: 6 }).where(eq(mailboxes.organizationId, orgId));

    await check("email: leads added to a running Medium campaign wait for the morning (no rebuild)", async () => {
      const outcome = await importRowsForCampaign(medium.id, [parsedRow(`med-late-${token}@lead.test`, "med-late")], { source: "api", filename: null, mapping: {} });
      assert.ok(!("error" in outcome) && outcome.imported === 1);
      assert.deepEqual(await flushSameDayQueueRefreshes(), []);
    });

    await check("email: a paused Urgent campaign does not rebuild either", async () => {
      const paused = await campaign("Paused urgent", "urgent", "paused");
      assert.equal(await requestSameDayQueueRefresh([paused.id]), false);
      assert.deepEqual(await flushSameDayQueueRefreshes(), []);
    });

    await check("email: leads added to a running Urgent campaign rebuild today's queue, and go first on both mailboxes", async () => {
      const outcome = await importRowsForCampaign(urgent.id, [
        parsedRow(`urg-late-0-${token}@lead.test`, "urg-late-0"),
        parsedRow(`urg-late-1-${token}@lead.test`, "urg-late-1"),
      ], { source: "api", filename: null, mapping: {} });
      assert.ok(!("error" in outcome) && outcome.imported === 2);
      // Several changes in the debounce window make one rebuild.
      assert.equal(await requestSameDayQueueRefresh([urgent.id]), true);
      assert.deepEqual(await flushSameDayQueueRefreshes(), [orgId]);
      const late = await db.select({ id: outreachLeads.id, email: people.email }).from(outreachLeads).innerJoin(people, eq(people.id, outreachLeads.personId))
        .where(and(inArray(outreachLeads.campaignId, [urgent.id, medium.id]), sql`${people.email} like '%-late%'`));
      for (const row of late) labelOf.set(row.id, row.email!.replace(`-${token}@lead.test`, ""));
      const a = await queueOf(mailboxA.id);
      const b = await queueOf(mailboxB.id);
      assert.equal(a[0], "urg-late-0");
      assert.equal(b[0], "urg-late-1");
      // Each mailbox gets only what it has left today: 6 - 3 already sent.
      assert.equal(a.length, 3);
      assert.equal(b.length, 3);
      // Then Medium; B's High campaign has nothing left, so B fills with Medium too.
      assert.deepEqual(a.slice(1), ["med-1", "med-3"]);
      assert.deepEqual(b.slice(1), ["med-2", "med-late"]);
    });

    await check("email: starting an Urgent campaign, or raising a running one to High, rebuilds; lowering one does not", async () => {
      await updateCampaignPriority(medium.id, "high");
      assert.equal(await requestSameDayQueueRefresh([medium.id]), true);
      await flushSameDayQueueRefreshes();
      await updateCampaignPriority(medium.id, "medium");
      assert.equal(await requestSameDayQueueRefresh([medium.id]), false);
    });
  } finally {
    env.NODE_ENV = ORIGINAL_NODE_ENV;
  }

  await check("email: a queued lead whose next step is no longer due is skipped, not sent a step early", async () => {
    const [first] = await db.select({ leadId: outreachMailboxQueue.leadId }).from(outreachMailboxQueue)
      .where(eq(outreachMailboxQueue.mailboxId, mailboxA.id)).orderBy(asc(outreachMailboxQueue.position)).limit(1);
    assert(first);
    // As if its first email had gone out after the queue read it.
    await db.update(outreachLeads).set({ sequenceStatus: "initial_sent", currentStep: 1, mailboxId: mailboxA.id, nextSendAt: at(2 * DAY) }).where(eq(outreachLeads.id, first.leadId));
    const before = sent.length;
    await tick();
    const fromA = sent.slice(before).filter((email) => email.from === mailboxA.emailAddress);
    assert.equal(fromA.length, 0, "A skipped the not-due lead this tick");
    const emails = await db.select().from(outreachEmails).where(eq(outreachEmails.leadId, first.leadId));
    assert.equal(emails.length, 0, "no step was claimed for it");
    const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, first.leadId));
    assert.equal(lead!.currentStep, 1);
  });

  await check("email: the draft campaign's leads were never queued or sent", async () => {
    const draftLeads = await db.select({ id: outreachLeads.id, status: outreachLeads.sequenceStatus }).from(outreachLeads).where(eq(outreachLeads.campaignId, draftUrgent.id));
    assert.ok(draftLeads.every((row) => row.status === "pending"));
    assert.ok(!sent.some((email) => email.text.includes("draft-")));
  });

  // Leave no queue behind for the referral scenario's ticks.
  await db.delete(outreachMailboxQueue).where(inArray(outreachMailboxQueue.mailboxId, [mailboxA.id, mailboxB.id]));
}

// ── WhatsApp ─────────────────────────────────────────────────────────────
async function whatsappScenario() {
  const orgId = currentOrganizationId();
  const [account] = await db.insert(whatsappAccounts).values({ organizationId: orgId, unipileAccountId: `wa-${token}`, status: "connected", connectedAt: at(-30 * DAY) }).returning();
  assert(account);
  const STEPS = [{ id: "s0", body: "first for {{firstName}}", delayHours: 0 }, { id: "s1", body: "follow-up for {{firstName}}", delayHours: 24 }];
  const campaign = async (name: string, priority: string) => {
    const [row] = await db.insert(whatsappCampaigns).values({ organizationId: orgId, name, status: "active", priority: priority as never, steps: STEPS }).returning();
    await db.insert(whatsappCampaignAccounts).values({ campaignId: row!.id, accountId: account.id });
    return row!;
  };
  let clock = 0;
  const lead = async (label: string, campaignId: string, followUp: boolean) => {
    const p = await person(label, { phone: `+9198${String(10_000_000 + Math.floor(Math.random() * 89_999_999))}` });
    await db.insert(whatsappCampaignLeads).values({
      campaignId,
      personId: p.id,
      phone: p.phone!,
      status: followUp ? "in_sequence" : "queued",
      currentStep: followUp ? 1 : 0,
      accountId: followUp ? account.id : null,
      nextSendAt: at(-DAY + clock * 60_000),
      createdAt: at(-10 * DAY + clock++ * 60_000),
    });
  };

  const sent: string[] = [];
  let refuseFirstMessages = false;
  const fakeSend: SendWhatsapp = async (request) => {
    const text = request.text ?? "";
    if (refuseFirstMessages && text.startsWith("first")) {
      throw new WhatsappSendRefusedError("25 new chats a day", 429, null, "new_chat_limit");
    }
    const [chat] = await db.insert(whatsappChats).values({ accountId: request.accountId!, unipileChatId: `chat-${crypto.randomUUID()}`, phone: null }).returning();
    const [message] = await db.insert(whatsappMessages).values({ chatId: chat!.id, direction: "outbound", origin: "agentsdr", body: text, sentAt: new Date() }).returning();
    sent.push(text);
    return { message: { id: message!.id } } as unknown as Awaited<ReturnType<SendWhatsapp>>;
  };
  const tick = () => runWhatsappCampaignTick({ now: new Date(), send: fakeSend });

  const low = await campaign("WA low", "low");
  const medium = await campaign("WA medium", "medium");
  const urgent = await campaign("WA urgent", "urgent");
  await lead("wa-low-fu", low.id, true);
  await lead("wa-low-new", low.id, false);
  await lead("wa-med-fu", medium.id, true);
  await lead("wa-urg-0", urgent.id, false);
  await lead("wa-urg-1", urgent.id, false);

  await check("whatsapp: one message per number per tick, Urgent first messages before Medium and Low follow-ups", async () => {
    for (let i = 0; i < 6; i++) await tick();
    assert.deepEqual(sent, [
      "first for wa-urg-0",
      "first for wa-urg-1",
      "follow-up for wa-med-fu",
      "follow-up for wa-low-fu",
      "first for wa-low-new",
    ]);
  });

  await check("whatsapp: when first messages are refused (new-chat limit), the highest-priority follow-up goes instead", async () => {
    await db.update(whatsappCampaigns).set({ status: "paused" }).where(inArray(whatsappCampaigns.id, [low.id, medium.id, urgent.id]));
    const urgent2 = await campaign("WA urgent 2", "urgent");
    const medium2 = await campaign("WA medium 2", "medium");
    const low2 = await campaign("WA low 2", "low");
    await lead("wa2-low-fu", low2.id, true);
    await lead("wa2-med-fu", medium2.id, true);
    await lead("wa2-urg-new", urgent2.id, false);
    refuseFirstMessages = true;
    const before = sent.length;
    await tick();
    assert.deepEqual(sent.slice(before), ["follow-up for wa2-med-fu"]);
    const [urgentLead] = await db.select().from(whatsappCampaignLeads).where(eq(whatsappCampaignLeads.campaignId, urgent2.id));
    assert.equal(urgentLead!.status, "queued", "the refused first message stays queued");
    const claims = await db.select().from(whatsappCampaignSends).where(eq(whatsappCampaignSends.leadId, urgentLead!.id));
    assert.equal(claims.length, 0, "its claim was released, so it sends once the limit lifts");
    refuseFirstMessages = false;
    await tick();
    assert.equal(sent.at(-1), "first for wa2-urg-new");
  });

  await check("whatsapp: changing priority changes the order on the next tick", async () => {
    await db.update(whatsappCampaigns).set({ status: "paused" }).where(eq(whatsappCampaigns.organizationId, orgId));
    const a = await campaign("WA a", "medium");
    const b = await campaign("WA b", "medium");
    await lead("wa3-a", a.id, false); // older
    await lead("wa3-b", b.id, false);
    await db.update(whatsappCampaigns).set({ priority: "high" }).where(eq(whatsappCampaigns.id, b.id));
    const before = sent.length;
    await tick();
    assert.deepEqual(sent.slice(before), ["first for wa3-b"]);
  });
}

// ── LinkedIn ─────────────────────────────────────────────────────────────
async function linkedinScenario() {
  const orgId = currentOrganizationId();
  const [account] = await db.insert(linkedInAccounts).values({ organizationId: orgId, linkedinId: `li-${token}`, username: `rep-${token}`, status: "CONNECTED" }).returning();
  const [other] = await db.insert(linkedInAccounts).values({ organizationId: orgId, linkedinId: `li-other-${token}`, username: `other-${token}`, status: "CONNECTED" }).returning();
  assert(account && other);
  let campaignClock = 0;
  const campaign = async (name: string, priority: string, status: "ACTIVE" | "PAUSED" = "ACTIVE") => {
    const [row] = await db.insert(linkedinCampaigns).values({
      organizationId: orgId, name, status, priority: priority as never, followUp1Message: "fu1 {{firstName}}", acceptanceMessage: "thanks", createdAt: at(-20 * DAY + campaignClock++ * DAY),
    }).returning();
    return row!;
  };
  const low = await campaign("LI low (oldest)", "low");
  const medium = await campaign("LI medium", "medium");
  const urgent = await campaign("LI urgent (newest)", "urgent");
  const pausedUrgent = await campaign("LI paused urgent", "urgent", "PAUSED");
  const otherAccounts = await campaign("LI urgent, other sender only", "urgent");
  await db.insert(campaignAccounts).values({ campaignId: otherAccounts.id, linkedinAccountId: other.id });

  const labelOf = new Map<string, string>();
  let clock = 0;
  const lead = async (label: string, campaignId: string | null, extra: Partial<typeof linkedinLeads.$inferInsert> = {}) => {
    const p = await person(label, { linkedinUrl: `https://www.linkedin.com/in/${label}-${token}` });
    const [row] = await db.insert(linkedinLeads).values({
      organizationId: orgId, personId: p.id, campaignId, linkedinUrl: p.linkedinUrl, status: "PENDING", createdAt: at(-15 * DAY + clock++ * 60_000), ...extra,
    }).returning();
    labelOf.set(row!.id, label);
    return row!;
  };
  const labels = (rows: Array<{ id: string }>) => rows.map((row) => labelOf.get(row.id) ?? row.id);

  // Invitations need a resolved profile (providerId).
  await lead("inv-low", low.id, { providerId: "p-low" });
  await lead("inv-none", null, { providerId: "p-none" });
  await lead("inv-med", medium.id, { providerId: "p-med" });
  await lead("inv-urg-0", urgent.id, { providerId: "p-urg-0" });
  await lead("inv-urg-1", urgent.id, { providerId: "p-urg-1" });
  await lead("inv-paused", pausedUrgent.id, { providerId: "p-paused" });
  await lead("inv-other", otherAccounts.id, { providerId: "p-other" });
  // Profile lookups: not yet resolved.
  await lead("res-low", low.id, { sourceLinkedinIdentifier: "res-low" });
  await lead("res-urg", urgent.id, { sourceLinkedinIdentifier: "res-urg" });
  // Follow-up 1: accepted, the acceptance message went out; Low has waited longer.
  const fuLow = await lead("fu-low", low.id, { status: "ACCEPT_MESSAGE_SENT", linkedinAccountId: account.id, acceptMessageSentAt: at(-5 * DAY) });
  const fuUrg = await lead("fu-urg", urgent.id, { status: "ACCEPT_MESSAGE_SENT", linkedinAccountId: account.id, acceptMessageSentAt: at(-2 * DAY) });
  // Missed acceptances: a connection row, still REQUEST_SENT.
  const maLow = await lead("ma-low", low.id, { status: "REQUEST_SENT", linkedinAccountId: account.id, requestSentAt: at(-4 * DAY) });
  const maUrg = await lead("ma-urg", urgent.id, { status: "REQUEST_SENT", linkedinAccountId: account.id, requestSentAt: at(-3 * DAY) });
  let connectionClock = 0;
  for (const row of [fuLow, fuUrg, maLow, maUrg]) {
    await db.insert(connections).values({
      organizationId: orgId, providerId: `conn-${row.id}`, leadId: row.id, linkedinAccountId: account.id,
      chatId: row.status === "ACCEPT_MESSAGE_SENT" ? `chat-${row.id}` : null, createdAt: at(-6 * DAY + connectionClock++ * 60_000), updatedAt: new Date(),
    });
  }

  await check("linkedin: invitations go Urgent → Medium → Low, older campaigns no longer first; no-campaign leads last; paused and other-sender campaigns excluded", async () => {
    assert.deepEqual(labels(await selectInvitationCandidates(account.id, 20)), ["inv-urg-0", "inv-urg-1", "inv-med", "inv-low", "inv-none"]);
  });
  await check("linkedin: a small run takes only the top of that order", async () => {
    assert.deepEqual(labels(await selectInvitationCandidates(account.id, 2)), ["inv-urg-0", "inv-urg-1"]);
  });
  await check("linkedin: profile lookups follow the same order, so Urgent leads are ready first", async () => {
    assert.deepEqual(labels(await selectResolveCandidates(account.id, 10)), ["res-urg", "res-low"]);
  });
  await check("linkedin: follow-ups go by priority before waiting time", async () => {
    assert.deepEqual(labels(await selectFollowUpCandidates(account.id, FOLLOW_UP_STAGES[0]!, 10)), ["fu-urg", "fu-low"]);
  });
  await check("linkedin: missed acceptances go by priority before the oldest connection", async () => {
    assert.deepEqual(labels(await selectMissedAcceptanceCandidates(account.id, 10)), ["ma-urg", "ma-low"]);
  });
  await check("linkedin: the other sender sees its own campaign, still ordered by priority", async () => {
    const forOther = labels(await selectInvitationCandidates(other.id, 20));
    assert.deepEqual(forOther, ["inv-urg-0", "inv-urg-1", "inv-other", "inv-med", "inv-low", "inv-none"]);
  });
}

// ── Referral campaigns ───────────────────────────────────────────────────
async function referralScenario() {
  const orgId = currentOrganizationId();
  const [mailbox] = await db.insert(mailboxes).values({ organizationId: orgId, emailAddress: `ref-${token}@send.test`, displayName: "Rep", status: "connected", dailySendLimit: 5, workingHours: ALWAYS as never }).returning();
  assert(mailbox);
  await ensureCrmDefaults();

  const runScript = () => spawnSync("bun", ["run", "--conditions=react-server", "scripts/create-referral-campaigns.ts", "--org", orgId, "--apply"], { env: process.env, encoding: "utf8" });

  let referralEmailId = "";
  let referralLinkedinId = "";
  await check("referral campaigns: the script creates one email and one LinkedIn campaign, Urgent, not running yet", async () => {
    const first = runScript();
    assert.equal(first.status, 0, first.stderr);
    const second = runScript();
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /Email "Referral" exists \(draft, urgent\)/);
    assert.match(second.stdout, /LinkedIn "Referral" exists \(PAUSED, urgent\)/);
    const emails = await db.select().from(outreachCampaigns).where(and(eq(outreachCampaigns.organizationId, orgId), eq(outreachCampaigns.name, "Referral")));
    const linkedins = await db.select().from(linkedinCampaigns).where(and(eq(linkedinCampaigns.organizationId, orgId), eq(linkedinCampaigns.name, "Referral")));
    assert.equal(emails.length, 1);
    assert.equal(linkedins.length, 1);
    assert.equal(emails[0]!.priority, "urgent");
    assert.equal(emails[0]!.status, "draft");
    assert.equal(emails[0]!.sequence.length, 3);
    assert.equal(linkedins[0]!.priority, "urgent");
    assert.equal(linkedins[0]!.status, "PAUSED");
    referralEmailId = emails[0]!.id;
    referralLinkedinId = linkedins[0]!.id;
  });

  await check("referral campaigns: a re-run raises a lowered priority back to Urgent and keeps the copy", async () => {
    await db.update(outreachCampaigns).set({ priority: "low", sequence: [{ stepNumber: 1, subject: "Edited", body: "Edited body", waitDays: 0 }] }).where(eq(outreachCampaigns.id, referralEmailId));
    assert.equal(runScript().status, 0);
    const [row] = await db.select().from(outreachCampaigns).where(eq(outreachCampaigns.id, referralEmailId));
    assert.equal(row!.priority, "urgent");
    assert.equal(row!.sequence[0]!.subject, "Edited");
    // Put the script's copy back for the rest of the scenario.
    await db.delete(outreachCampaigns).where(eq(outreachCampaigns.id, referralEmailId));
    assert.equal(runScript().status, 0);
    const [fresh] = await db.select().from(outreachCampaigns).where(and(eq(outreachCampaigns.organizationId, orgId), eq(outreachCampaigns.name, "Referral")));
    referralEmailId = fresh!.id;
  });

  await check("referral campaigns: the referral card pre-selects them and shows they are not running", async () => {
    const targets = await listReferralTargets();
    const email = targets.email.find((target) => target.id === referralEmailId);
    const linkedin = targets.linkedin.find((target) => target.id === referralLinkedinId);
    assert.equal(email?.suggested, true);
    assert.equal(email?.status, "draft");
    assert.equal(linkedin?.suggested, true);
    assert.equal(linkedin?.status, "paused");
  });

  // Launch both (what the campaign pages' Launch buttons do) and add a busy Medium campaign.
  await db.update(outreachCampaigns).set({ status: "active" }).where(eq(outreachCampaigns.id, referralEmailId));
  await db.update(linkedinCampaigns).set({ status: "ACTIVE" }).where(eq(linkedinCampaigns.id, referralLinkedinId));
  const [cold] = await db.insert(outreachCampaigns).values({ organizationId: orgId, name: "Cold", status: "active", priority: "medium", sequence: SEQUENCE }).returning();
  for (let i = 0; i < 4; i++) {
    const p = await person(`cold-${i}`);
    await db.insert(outreachLeads).values({ personId: p.id, campaignId: cold!.id, sequenceStatus: "pending", createdAt: at(-10 * DAY + i * 60_000) });
  }
  const [coldLinkedin] = await db.insert(linkedinCampaigns).values({ organizationId: orgId, name: "Cold LI", status: "ACTIVE", priority: "medium", createdAt: at(-30 * DAY) }).returning();
  const coldLinkedinPerson = await person("cold-li", { linkedinUrl: `https://www.linkedin.com/in/cold-li-${token}` });
  await db.insert(linkedinLeads).values({ organizationId: orgId, personId: coldLinkedinPerson.id, campaignId: coldLinkedin!.id, linkedinUrl: coldLinkedinPerson.linkedinUrl, status: "PENDING", sourceLinkedinIdentifier: "cold-li", createdAt: at(-30 * DAY) });
  const [linkedinAccount] = await db.insert(linkedInAccounts).values({ organizationId: orgId, linkedinId: `li-ref-${token}`, username: `ref-${token}`, status: "CONNECTED" }).returning();

  // The referrer: their brand is on their row (emailName), their company's legal name differs.
  const referrer = await withLeadTransaction((tx) => upsertPerson(tx, {
    email: `priya-${token}@rb.test`, firstName: "Priya", lastName: "Shah", fullName: "Priya Shah", linkedinUrl: null, title: "CMO",
    company: { domain: `rb-${token}.test`, name: "RB" }, raw: { emailName: "Durex" }, source: "campaign-priority-e2e",
  }));
  await ingestInboundReply({
    personId: referrer.id, channel: "email", accountRef: mailbox.emailAddress, providerThreadId: `thread-${token}`, providerContactId: null,
    idempotencyKey: `in-${token}`, providerMessageId: `pm-${token}`, subject: "Re: ads", bodyText: "Please talk to Rahul, he runs growth.", sentAt: new Date(),
  });
  const [record] = await db.select().from(crmRecords).where(eq(crmRecords.personId, referrer.id));
  assert(record);

  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const fakeSend: SendEmail = async (input) => {
    sent.push({ to: input.to[0]!, subject: input.subject, text: input.text });
    return { id: `gmail-${crypto.randomUUID()}`, messageId: `<${crypto.randomUUID()}@e2e.test>`, threadId: `thread-${crypto.randomUUID()}` } as Awaited<ReturnType<SendEmail>>;
  };

  env.NODE_ENV = "production";
  let rahulId = "";
  try {
    await check("referral: starting outreach enrolls the person in both Referral campaigns and rebuilds today's email queue", async () => {
      const referral = await createManualReferral(record.id, { name: "Rahul Mehta", email: `rahul-${token}@rb.test`, linkedinUrl: `https://www.linkedin.com/in/rahul-mehta-${token}`, role: "Head of Growth" }, "e2e");
      const started = await startReferral(referral.id, { channels: { email: referralEmailId, linkedin: referralLinkedinId } }, "e2e");
      assert.equal(started.results.email?.outcome, "enrolled", started.results.email?.message ?? "");
      assert.equal(started.results.linkedin?.outcome, "enrolled", started.results.linkedin?.message ?? "");
      rahulId = started.person.id;
      const anonymous = await createManualReferral(record.id, { name: "Anita Rao", email: `anita-${token}@rb.test`, anonymous: true }, "e2e");
      const startedAnonymous = await startReferral(anonymous.id, { channels: { email: referralEmailId } }, "e2e");
      assert.equal(startedAnonymous.results.email?.outcome, "enrolled");
      assert.deepEqual(await flushSameDayQueueRefreshes(), [orgId]);
    });
  } finally {
    env.NODE_ENV = ORIGINAL_NODE_ENV;
  }

  await check("referral: both referral emails are at the front of the queue, ahead of the older Cold leads", async () => {
    const rows = await db.select({ email: people.email }).from(outreachMailboxQueue)
      .innerJoin(outreachLeads, eq(outreachLeads.id, outreachMailboxQueue.leadId)).innerJoin(people, eq(people.id, outreachLeads.personId))
      .where(eq(outreachMailboxQueue.mailboxId, mailbox.id)).orderBy(asc(outreachMailboxQueue.position));
    const order = rows.map((row) => row.email!.split("-")[0]);
    assert.deepEqual(order, ["rahul", "anita", "cold", "cold", "cold"]);
  });

  await check("referral: the first email names the referrer and the brand; the anonymous one reads right without the name", async () => {
    for (let i = 0; i < 2; i++) {
      await db.update(mailboxes).set({ nextEmailTime: null }).where(eq(mailboxes.id, mailbox.id));
      await runSchedulerTick({ send: fakeSend, now: new Date() });
    }
    const rahul = sent.find((email) => email.to.startsWith("rahul"));
    const anita = sent.find((email) => email.to.startsWith("anita"));
    assert(rahul && anita, `both sent; got ${sent.map((email) => email.to).join(", ")}`);
    assert.equal(rahul.subject, "Priya suggested I reach out");
    assert.match(rahul.text, /^Hi Rahul,\n\nPriya mentioned you're the right person to talk to about the ads and product pages at Durex\./);
    assert.equal(anita.subject, "Your colleague suggested I reach out");
    assert.match(anita.text, /^Hi Anita,\n\nA colleague of yours mentioned you're the right person to talk to about the ads and product pages at Durex\./);
    assert.ok(!anita.text.includes("Priya"), "the anonymous referral never names the referrer");
    assert.ok(!/\{\{|\}\}/.test(rahul.text + anita.text + rahul.subject + anita.subject), "no merge token left unfilled");
  });

  await check("referral: on LinkedIn the referred person is looked up first and their note renders within 300 characters", async () => {
    const candidates = await selectResolveCandidates(linkedinAccount!.id, 10);
    assert.equal(candidates[0]?.personId, rahulId, "the Urgent referral is resolved before the older Cold lead");
    const [campaign] = await db.select().from(linkedinCampaigns).where(eq(linkedinCampaigns.id, referralLinkedinId));
    const [rahul] = await db.select().from(people).where(eq(people.id, rahulId));
    const note = fillTemplate(campaign!.invitationMessage ?? "", personVariables(rahul!, { domain: "rb.test", name: "RB", linkedinUrl: null, raw: null }));
    assert.equal(note, "Hi Rahul, Priya suggested I connect with you about the ads and product pages at Durex. Would be great to connect.");
    assert.ok(note.length <= 300);
  });
}

// ── Run ──────────────────────────────────────────────────────────────────
// The email tick and the WhatsApp tick visit every organization; give each
// scenario its own so their counts never mix.
console.log("Email");
await runInOrganization(await newOrganization("email", ["google"]), emailScenario);
console.log("WhatsApp");
await runInOrganization(await newOrganization("whatsapp", ["unipile"]), whatsappScenario);
console.log("LinkedIn");
await runInOrganization(await newOrganization("linkedin", ["unipile"]), linkedinScenario);
console.log("Referrals");
await runInOrganization(await newOrganization("referral", ["google"]), referralScenario);
console.log(`\n${passed} checks passed. Fake Gmail and Unipile only: nothing left this machine.`);
process.exit(0);
