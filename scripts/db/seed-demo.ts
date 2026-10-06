/**
 * Fills a FRESH database with a demo user and a demo organization, full of
 * realistic but entirely fictional data — so a contributor gets a usable app
 * and README screenshots never show real customers.
 *
 *   bun --conditions=react-server scripts/db/seed-demo.ts [--allow-remote]
 *
 * Run `bun run db:setup` first. Safe to re-run: if the demo organization
 * exists it says so and exits 0 without touching anything.
 *
 * Refuses to run when NODE_ENV=production, or when DATABASE_URL is not on
 * localhost / 127.0.0.1 (pass --allow-remote to override the latter).
 *
 * Data is written through the application's own lib functions inside
 * runInOrganization(), so it is valid by construction. Direct inserts are
 * used only where no lib function fits (a CRM record at a chosen stage needs
 * an AI classification otherwise; Tables rows need typed columns). No
 * integration credentials are ever created.
 */

const DEMO_EMAIL = "demo@example.com";
const DEMO_NAME = "Demo User";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo-password-123";
const ORG_NAME = "Northwind Demo";
const ORG_SLUG = "northwind-demo";

function guard(): void {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed demo data: NODE_ENV=production.");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set — copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    console.error("DATABASE_URL is not a valid URL.");
    process.exit(1);
  }
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  if (!local && !process.argv.includes("--allow-remote")) {
    console.error(
      `Refusing to seed demo data into "${host}": it is not localhost/127.0.0.1. ` +
        "Demo data is fictional and should never land in a real database. Pass --allow-remote if you are sure.",
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Fictional content
// ---------------------------------------------------------------------------

const COMPANIES = [
  { name: "Brightloop Analytics", domain: "brightloop.example", industry: "analytics" },
  { name: "Harborview Logistics", domain: "harborview.example", industry: "logistics" },
  { name: "Pinecrest Health", domain: "pinecrest-health.example", industry: "healthcare" },
  { name: "Quillstone Legal", domain: "quillstone.example", industry: "legal" },
  { name: "Redwood Robotics", domain: "redwoodrobotics.example", industry: "robotics" },
  { name: "Saltmarsh Foods", domain: "saltmarsh.example", industry: "food" },
  { name: "Tallgrass Energy", domain: "tallgrass-energy.example", industry: "energy" },
  { name: "Umbra Security", domain: "umbrasec.example", industry: "security" },
  { name: "Verdant Learning", domain: "verdantlearning.example", industry: "education" },
  { name: "Willowbrook Finance", domain: "willowbrook.example", industry: "fintech" },
  { name: "Yarrow Mobility", domain: "yarrowmobility.example", industry: "mobility" },
  { name: "Zephyr Cloudworks", domain: "zephyrcloud.example", industry: "cloud" },
] as const;

const FIRST = [
  "Ava", "Liam", "Noor", "Mateo", "Priya", "Jonas", "Elena", "Kofi", "Hana", "Oscar",
  "Maya", "Tariq", "Ingrid", "Diego", "Sana", "Felix", "Leila", "Ravi", "Greta", "Omar",
  "Chloe", "Anders", "Zara", "Hugo", "Mei", "Lucas", "Amara", "Ivan", "Nia", "Theo",
  "Esme", "Kenji", "Farah", "Bruno", "Alina", "Samir", "Tess", "Dmitri", "Rosa", "Yusuf",
];
const LAST = [
  "Alder", "Brennan", "Castillo", "Dunmore", "Okafor", "Lindqvist", "Marlowe", "Nakamura",
  "Oyelaran", "Pemberton", "Quade", "Rasmussen", "Sorensen", "Thackeray", "Underhill",
  "Valdez", "Whitlock", "Xiong", "Yilmaz", "Zielinski",
];
const TITLES = [
  "VP of Sales", "Head of Growth", "Director of Operations", "Chief Revenue Officer",
  "Marketing Manager", "Founder & CEO", "RevOps Lead", "Head of Partnerships",
  "Sales Development Manager", "Director of Customer Success",
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

type DemoPerson = {
  firstName: string;
  lastName: string;
  email: string;
  linkedinUrl: string;
  title: string;
  company: (typeof COMPANIES)[number];
};

const PEOPLE: DemoPerson[] = Array.from({ length: 40 }, (_, i) => {
  const firstName = FIRST[i];
  const lastName = LAST[(i * 7 + 3) % LAST.length];
  const company = COMPANIES[i % COMPANIES.length];
  return {
    firstName,
    lastName,
    email: `${slug(firstName)}.${slug(lastName)}@${company.domain}`,
    linkedinUrl: `https://www.linkedin.com/in/${slug(firstName)}-${slug(lastName)}-demo`,
    title: TITLES[i % TITLES.length],
    company,
  };
});

const REPLIES = [
  "Thanks for reaching out. This looks relevant to what we are planning for next quarter. Could you send over pricing and a short overview?",
  "Interesting timing. Can we do a 20 minute call early next week?",
  "We already use another tool for this and are happy with it, but thanks for thinking of us.",
  "Not a priority right now. Please check back in a few months.",
  "Can you share a case study from a team of our size? I would like to show it to my CEO.",
  "Sounds good. Send me a calendar link and I will pick a slot.",
  "How does this integrate with our CRM? We run everything through spreadsheets today.",
  "Please remove me from your list.",
  "Forwarding this to our head of operations, she owns this decision.",
  "We are evaluating three vendors at the moment. What makes you different?",
  "Yes, I would like a demo. Thursday afternoon works for me.",
  "Can you explain how you handle data privacy and who can see our leads?",
  "Happy to chat. We are mid-quarter, so something in two weeks would be best.",
  "Not interested, thank you.",
  "Great, let us move forward. Who do I speak to about the contract?",
];

const OUR_OPENERS = [
  "Hi {first}, I noticed {company} is growing its team. We help sales teams research leads and send personal outreach from one workspace. Worth a quick look?",
  "Hi {first}, quick note on how teams like {company} cut lead research time in half. Open to a short chat?",
];

const KNOWLEDGE = `# Northwind Demo, in brief

Northwind Demo is a fictional company used to show AgentSDR with sample data. Nothing here describes a real business.

## What we sell
Northwind Signal is a revenue-intelligence tool for small B2B sales teams. It pulls lead and company data together, scores accounts, and drafts personal outreach for a rep to review.

## Pricing
- Starter: 49 USD per seat per month, up to 1,000 leads.
- Team: 129 USD per seat per month, up to 25,000 leads, shared inbox.
- Scale: custom pricing, SSO and audit logs.

## Good-fit customers
B2B companies with 5 to 100 salespeople who prospect by email and LinkedIn and track deals in spreadsheets or a lightweight CRM.

## Common questions
- Data privacy: each customer's data is isolated to their own workspace.
- Implementation: most teams are running within a day; a CSV import is enough to start.
- Contracts: monthly by default, annual with a 15 percent discount.

## Scheduling
Demos are 25 minutes. Offer weekday slots between 10:00 and 16:00 in the prospect's timezone.
`;

// ---------------------------------------------------------------------------

async function main() {
  guard();

  const { db } = await import("@/lib/db");
  const { auth } = await import("@/lib/auth/server");
  const { organizations } = await import("@/lib/auth/schema");
  const { eq } = await import("drizzle-orm");

  const [existingOrg] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, ORG_SLUG)).limit(1);
  if (existingOrg) {
    console.log(`The demo organization "${ORG_NAME}" already exists (${existingOrg.id}); nothing to do.`);
    console.log(`Sign in as ${DEMO_EMAIL} (the password you set the first time).`);
    process.exit(0);
  }

  // 1. User + organization through Better Auth. Sign-up is invite-only by
  // default, which would refuse the demo user (and its organization) on any
  // database that already has an account. This process is a local seed, not
  // a visitor, so it opens sign-up for itself only; the policy is read per call.
  process.env.AUTH_SIGNUP = "open";
  const { users } = await import("@/lib/auth/schema");
  let [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (!owner) {
    await auth.api.signUpEmail({ body: { name: DEMO_NAME, email: DEMO_EMAIL, password: DEMO_PASSWORD } });
    [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  }
  if (!owner) throw new Error("Better Auth did not create the demo user");
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, owner.id));
  const org = await auth.api.createOrganization({
    body: { name: ORG_NAME, slug: ORG_SLUG, userId: owner.id, metadata: { demo: true } },
  });
  if (!org?.id) throw new Error("Better Auth did not create the demo organization");

  const { runInOrganization } = await import("@/lib/tenancy/scope");
  const summary = await runInOrganization(org.id, () => seedOrganization());

  console.log("");
  console.log(`Demo organization "${ORG_NAME}" (${org.id}) created with:`);
  for (const [label, n] of Object.entries(summary)) console.log(`  ${String(n).padStart(3)}  ${label}`);
  console.log("");
  console.log("Sign in:");
  console.log(`  email     ${DEMO_EMAIL}`);
  console.log(`  password  ${DEMO_PASSWORD}`);
  console.log("  Start the app (bun run dev) and open /sign-in.");
  process.exit(0);
}

async function seedOrganization(): Promise<Record<string, number>> {
  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { inOrg } = await import("@/lib/tenancy/scope");
  const { upsertPerson, withLeadTransaction } = await import("@/lib/leads/records");
  const { people, companies } = await import("@/lib/leads/schema");
  const { ensureCrmDefaults } = await import("@/lib/crm/defaults");
  const { crmSubcategories } = await import("@/lib/crm/schema");
  const { ingestInboundReply, upsertConversationInTransaction, insertConversationMessageInTransaction } =
    await import("@/lib/crm/conversations");
  const { applyHumanClassification } = await import("@/lib/crm/operations");
  const { withCrmTransaction } = await import("@/lib/crm/repository");
  const { createKnowledgeDocument } = await import("@/lib/crm/knowledge-service");
  const { createWorkbook } = await import("@/lib/grid/workbooks");
  const { createColumn, listColumns } = await import("@/lib/grid/columns");
  const { insertRows } = await import("@/lib/grid/rows");
  const { createCampaign, updateCampaignSequence } = await import("@/lib/outreach/campaigns");
  const { importLeadsForCampaign } = await import("@/lib/outreach/leadImport");
  const { campaigns: linkedinCampaigns } = await import("@/lib/linkedin/schema");
  const { currentOrganizationId } = await import("@/lib/tenancy/scope");

  // People and companies — upsertPerson creates the company from the domain.
  const personIds: string[] = [];
  await withLeadTransaction(async (tx) => {
    for (const p of PEOPLE) {
      const person = await upsertPerson(tx, {
        email: p.email,
        linkedinUrl: p.linkedinUrl,
        firstName: p.firstName,
        lastName: p.lastName,
        title: p.title,
        company: { name: p.company.name, domain: p.company.domain, raw: { industry: p.company.industry } },
        source: "demo-seed",
      });
      personIds.push(person.id);
    }
  });

  // CRM: 15 records, each opened by a lead's reply, then placed at a stage.
  const { pipelineId } = await ensureCrmDefaults();
  const subcategories = await db
    .select({ id: crmSubcategories.id, categoryKey: crmSubcategories.categoryKey })
    .from(crmSubcategories)
    .where(and(eq(crmSubcategories.pipelineId, pipelineId), eq(crmSubcategories.active, true)));
  // Skip "Do Not Contact": it suppresses the person, which is not wanted in a demo.
  const dncRow = await db
    .select({ id: crmSubcategories.id })
    .from(crmSubcategories)
    .where(and(eq(crmSubcategories.pipelineId, pipelineId), eq(crmSubcategories.name, "Do Not Contact")));
  const dncIds = new Set(dncRow.map((r) => r.id));
  const stages = subcategories.filter((s) => !dncIds.has(s.id));
  const replyFor = REPLIES.filter((r) => !/remove me/i.test(r));

  const now = Date.now();
  const DAY = 86_400_000;
  let crmCount = 0;
  let messageCount = 0;
  for (let i = 0; i < 15; i++) {
    const personId = personIds[i];
    const p = PEOPLE[i];
    const linkedin = i % 3 === 2;
    const channel = linkedin ? "linkedin" : "email";
    const accountRef = linkedin ? "demo-linkedin-account" : "demo@northwind.example";
    const threadId = `demo-thread-${i + 1}`;
    const sentAt = new Date(now - (16 - i) * DAY * 0.7);

    // Our opener first (outbound), so the thread reads as a real exchange.
    await withCrmTransaction(async (tx) => {
      const { getOrCreateCrmRecordForInbound } = await import("@/lib/crm/records");
      const { record } = await getOrCreateCrmRecordForInbound(tx, { personId, pipelineId, cause: "first_inbound_reply" });
      const { conversation } = await upsertConversationInTransaction(tx, {
        crmRecordId: record.id,
        personId,
        channel,
        accountRef,
        providerThreadId: threadId,
        providerContactId: linkedin ? `demo-contact-${i + 1}` : null,
      });
      await insertConversationMessageInTransaction(tx, {
        conversationId: conversation.id,
        personId,
        channel,
        accountRef,
        direction: "outbound",
        idempotencyKey: `demo-seed:${i + 1}:out`,
        providerMessageId: `demo-out-${i + 1}`,
        subject: linkedin ? null : `Quick question, ${p.company.name}`,
        bodyText: OUR_OPENERS[i % OUR_OPENERS.length].replace("{first}", p.firstName).replace("{company}", p.company.name),
        sentAt: new Date(sentAt.getTime() - DAY),
      });
    });

    const result = await ingestInboundReply({
      personId,
      pipelineId,
      channel,
      accountRef,
      providerThreadId: threadId,
      providerContactId: linkedin ? `demo-contact-${i + 1}` : null,
      idempotencyKey: `demo-seed:${i + 1}:in`,
      providerMessageId: `demo-in-${i + 1}`,
      subject: linkedin ? null : `Re: Quick question, ${p.company.name}`,
      bodyText: replyFor[i % replyFor.length],
      sentAt,
      actorRef: "demo-seed",
    });
    messageCount += 2;
    crmCount += 1;

    const stage = stages[i % stages.length];
    await applyHumanClassification({
      recordId: result.record.id,
      categoryKey: stage.categoryKey as Parameters<typeof applyHumanClassification>[0]["categoryKey"],
      subcategoryId: stage.id,
      expectedContextVersion: result.record.contextVersion,
      reason: "Demo data",
      actorRef: "demo-seed",
    });
  }

  // Ingesting each reply queued an AI classification and a draft, but the
  // seed classified every record by hand right after, so those jobs are
  // already out of date (and the demo has no AI provider connected): on the
  // first start they would only fail as "stale". Drop them.
  {
    const { crmJobs } = await import("@/lib/crm/schema");
    await db.delete(crmJobs).where(and(inOrg(crmJobs), eq(crmJobs.status, "queued")));
  }

  // Knowledge document.
  await createKnowledgeDocument({
    title: "About Northwind Demo",
    kind: "company",
    tags: ["company", "pricing", "faq"],
    alwaysInclude: true,
    content: KNOWLEDGE,
  });

  // Tables: a workbook with one table of 20 rows.
  const { workbook, table } = await createWorkbook({ name: "Demo prospects", firstTableName: "Target accounts" });
  const first = (await listColumns(table.id))[0];
  const { gridColumns } = await import("@/lib/grid/schema");
  await db.update(gridColumns).set({ name: "Company" }).where(eq(gridColumns.id, first.id));
  const colDefs = [
    { name: "Website", type: "url" as const },
    { name: "Industry", type: "text" as const },
    { name: "Contact", type: "text" as const },
    { name: "Email", type: "email" as const },
    { name: "Employees", type: "number" as const },
    {
      name: "Stage",
      type: "select" as const,
      config: {
        options: [
          { value: "new", label: "New", color: "gray" },
          { value: "researching", label: "Researching", color: "blue" },
          { value: "contacted", label: "Contacted", color: "green" },
        ],
      },
    },
  ];
  const keys: Record<string, string> = { Company: first.key };
  for (const def of colDefs) {
    const col = await createColumn({ tableId: table.id, name: def.name, type: def.type, config: "config" in def ? def.config : undefined });
    keys[def.name] = col.key;
  }
  const stageValues = ["new", "researching", "contacted"];
  const rows = Array.from({ length: 20 }, (_, i) => {
    const c = COMPANIES[i % COMPANIES.length];
    const person = PEOPLE[(i * 2) % PEOPLE.length];
    const label = i < COMPANIES.length ? c.name : `${c.name} (EMEA)`;
    return {
      [keys.Company]: label,
      [keys.Website]: `https://${c.domain}`,
      [keys.Industry]: c.industry,
      [keys.Contact]: `${person.firstName} ${person.lastName}`,
      [keys.Email]: person.email,
      [keys.Employees]: 20 + ((i * 37) % 480),
      [keys.Stage]: stageValues[i % 3],
    };
  });
  const rowCount = await insertRows(table.id, rows);

  // Email campaign (draft) with a 2-step sequence and 10 leads, imported the way the UI does.
  const campaign = await createCampaign({ name: "Demo: Q4 outbound to ops leaders" });
  await updateCampaignSequence(campaign.id, [
    {
      stepNumber: 1,
      subject: "Quick question, {{company}}",
      body: "Hi {{firstName}},\n\nI work with sales teams like yours at {{company}} on cutting lead research time. Would a short walkthrough be useful?\n\nBest,\nDemo User",
      waitDays: 0,
    },
    {
      stepNumber: 2,
      subject: "Re: Quick question, {{company}}",
      body: "Hi {{firstName}},\n\nFollowing up in case this got buried. Happy to send a two-minute overview instead of a call.\n\nBest,\nDemo User",
      waitDays: 3,
    },
  ]);
  const csvRows = PEOPLE.slice(20, 30).map(
    (p) => `${p.email},${p.firstName},${p.lastName},${p.company.name},${p.title}`,
  );
  const csv = ["Email,First Name,Last Name,Company,Job Title", ...csvRows].join("\n");
  const imported = await importLeadsForCampaign(campaign.id, new TextEncoder().encode(csv).buffer as ArrayBuffer, {
    filename: "demo-leads.csv",
  });
  if ("error" in imported) throw new Error(`Demo lead import failed: ${imported.error}`);

  // LinkedIn campaign (paused): no accounts or leads — those need real Unipile ids.
  await db.insert(linkedinCampaigns).values({
    organizationId: currentOrganizationId(),
    name: "Demo: LinkedIn intro to RevOps leads",
    description: "Sample campaign. Connect LinkedIn in Settings, then assign an account and leads.",
    status: "PAUSED",
    invitationMessage: "Hi {{firstName}}, I enjoy what {{company}} is building. Would love to connect.",
    acceptanceMessage: "Thanks for connecting, {{firstName}}. Happy to share how teams like yours cut research time.",
    followUp1Message: "Hi {{firstName}}, any thoughts on my last note?",
  });

  const peopleCount = (await db.select({ id: people.id }).from(people).where(inOrg(people))).length;
  const companyCount = (await db.select({ id: companies.id }).from(companies).where(inOrg(companies))).length;
  return {
    "people": peopleCount,
    "companies": companyCount,
    "CRM records (with conversations)": crmCount,
    "CRM conversation messages": messageCount,
    "knowledge documents": 1,
    [`Tables workbook "${workbook.name}" rows`]: rowCount,
    "email campaign (draft), 2-step sequence, leads": imported.imported,
    "LinkedIn campaigns (paused)": 1,
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
