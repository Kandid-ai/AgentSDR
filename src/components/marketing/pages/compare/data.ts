/**
 * Everything the five "alternative" pages and the /compare hub say, as plain
 * data (no React), so one template renders them all and they stay consistent.
 *
 * RULES FOR EDITING THIS FILE
 * - A claim about a competitor is allowed only if it was read on that
 *   competitor's own site or docs. The source URL sits in a comment beside it.
 *   Last checked: October 2026.
 * - No competitor prices as numbers. Describe the pricing model in words.
 * - A cell is "unknown" ("Not compared") rather than a guess.
 * - Claims about AgentSDR come from docs/ and the code only.
 */

export type Verdict = "yes" | "partial" | "no" | "info" | "unknown";

export type Cell = { v: Verdict; text: string };

export type CompareRow = { feature: string; agentsdr: Cell; them: Cell };

export type ScreenKey = "campaigns" | "actions" | "analytics" | "inbox" | "calls";
export type SceneChannel = "email" | "linkedin" | "whatsapp" | "crm";

export type Angle = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  scene: { channel: SceneChannel; index: number; label: string; accent: string };
};

export type Block = { title: string; body: string };

export type Competitor = {
  slug: "clay" | "lemlist" | "heyreach" | "instantly" | "apollo";
  name: string;
  /** Page <title> before " | AgentSDR". */
  metaTitle: string;
  ogTitle: string;
  description: string;
  /** What the hero eyebrow says. */
  eyebrow: string;
  /** The h1 (must contain "open-source <Name> alternative"). */
  h1: string;
  lede: string;
  heroScreen: ScreenKey;
  /** One honest line for the hub card: what this tool is. */
  whatItIs: string;
  /** Short summary shown in the verdict band. */
  verdict: { agentsdr: string; them: string };
  /** The matrix section's lede. */
  tableLede: string;
  rows: CompareRow[];
  angles: Angle[];
  better: Block[];
  switchReasons: Block[];
  steps: Block[];
  faq: Array<{ q: string; a: string }>;
  related: string[];
  cta: { title: string; lede: string };
};

const AGENT_ACCENT = { email: "#fa7319", linkedin: "#335cff", ai: "#7d52f4", data: "#0b8a7a" } as const;

// ---------------------------------------------------------------- facts about AgentSDR (docs/, CLAUDE.md, code)

const SELF_HOSTED: Cell = { v: "yes", text: "Self-hosted. AGPL-3.0 source on your own server and database" };
const NO_FEES: Cell = { v: "info", text: "No seat or contact fees from AgentSDR. You pay for your server and the services you connect" };
const NO_DATABASE: Cell = { v: "no", text: "No built-in contact database. You import lists or connect providers with your own keys" };
const GOOGLE_ONLY: Cell = { v: "partial", text: "From your own Google Workspace mailboxes only" };
const MULTI_LINKEDIN: Cell = { v: "yes", text: "Several LinkedIn accounts through Unipile, each with its own daily limit and working hours" };
const INBOX_ALL: Cell = { v: "yes", text: "One inbox for email, LinkedIn and WhatsApp replies" };

// ---------------------------------------------------------------- Clay

const clay: Competitor = {
  slug: "clay",
  name: "Clay",
  metaTitle: "Open-source Clay alternative with outreach built in",
  ogTitle: "The open-source Clay alternative",
  description:
    "Looking for a Clay alternative? AgentSDR is an open-source, self-hosted tool with enrichment tables, AI columns and email, LinkedIn and WhatsApp outreach in one app.",
  eyebrow: "Clay alternative",
  h1: "The open-source Clay alternative",
  lede: "Build a list in a table, enrich it with providers and AI columns, then send to it and answer the replies, all in one app you host yourself. Clay is a strong data platform. AgentSDR is the option when you also want the outreach, the CRM and the code.",
  heroScreen: "campaigns",
  whatItIs: "A hosted data and workflow platform built around enrichment tables and a marketplace of data providers.",
  verdict: {
    agentsdr: "Tables, AI columns, three outreach channels and an AI CRM in one self-hosted app. Bring your own provider keys.",
    them: "Wider data coverage: a provider marketplace, waterfalls and signals, plus CRM and ad syncing.",
  },
  tableLede: "Both tools start from a table of people and let a column fetch data or write with AI. They differ in what happens next, and in who runs it.",
  rows: [
    {
      feature: "Where it runs",
      // https://www.clay.com/pricing (plans with a free tier; hosted product)
      agentsdr: SELF_HOSTED,
      them: { v: "info", text: "Hosted by Clay, with Free, Launch, Growth and Enterprise plans" },
    },
    {
      feature: "How you pay",
      // https://www.clay.com/pricing: "Actions" and "Data Credits"; unlimited seats and tables on all plans
      agentsdr: NO_FEES,
      them: { v: "info", text: "A plan plus two usage currencies, Actions and Data Credits. Seats and tables are unlimited on every plan" },
    },
    {
      feature: "Data providers",
      // https://www.clay.com/pricing: "150+ data providers"; https://www.clay.com homepage: "200+ providers in one place"
      agentsdr: { v: "partial", text: "15 providers, each connected with your own account and key" },
      them: { v: "yes", text: "A marketplace of 150+ providers, bought with Data Credits" },
    },
    {
      feature: "Waterfall enrichment",
      // https://www.clay.com/pricing: "Run multi-provider waterfalls"; AgentSDR: docs/tables/overview.mdx (Waterfall column disabled)
      agentsdr: { v: "no", text: "Not yet. A column uses one provider and does not fall back to another" },
      them: { v: "yes", text: "Multi-provider waterfalls" },
    },
    {
      feature: "AI research per row",
      // https://www.clay.com homepage: "Claygents ... Research target companies and people with AI"
      agentsdr: { v: "yes", text: "Use AI columns, with optional web research, on your own OpenRouter key" },
      them: { v: "yes", text: "Claygent, its AI research agent" },
    },
    {
      feature: "Sending from a table",
      // https://university.clay.com/docs/email-sequencer: "Email is the only channel supported"
      agentsdr: { v: "yes", text: "Create an email or LinkedIn campaign from the rows you select" },
      them: { v: "partial", text: "A native sequencer that sends email only, from Gmail, Outlook or SMTP accounts" },
    },
    {
      feature: "LinkedIn and WhatsApp outreach",
      // https://university.clay.com/docs/email-sequencer (sequencer is email only)
      agentsdr: { v: "yes", text: "LinkedIn campaigns and WhatsApp messages and calls, through Unipile" },
      them: { v: "no", text: "Not in its sequencer, which is email only" },
    },
    {
      feature: "Email accounts supported",
      // https://university.clay.com/docs/connect-your-own-email-accounts: Gmail OAuth, Outlook OAuth, SMTP, bulk CSV
      agentsdr: GOOGLE_ONLY,
      them: { v: "yes", text: "Gmail, Outlook, SMTP and bulk CSV upload" },
    },
    {
      feature: "Replies",
      // https://university.clay.com/docs/email-sequencer: Replies tab, stops on reply, out-of-office detection
      agentsdr: { v: "yes", text: "Every reply classified, with a drafted answer you approve, across all channels" },
      them: { v: "yes", text: "A Replies tab to respond in Clay. Campaigns stop when a lead replies" },
    },
    {
      feature: "Sync to other systems",
      // https://www.clay.com/pricing: CRM auto-sync, ad platform sync, data warehouse connections
      agentsdr: { v: "partial", text: "Its own AI CRM and pipeline. No HubSpot or Salesforce sync, and CSV export" },
      them: { v: "yes", text: "CRM sync, ad platform syncing and data warehouse connections" },
    },
  ],
  angles: [
    {
      eyebrow: "From table to campaign",
      title: "The list and the send live in the same app",
      body: "In Tables, every row is a person. Add enrichment, AI and formula columns, test on ten rows, then select the rows you want and create an email or LinkedIn campaign. Unmapped columns come with them as merge fields.",
      bullets: ["Columns auto-run once the columns they read have values", "Up to 5,000 selected rows enrolled in one campaign", "Suppressed addresses are skipped and reported"],
      scene: { channel: "email", index: 0, label: "A lead's table row filling an email's merge fields. An illustration with sample data.", accent: AGENT_ACCENT.email },
    },
    {
      eyebrow: "After the send",
      title: "Replies come back to the same record",
      body: "A reply on email, LinkedIn or WhatsApp is read, classified and answered with a draft from your knowledge base. The person is one record across channels, so a reply anywhere stops the other sequences.",
      bullets: ["Categories such as interested, not interested and wrong person", "Drafts wait for your approval", "Do Not Contact applies on every channel"],
      scene: { channel: "crm", index: 0, label: "An inbound reply being classified by the AI CRM. An illustration with sample data.", accent: AGENT_ACCENT.ai },
    },
  ],
  better: [
    { title: "You need breadth of data", body: "Clay's marketplace covers far more providers than the 15 AgentSDR connects to, and it can fall back from one provider to the next. If coverage is the hard part of your job, that matters." },
    { title: "You send from Outlook or SMTP", body: "Clay's sequencer connects Gmail, Outlook and SMTP accounts. AgentSDR sends email only from Google Workspace mailboxes today." },
    { title: "You push data into other systems", body: "Clay syncs to CRMs, ad platforms and data warehouses. AgentSDR has its own CRM and exports CSV, and does not sync to HubSpot or Salesforce." },
    { title: "You want it hosted for you", body: "Clay is a hosted product with support behind it. AgentSDR is software you deploy, update and back up yourself." },
  ],
  switchReasons: [
    { title: "Outreach is not an add-on", body: "LinkedIn and WhatsApp campaigns, mailboxes with daily limits, and an AI inbox are part of the same app as the table." },
    { title: "No credit meter from AgentSDR", body: "AgentSDR adds no credits or seat fees. You still pay each data provider and your AI model on your own accounts, so spend stays visible there." },
    { title: "Your data stays on your server", body: "Leads, conversations and recordings live in your own PostgreSQL database, not in someone else's workspace." },
    { title: "You can read and change the code", body: "AGPL-3.0 means you can audit how a column runs, add a provider or fork it for your team." },
  ],
  steps: [
    { title: "Export your tables", body: "Download each Clay table as CSV. Keep the email, LinkedIn URL and any column you merge into copy." },
    { title: "Import into a table", body: "Create a workbook from the CSV (up to 50,000 rows per import) and map each column's type." },
    { title: "Reconnect your providers", body: "Add your own Apollo, Hunter, Lusha and other keys. Rebuild enrichment and AI columns, and test on ten rows." },
    { title: "Create the campaign", body: "Select rows, choose email or LinkedIn, map the columns and launch from your connected accounts." },
  ],
  faq: [
    { q: "Is there an open-source alternative to Clay?", a: "AgentSDR is open source under AGPL-3.0 and covers the table side (enrichment, AI and formula columns) and the outreach side (email, LinkedIn, WhatsApp, AI CRM). It does not include a data marketplace, so you connect your own provider accounts." },
    { q: "Does AgentSDR have waterfall enrichment like Clay?", a: "Not yet. The Waterfall column appears in the menu but is disabled, so each enrichment column uses one provider. FullEnrich finds results through a waterfall on its own side, and you can add it as a provider." },
    { q: "Which data providers can AgentSDR use?", a: "Fifteen: Apollo, Hunter, Snov.io, Findymail, FullEnrich, LeadMagic, ContactOut, RocketReach, Icypeas, Cleanlist, Lusha, MillionVerifier, ZeroBounce, Similarweb and Semrush. Each is connected with your own account and key." },
    { q: "Can I run AI research on every row?", a: "Yes. A Use AI column sends a prompt for each row, can browse the web for research, and returns typed fields. It runs on your own OpenRouter key, and you choose which models are allowed." },
    { q: "Can I send email from Outlook?", a: "Not yet. AgentSDR sends email from Google Workspace mailboxes only. LinkedIn and WhatsApp go through Unipile." },
    { q: "How do I move my lists from Clay?", a: "Export each table as CSV and import it into an AgentSDR table. Rebuild the columns you rely on, since columns are not portable between the two tools." },
  ],
  related: ["/product/tables", "/product/lead-database", "/compare/apollo", "/product/ai-crm", "/open-source", "/compare/lemlist"],
  cta: { title: "Keep the table, add the outreach", lede: "Clone the repo, connect your provider keys and send from the list you build. No seats and no credits from us." },
};

// ---------------------------------------------------------------- lemlist

const lemlist: Competitor = {
  slug: "lemlist",
  name: "lemlist",
  metaTitle: "Open-source lemlist alternative for multichannel",
  ogTitle: "The open-source lemlist alternative",
  description:
    "Searching for a lemlist alternative? AgentSDR is open source and self-hosted: email, LinkedIn and WhatsApp campaigns, one inbox and an AI CRM with no per-seat pricing.",
  eyebrow: "lemlist alternative",
  h1: "The open-source lemlist alternative",
  lede: "Reach people on email, LinkedIn and WhatsApp from accounts you own, with one record per person and one inbox for the answers. lemlist is a polished hosted platform with its own lead database. AgentSDR is the one you run yourself.",
  heroScreen: "analytics",
  whatItIs: "A hosted multichannel outreach platform with a lead database, deliverability tools and AI agents.",
  verdict: {
    agentsdr: "Email, LinkedIn and WhatsApp as separate campaigns that stop each other on a reply, with an AI CRM behind them.",
    them: "One workflow across email, LinkedIn, calls, WhatsApp and SMS, with a contact database and warm-up built in.",
  },
  tableLede: "Both reach leads across several channels and merge replies into one inbox. The difference is how a sequence is built and who hosts it.",
  rows: [
    {
      feature: "Where it runs",
      // https://www.lemlist.com/pricing: hosted plans with a free trial
      agentsdr: SELF_HOSTED,
      them: { v: "info", text: "Hosted by lemlist, with a 14-day trial" },
    },
    {
      feature: "How you pay",
      // https://www.lemlist.com/pricing: tiered subscription, unlimited users and senders on the Email plan, credits as an add-on
      agentsdr: NO_FEES,
      them: { v: "info", text: "Tiered subscriptions (Email, Multichannel, Enterprise) with optional credits for enrichment and signals" },
    },
    {
      feature: "Contact database",
      // https://www.lemlist.com: "650M+ Lead Database"
      agentsdr: NO_DATABASE,
      them: { v: "yes", text: "A built-in lead database of 650M+ contacts per its site, with email and phone finders" },
    },
    {
      feature: "Email sending",
      // https://www.lemlist.com/pricing ("unlimited users & email senders"), https://www.lemlist.com (lemwarm)
      agentsdr: GOOGLE_ONLY,
      them: { v: "yes", text: "Email senders on every plan, with lemwarm warm-up and deliverability tools" },
    },
    {
      feature: "LinkedIn",
      // https://www.lemlist.com/pricing: Multichannel plan includes LinkedIn automation
      agentsdr: MULTI_LINKEDIN,
      them: { v: "yes", text: "LinkedIn automation on the Multichannel plan" },
    },
    {
      feature: "WhatsApp",
      // https://www.lemlist.com/pricing: "WhatsApp add-ons"
      agentsdr: { v: "yes", text: "Message campaigns and recorded calls from your own number, through Unipile" },
      them: { v: "partial", text: "WhatsApp as an add-on to the Multichannel plan" },
    },
    {
      feature: "Mixed-channel sequences",
      // https://www.lemlist.com: "one workflow" across channels
      agentsdr: { v: "partial", text: "Each campaign is one channel. A reply on any channel stops the lead's others" },
      them: { v: "yes", text: "One workflow across email, LinkedIn, calls, WhatsApp and SMS" },
    },
    {
      feature: "Calls and SMS",
      // https://www.lemlist.com: email, LinkedIn, calls, WhatsApp, SMS
      agentsdr: { v: "partial", text: "WhatsApp calls placed from the app and recorded. No SMS" },
      them: { v: "yes", text: "In-app calling and SMS" },
    },
    {
      feature: "Unified inbox",
      // https://www.lemlist.com: "unified inbox, no matter the sender or channel"
      agentsdr: INBOX_ALL,
      them: { v: "yes", text: "A unified inbox across senders and channels" },
    },
    {
      feature: "AI on replies",
      // lemlist: AI agents for signals and enrichment per homepage; reply handling not verified
      agentsdr: { v: "yes", text: "Replies classified, moved through a pipeline and answered with approved drafts" },
      them: { v: "unknown", text: "Not compared. Its site describes AI agents for signals and enrichment" },
    },
  ],
  angles: [
    {
      eyebrow: "Multichannel",
      title: "LinkedIn and WhatsApp that behave like part of one system",
      body: "People are one record, so a LinkedIn acceptance, a WhatsApp reply and an email bounce all land on the same person. Do Not Contact is checked on every channel before each send.",
      bullets: ["A reply on any channel marks enrolments replied", "30 LinkedIn invitations a day on premium accounts, 5 on free, by default", "WhatsApp by default: 25 new chats a day per number, 10 seconds between sends"],
      scene: { channel: "linkedin", index: 0, label: "A LinkedIn sequence sending an invitation and follow-ups. An illustration with sample data.", accent: AGENT_ACCENT.linkedin },
    },
    {
      eyebrow: "One queue",
      title: "Every channel's reply, drafted and waiting",
      body: "Replies from email, LinkedIn and WhatsApp reach one queue, each with a category and a drafted answer. Nothing sends until you approve it.",
      bullets: ["Per-channel limits you set once as Sending rules", "Drafts built from your own knowledge base", "Keyboard-first review"],
      scene: { channel: "crm", index: 1, label: "The AI CRM drafting an answer to a reply. An illustration with sample data.", accent: AGENT_ACCENT.ai },
    },
  ],
  better: [
    { title: "You want contacts included", body: "lemlist ships with a lead database and finders. AgentSDR has none, so you bring a list or pay a provider separately." },
    { title: "You want one sequence across channels", body: "In lemlist a single workflow can mix email, LinkedIn, calls, WhatsApp and SMS. AgentSDR campaigns are per channel." },
    { title: "Deliverability tooling matters most", body: "lemlist includes lemwarm, its own warm-up product. AgentSDR sets sensible limits per mailbox but does not warm mailboxes up." },
    { title: "You don't want to run anything", body: "lemlist is hosted, supported and maintained for you. AgentSDR needs a server and someone who updates it." },
  ],
  switchReasons: [
    { title: "No per-seat model", body: "AgentSDR charges nothing per user, sender or contact. The whole team shares one deployment, with roles for owners, admins and members." },
    { title: "WhatsApp calls and an AI CRM", body: "Calls are recorded and transcribed on your own model key, and every reply is classified and drafted for you." },
    { title: "Your own database", body: "Every lead and message sits in PostgreSQL you control, which matters if customers ask where their data lives." },
    { title: "Agencies get real separation", body: "Each client can be its own organization on one deployment, with its own accounts, leads and limits." },
  ],
  steps: [
    { title: "Export your leads", body: "Download campaign leads as CSV, including any custom columns you merge into copy." },
    { title: "Connect your accounts", body: "Add Google Workspace mailboxes, then Unipile for LinkedIn and WhatsApp numbers." },
    { title: "Rebuild each sequence", body: "Write the email, LinkedIn and WhatsApp steps. Columns become merge fields like {{jobTitle}} and you can preview a real lead." },
    { title: "Launch at safe limits", body: "Keep the defaults for a few weeks, then adjust Sending rules once replies and bounces look healthy." },
  ],
  faq: [
    { q: "Is there an open-source alternative to lemlist?", a: "AgentSDR is open source under AGPL-3.0 and runs email, LinkedIn and WhatsApp campaigns with a shared inbox and AI CRM. It has no built-in contact database and no email warm-up, both of which lemlist includes." },
    { q: "Can AgentSDR put email and LinkedIn steps in one sequence?", a: "No. Each campaign belongs to one channel. They are linked through the person: a reply on any channel stops that person's other campaigns." },
    { q: "Does AgentSDR charge per seat or per sender?", a: "No. AgentSDR adds no seat, sender or contact fees. You pay for your server and for the services you connect, such as Google Workspace and Unipile." },
    { q: "Does AgentSDR warm up mailboxes?", a: "No. It protects mailboxes with low defaults: 30 emails a day per mailbox and a random 18 to 24 minute gap, inside sending hours. Warm a new mailbox with a separate tool." },
    { q: "Does it support WhatsApp?", a: "Yes. Link your number in Unipile to send message campaigns with timed follow-ups, and place recorded calls from a Chrome extension. New numbers cannot start new chats for 24 hours." },
    { q: "Can I move my lemlist leads?", a: "Export them as CSV and import into a campaign or the lead database. Rows need an email or a LinkedIn URL. Sequences are rebuilt by hand." },
  ],
  related: ["/product/linkedin", "/product/whatsapp", "/product/email", "/product/inbox", "/compare/instantly", "/solutions/sales-teams"],
  cta: { title: "Multichannel without the seat count", lede: "Deploy it once, connect your mailboxes and numbers, and let the whole team work from one inbox." },
};

// ---------------------------------------------------------------- HeyReach

const heyreach: Competitor = {
  slug: "heyreach",
  name: "HeyReach",
  metaTitle: "Open-source HeyReach alternative for LinkedIn",
  ogTitle: "The open-source HeyReach alternative",
  description:
    "Need a HeyReach alternative? AgentSDR runs LinkedIn campaigns across several accounts on your own server, with email, WhatsApp, a shared inbox and an AI CRM.",
  eyebrow: "HeyReach alternative",
  h1: "The open-source HeyReach alternative",
  lede: "Run LinkedIn outreach across several accounts, each paced to its own limits, from software on your own server. HeyReach is built around LinkedIn at scale. AgentSDR covers LinkedIn and then follows the lead onto email and WhatsApp.",
  heroScreen: "inbox",
  whatItIs: "A hosted LinkedIn outreach tool built around many sender accounts and a unified inbox.",
  verdict: {
    agentsdr: "Several LinkedIn accounts, plus email and WhatsApp and an AI CRM, on a server you control.",
    them: "A LinkedIn-first product with sender rotation, white-label options and an API, at a fixed cost per plan.",
  },
  tableLede: "Both connect several LinkedIn accounts and read replies in one place. They diverge on what surrounds LinkedIn.",
  rows: [
    {
      feature: "Where it runs",
      // https://www.heyreach.io/pricing: hosted plans with trials
      agentsdr: SELF_HOSTED,
      them: { v: "info", text: "Hosted by HeyReach, with a 14-day trial of its entry plan" },
    },
    {
      feature: "How you pay",
      // https://www.heyreach.io/pricing: per-sender model with Growth, Agency and Unlimited tiers
      agentsdr: NO_FEES,
      them: { v: "info", text: "Per sender account on the entry plan, with Agency and Unlimited tiers that bundle senders" },
    },
    {
      feature: "Several LinkedIn accounts",
      // https://www.heyreach.io: "Connect unlimited LinkedIn accounts for one flat fee and automatically rotate sending between them"
      agentsdr: MULTI_LINKEDIN,
      them: { v: "yes", text: "Many senders per workspace, with sending rotated between them" },
    },
    {
      feature: "LinkedIn actions",
      // https://www.heyreach.io: connection requests, messages, voice notes, profile views, conditional logic
      agentsdr: { v: "partial", text: "Connection request, an acceptance message and three follow-ups, plus profile lookups" },
      them: { v: "yes", text: "Connection requests, messages, voice notes and profile views, with conditional logic" },
    },
    {
      feature: "Finding leads",
      // AgentSDR: docs/linkedin/campaigns.mdx (Search); HeyReach lead search not verified
      agentsdr: { v: "yes", text: "LinkedIn search URLs run in batches, with a daily lead quota per account" },
      them: { v: "unknown", text: "Not compared" },
    },
    {
      feature: "Unified inbox",
      // https://www.heyreach.io: "Handle all LinkedIn messages in one centralized inbox"
      agentsdr: INBOX_ALL,
      them: { v: "yes", text: "All LinkedIn messages from every sender in one inbox" },
    },
    {
      feature: "Email and WhatsApp",
      // https://www.heyreach.io: native integrations with Instantly, Smartlead and EmailBison
      agentsdr: { v: "yes", text: "Email from Google Workspace mailboxes, WhatsApp messages and calls, in the same app" },
      them: { v: "partial", text: "Through integrations with email tools such as Instantly, Smartlead and EmailBison" },
    },
    {
      feature: "API and webhooks",
      // https://www.heyreach.io/pricing: API and webhook access on all tiers
      agentsdr: { v: "partial", text: "Receives Unipile webhooks. No public outbound API or webhooks documented" },
      them: { v: "yes", text: "API and webhook access on all tiers" },
    },
    {
      feature: "Agency white-label",
      // https://www.heyreach.io/pricing: white-label customisation on Agency and above
      agentsdr: { v: "partial", text: "One organization per client on one deployment. No white-labelling of the app" },
      them: { v: "yes", text: "White-label customisation on Agency and higher plans" },
    },
    {
      feature: "AI on replies",
      // https://www.heyreach.io: "AI agents run LinkedIn outreach end-to-end" via Claude, ChatGPT connections
      agentsdr: { v: "yes", text: "Every reply classified and answered with a draft you approve" },
      them: { v: "partial", text: "Connects to AI assistants such as Claude and ChatGPT to run outreach" },
    },
  ],
  angles: [
    {
      eyebrow: "Multi-account LinkedIn",
      title: "Several accounts, each held to its own limits",
      body: "Choose which LinkedIn senders a campaign may use. Every account keeps its own daily limit, working hours and rest between runs, and one that hits a LinkedIn limit stops for the day while its leads go back to the queue.",
      bullets: ["Daily limit per account, with a warning past the safe edge", "Small runs, 30 to 60 seconds apart, then a rest", "A person already invited by an account is never invited again by it"],
      scene: { channel: "linkedin", index: 1, label: "LinkedIn invitations paced in small runs with rests. An illustration with sample data.", accent: AGENT_ACCENT.linkedin },
    },
    {
      eyebrow: "Beyond LinkedIn",
      title: "When they accept, they are already in your CRM",
      body: "A LinkedIn reply reaches the same AI CRM as email and WhatsApp replies, classified and drafted. If someone answers on another channel, their LinkedIn follow-ups stop.",
      bullets: ["One record per person across channels", "Replies classified into your categories", "A personal campaign type keeps chosen replies out of the shared inbox"],
      scene: { channel: "linkedin", index: 3, label: "LinkedIn replies arriving in a shared inbox. An illustration with sample data.", accent: AGENT_ACCENT.linkedin },
    },
  ],
  better: [
    { title: "LinkedIn is your whole motion", body: "HeyReach is built for LinkedIn at scale, with sender rotation, voice notes, conditional logic and agency plans. AgentSDR does LinkedIn well but also spreads effort across other channels." },
    { title: "You run an agency that needs white-label", body: "HeyReach offers white-label customisation on its agency plans. AgentSDR gives each client a separate organization but does not rebrand the app." },
    { title: "You need an API", body: "HeyReach lists API and webhook access on all tiers so you can automate around it. AgentSDR has no public API for that today." },
    { title: "You want someone else to operate it", body: "HeyReach is hosted and offers a done-for-you service. AgentSDR is yours to deploy and maintain." },
  ],
  switchReasons: [
    { title: "No fee per sender", body: "AgentSDR does not charge by LinkedIn account. You pay Unipile for the connections you use and nothing to us." },
    { title: "The follow-up is built in", body: "A reply on any channel lands in one AI queue, so LinkedIn conversations do not need a second tool." },
    { title: "Your accounts, your server", body: "Sign-in happens on Unipile's hosted page, so AgentSDR never sees a LinkedIn password, and the data stays in your database." },
    { title: "Conservative defaults", body: "30 invitations a day on premium, 5 on free, with settings that warn before you go past the safe edge." },
  ],
  steps: [
    { title: "Connect Unipile", body: "Add your Unipile DSN and access token. AgentSDR registers the webhooks it needs for you." },
    { title: "Add each LinkedIn account", body: "Sign in on Unipile's hosted page for every sender and set each account's daily limit and working hours." },
    { title: "Import your leads", body: "Upload a CSV with LinkedIn URLs, add people from your database, or run LinkedIn searches." },
    { title: "Pick senders and launch", body: "Write the invitation and up to four messages, choose the senders and launch. Review replies in the inbox." },
  ],
  faq: [
    { q: "Is there an open-source alternative to HeyReach?", a: "AgentSDR is open source under AGPL-3.0 and sends LinkedIn campaigns from several accounts through Unipile. It also covers email and WhatsApp. It has no white-label option or public API." },
    { q: "Can AgentSDR use multiple LinkedIn accounts?", a: "Yes. Connect each account through Unipile and choose which senders each campaign may use. Every account has its own daily limit and working hours." },
    { q: "What are the LinkedIn limits?", a: "By default 30 invitations a day for Premium or Sales Navigator accounts and 5 for free accounts, in runs of 3 to 4 with 30 to 60 seconds between them. You can change all of these, and the settings warn before the risky range." },
    { q: "Is automating LinkedIn allowed?", a: "LinkedIn's terms do not allow automation, and accounts can be restricted. AgentSDR's limits keep activity modest, but no tool can promise an account stays safe. Read the responsible use page before you start." },
    { q: "Does AgentSDR support voice notes or profile views?", a: "Not as outreach steps. A sequence is a connection request, an acceptance message and up to three follow-ups. Profile lookups are used to match leads to their LinkedIn profile." },
    { q: "Can I use AgentSDR for client work as an agency?", a: "Yes. Give each client its own organization on one deployment, so leads, accounts and settings stay separate." },
  ],
  related: ["/product/linkedin", "/guides/linkedin-automation-limits", "/solutions/agencies", "/product/inbox", "/compare/lemlist", "/product/ai-crm"],
  cta: { title: "LinkedIn at your own pace", lede: "Connect your accounts through Unipile, set limits you trust and keep every conversation in your own database." },
};

// ---------------------------------------------------------------- Instantly

const instantly: Competitor = {
  slug: "instantly",
  name: "Instantly",
  metaTitle: "Open-source Instantly alternative for cold email",
  ogTitle: "The open-source Instantly alternative",
  description:
    "Comparing Instantly alternatives? AgentSDR is open-source cold email from your own Google Workspace mailboxes, with an AI inbox that classifies and drafts every reply.",
  eyebrow: "Instantly alternative",
  h1: "The open-source Instantly alternative",
  lede: "Send cold email from your own mailboxes with per-mailbox limits, then let an AI CRM read every reply and draft the answer. Instantly is a mature, hosted cold email platform with a lead database. AgentSDR is the self-hosted one.",
  heroScreen: "actions",
  whatItIs: "A hosted cold email platform with unlimited sending accounts, warm-up, a lead database and an AI CRM.",
  verdict: {
    agentsdr: "Cold email from Google Workspace, plus LinkedIn and WhatsApp, and an AI CRM that classifies and drafts replies.",
    them: "Deliverability tooling, unlimited accounts and warm-up, a lead database and AI agents, hosted for you.",
  },
  tableLede: "Both centre on cold email from your own accounts and an inbox that handles replies. Instantly has more email infrastructure around it. AgentSDR has more channels and the code.",
  rows: [
    {
      feature: "Where it runs",
      // https://instantly.ai/pricing: hosted plans
      agentsdr: SELF_HOSTED,
      them: { v: "info", text: "Hosted by Instantly" },
    },
    {
      feature: "How you pay",
      // https://instantly.ai/pricing: Bundles, Outreach, Credits; https://instantly.ai/crm: unlimited team seats
      agentsdr: NO_FEES,
      them: { v: "info", text: "Separate plans for outreach, bundles and a credit system for its lead database and AI tools. Unlimited team seats on its CRM" },
    },
    {
      feature: "Sending accounts",
      // https://instantly.ai/pricing: "Unlimited Email Accounts" and "Unlimited Email Warmup"
      agentsdr: { v: "partial", text: "Google Workspace mailboxes only, each with its own daily limit and sending hours" },
      them: { v: "yes", text: "Unlimited email accounts and unlimited warm-up on its plans" },
    },
    {
      feature: "Email warm-up",
      // https://instantly.ai/pricing: warmup
      agentsdr: { v: "no", text: "Not built in. Low per-mailbox defaults instead: 30 a day, 18 to 24 minutes apart" },
      them: { v: "yes", text: "Email warm-up included" },
    },
    {
      feature: "Deliverability tools",
      // https://instantly.ai homepage: inbox placement, deliverability management
      agentsdr: { v: "partial", text: "Bounce suppression, one-click unsubscribe and reply stop. No inbox placement testing" },
      them: { v: "yes", text: "Inbox placement and deliverability management tools" },
    },
    {
      feature: "Lead database",
      // https://instantly.ai/crm and /pricing: "450M+ B2B Leads"
      agentsdr: NO_DATABASE,
      them: { v: "yes", text: "A B2B lead database of 450M+ contacts per its site, paid with credits" },
    },
    {
      feature: "Unified inbox",
      // https://instantly.ai/crm: "Unified Master Inbox"
      agentsdr: INBOX_ALL,
      them: { v: "yes", text: "A master inbox for emails, calls, SMS and tasks" },
    },
    {
      feature: "AI on replies",
      // https://instantly.ai homepage: "AI Reply Agent"
      agentsdr: { v: "yes", text: "Replies classified, with a reason, and answered with drafts you approve" },
      them: { v: "yes", text: "An AI Reply Agent for handling responses" },
    },
    {
      feature: "Other channels",
      // https://instantly.ai/crm: "email, calling, and SMS"
      agentsdr: { v: "yes", text: "LinkedIn and WhatsApp campaigns, plus recorded WhatsApp calls" },
      them: { v: "partial", text: "Its CRM page lists email, calling and SMS" },
    },
    {
      feature: "Pipeline and analytics",
      // https://instantly.ai homepage: opportunities, pipeline, conversions, revenue tracking
      agentsdr: { v: "yes", text: "A pipeline and analytics by channel for replies, meetings and customers" },
      them: { v: "yes", text: "Tracking of opportunities, pipeline, conversions and revenue" },
    },
  ],
  angles: [
    {
      eyebrow: "Cold email, kept small",
      title: "Limits that look like a person wrote the email",
      body: "Each mailbox has its own daily cap, sending window and signature. Mails go out one at a time with a random gap, and a lead stays with the mailbox that first wrote to them.",
      bullets: ["30 emails a day per mailbox by default", "A random 18 to 24 minute gap between sends", "Follow-ups in the same thread when the subject is left blank"],
      scene: { channel: "email", index: 1, label: "Mailboxes filling up to their daily limits. An illustration with sample data.", accent: AGENT_ACCENT.email },
    },
    {
      eyebrow: "The AI inbox",
      title: "Every reply read, sorted and drafted",
      body: "Replies are classified with a visible reason, moved through your pipeline and answered with a draft from your knowledge base. You review and send, so nothing leaves without you.",
      bullets: ["Out-of-office and bounces kept out of the way", "A reply on LinkedIn or WhatsApp also stops email follow-ups", "Keyboard-first review in Action required"],
      scene: { channel: "crm", index: 0, label: "A reply being classified and moved through the pipeline. An illustration with sample data.", accent: AGENT_ACCENT.ai },
    },
  ],
  better: [
    { title: "You send at high volume from many accounts", body: "Instantly lists unlimited email accounts, warm-up and inbox placement tools. AgentSDR is built for deliberate, per-mailbox volume and warms nothing up." },
    { title: "You need contacts included", body: "Instantly has a lead database inside the product. AgentSDR needs a list you bring or a provider you connect." },
    { title: "You use Outlook or other providers", body: "AgentSDR sends only from Google Workspace mailboxes today." },
    { title: "You want a managed service", body: "Instantly is hosted, with product support and a managed option. AgentSDR is software you run." },
  ],
  switchReasons: [
    { title: "Email is one of three channels", body: "LinkedIn and WhatsApp campaigns and recorded calls share the same lead record and inbox." },
    { title: "No usage meter from AgentSDR", body: "No plan tiers, email caps or credits from us. Your limits are the Sending rules you set." },
    { title: "Your mailbox data stays yours", body: "Messages, leads and suppression lists live in your own PostgreSQL database." },
    { title: "AI you can steer", body: "Replies are drafted with your own OpenRouter key and knowledge base. Pick the model, and approve every send." },
  ],
  steps: [
    { title: "Connect Google Workspace", body: "Set up one service account with domain-wide delegation and add each mailbox by address." },
    { title: "Bring your leads and suppressions", body: "Export leads from Instantly as CSV and import them into a campaign. Include bounced and unsubscribed addresses so they stay suppressed." },
    { title: "Rebuild the sequence", body: "Write the first email and timed follow-ups with merge fields and spin text, then preview a real lead." },
    { title: "Launch and answer", body: "Replies arrive classified in Action required, with a draft ready to review." },
  ],
  faq: [
    { q: "Is there an open-source alternative to Instantly?", a: "AgentSDR is open source under AGPL-3.0 and sends multi-step cold email from your Google Workspace mailboxes. It does not include email warm-up, inbox placement tests or a contact database, which Instantly offers." },
    { q: "How many emails can AgentSDR send per mailbox?", a: "30 a day by default, with a random 18 to 24 minute gap, only inside the mailbox's sending hours. You can change the rule for your organization or per mailbox." },
    { q: "Does AgentSDR handle bounces and unsubscribes?", a: "Yes. Delivery failure reports are read from your mailbox and the address is suppressed. Every email carries an unsubscribe link and a one-click header, and suppressed addresses are never mailed again from any campaign." },
    { q: "Does AgentSDR have an AI reply agent?", a: "It classifies every reply, shows the reason and drafts an answer from your knowledge base. It sends only what you approve. It can move a lead forward on its own; anything else waits for you." },
    { q: "Can I use Outlook or SMTP mailboxes?", a: "Not yet. Email goes out through Google Workspace mailboxes only." },
    { q: "Do I need to warm up mailboxes?", a: "A new mailbox should be warmed up outside AgentSDR before you start. The product keeps volume low by default but does not generate warm-up traffic." },
  ],
  related: ["/product/email", "/guides/cold-email-google-workspace", "/product/ai-crm", "/product/inbox", "/compare/lemlist", "/compare/apollo"],
  cta: { title: "Cold email you can read the code of", lede: "Connect Google Workspace, send from mailboxes you own and let the AI inbox do the sorting." },
};

// ---------------------------------------------------------------- Apollo

const apollo: Competitor = {
  slug: "apollo",
  name: "Apollo",
  metaTitle: "Open-source Apollo alternative: own the workflow",
  ogTitle: "The open-source Apollo alternative",
  description:
    "An Apollo alternative that still uses Apollo's data: AgentSDR is open source and self-hosted, with Apollo as an enrichment provider and outreach on three channels.",
  eyebrow: "Apollo alternative",
  h1: "The open-source Apollo alternative",
  lede: "Keep Apollo's data and own everything around it. AgentSDR connects Apollo as an enrichment provider with your own key, then handles sequences, LinkedIn, WhatsApp and the replies in software you host.",
  heroScreen: "campaigns",
  whatItIs: "A hosted go-to-market platform: a B2B contact and company database with engagement tools on top.",
  verdict: {
    agentsdr: "The workflow layer: sequences, LinkedIn, WhatsApp, an AI CRM and tables, with Apollo as one of 15 data sources.",
    them: "The data itself, at a scale AgentSDR does not have, with a dialer, signals and a Chrome extension.",
  },
  tableLede: "These tools are less rivals than neighbours. Apollo's strength is its database. AgentSDR's is the workflow you own, and it can call Apollo for the data.",
  rows: [
    {
      feature: "Where it runs",
      // https://www.apollo.io/pricing: hosted plans, including a free plan
      agentsdr: SELF_HOSTED,
      them: { v: "info", text: "Hosted by Apollo, with a free plan and paid tiers" },
    },
    {
      feature: "How you pay",
      // https://www.apollo.io/pricing: per-seat tiers, credits pooled across the team, unused credits expire
      agentsdr: NO_FEES,
      them: { v: "info", text: "Per-seat subscriptions with credits pooled across the team each billing cycle" },
    },
    {
      feature: "Contact and company data",
      // https://www.apollo.io homepage: "240M contacts & 30M companies"
      agentsdr: { v: "partial", text: "No database of its own, but Apollo is one of its enrichment providers, used with your Apollo key" },
      them: { v: "yes", text: "A database of 240M contacts and 30M companies per its site" },
    },
    {
      feature: "Enrichment",
      // https://docs.apollo.io/reference/people-enrichment (people match endpoint, waterfall options)
      agentsdr: { v: "yes", text: "15 Apollo actions in tables, plus 14 other providers, AI and HTTP columns" },
      them: { v: "yes", text: "Enrichment in the product and through its API, including waterfall enrichment" },
    },
    {
      feature: "Email sequences",
      // https://www.apollo.io homepage: email sequences; free plan limited to Gmail connections
      agentsdr: { v: "partial", text: "Multi-step sequences from Google Workspace mailboxes, with per-mailbox limits" },
      them: { v: "yes", text: "Email sequences. Its free plan connects Gmail only" },
    },
    {
      feature: "Calling",
      // https://www.apollo.io homepage: "Parallel Dialer"
      agentsdr: { v: "partial", text: "WhatsApp calls placed from the app, recorded and transcribed. No phone dialer" },
      them: { v: "yes", text: "A Parallel Dialer" },
    },
    {
      feature: "LinkedIn automation",
      // not verified on apollo.io
      agentsdr: MULTI_LINKEDIN,
      them: { v: "unknown", text: "Not compared" },
    },
    {
      feature: "WhatsApp",
      // not verified on apollo.io
      agentsdr: { v: "yes", text: "Message campaigns and recorded calls through Unipile" },
      them: { v: "unknown", text: "Not compared" },
    },
    {
      feature: "AI",
      // https://www.apollo.io homepage: AI agents that "research, build lists, write outreach, follow up, and book meetings"
      agentsdr: { v: "yes", text: "AI columns and a reply-drafting CRM on your own OpenRouter key" },
      them: { v: "yes", text: "AI agents for research, list building, outreach and follow-up" },
    },
    {
      feature: "Buying signals",
      // https://www.apollo.io homepage: intent, job changes, website visits
      agentsdr: { v: "partial", text: "Only what a provider returns, such as Lusha's job and company changes" },
      them: { v: "yes", text: "Intent, job change and website visit signals" },
    },
  ],
  angles: [
    {
      eyebrow: "Apollo inside AgentSDR",
      title: "Use Apollo's data without living in Apollo",
      body: "Connect your Apollo API key once, then add enrichment columns in a table: find a work email, enrich a person or company, find people at a company by job title. Results become columns you can send to.",
      bullets: ["15 Apollo actions, with credits spent on your own Apollo account", "Test on ten rows before running a table", "Rows with a missing required input are skipped and cost nothing"],
      scene: { channel: "email", index: 0, label: "Enriched columns filling an email's merge fields. An illustration with sample data.", accent: AGENT_ACCENT.data },
    },
    {
      eyebrow: "The workflow you own",
      title: "Sequences and replies on infrastructure you run",
      body: "Campaigns send from your mailboxes, LinkedIn accounts and WhatsApp numbers inside limits you set. Replies are classified and drafted in one inbox, and every record lives in your database.",
      bullets: ["One lead record per person across channels", "Do Not Contact respected everywhere", "Sending rules per organization, not hard-coded"],
      scene: { channel: "email", index: 2, label: "Leads from two campaigns assigned across three mailboxes. An illustration with sample data.", accent: AGENT_ACCENT.email },
    },
  ],
  better: [
    { title: "You need the data itself", body: "Apollo's database of contacts and companies is its core product. AgentSDR has no database, so without a provider you start from your own lists." },
    { title: "Your reps live on the phone", body: "Apollo offers a Parallel Dialer. AgentSDR places WhatsApp calls only." },
    { title: "You act on buying signals", body: "Apollo surfaces intent, job changes and website visits as signals inside the product." },
    { title: "You want an all-in-one hosted tool", body: "Apollo is one hosted login for data and engagement. AgentSDR needs a deployment and your own accounts for each service." },
  ],
  switchReasons: [
    { title: "Pay for data, not for seats", body: "Keep an Apollo account for the data, and drop paying per seat for the workflow around it." },
    { title: "Three channels, not one", body: "Add LinkedIn and WhatsApp campaigns to your email, with a shared inbox and AI-drafted replies." },
    { title: "No lock-in on the workflow", body: "Your leads and conversations sit in your database. Swap Apollo for Hunter or Lusha in a column without redoing your sequences." },
    { title: "Audit and extend it", body: "The code is AGPL-3.0, so you can inspect how data is stored and sent." },
  ],
  steps: [
    { title: "Create an Apollo API key", body: "Generate it in Apollo, then add it as an account in AgentSDR. The key is verified with a live call and stored encrypted." },
    { title: "Import or search", body: "Bring a CSV into a table, or paste rows. Add an Apollo enrichment column to find emails and company data." },
    { title: "Create the campaign", body: "Select enriched rows, choose email or LinkedIn and map the columns." },
    { title: "Send and review", body: "Launch from your own accounts and work every reply in Action required." },
  ],
  faq: [
    { q: "Is there an open-source alternative to Apollo?", a: "AgentSDR is open source under AGPL-3.0 and replaces the outreach and CRM side. It does not replace Apollo's database, so many teams connect Apollo as an enrichment provider." },
    { q: "Can AgentSDR use Apollo data?", a: "Yes. Add your Apollo API key as a provider account and use its 15 actions in enrichment columns, such as Find work email, Enrich person and Find people at company by job title." },
    { q: "Who pays for Apollo credits when I use it in AgentSDR?", a: "You do, on your own Apollo account. AgentSDR does not convert provider credits to money or show a cost per run, so watch usage in Apollo's dashboard and test on ten rows first." },
    { q: "Does AgentSDR have a contact database?", a: "No. It stores the people you import or enrich. For discovery you need a provider such as Apollo, or a list of your own." },
    { q: "Can AgentSDR add contacts to an Apollo sequence?", a: "Yes, as an enrichment action: Add contact to sequence is one of the 15 Apollo actions, alongside Find or create contact and Update contact." },
    { q: "How do I move from Apollo's engagement tools?", a: "Export your contacts as CSV, import them into a table or campaign, connect your mailboxes, and rebuild sequences. Suppress anyone who unsubscribed in Apollo." },
  ],
  related: ["/product/tables", "/product/lead-database", "/compare/clay", "/product/email", "/open-source", "/compare/instantly"],
  cta: { title: "Bring Apollo's data, own the workflow", lede: "Connect your Apollo key, enrich in tables and send from accounts you own." },
};

export const COMPETITORS: readonly Competitor[] = [clay, lemlist, heyreach, instantly, apollo];

export function getCompetitor(slug: Competitor["slug"]): Competitor {
  const c = COMPETITORS.find((x) => x.slug === slug);
  if (!c) throw new Error(`Unknown competitor: ${slug}`);
  return c;
}

export const DISCLAIMER_MONTH = "October 2026";

export const disclaimerFor = (name: string) => `${name} is a trademark of its owner. Comparison based on publicly available information as of ${DISCLAIMER_MONTH}.`;

// ---------------------------------------------------------------- the hub's matrix

/** Compact cells for the at-a-glance matrix: one column per tool, in COMPETITORS order. */
export const MATRIX_COLUMNS = ["AgentSDR", ...COMPETITORS.map((c) => c.name)] as const;

export const MATRIX: ReadonlyArray<{ feature: string; cells: Cell[] }> = [
  {
    feature: "Open source and self-hostable",
    // Competitors: hosted subscription products per their pricing pages
    cells: [
      { v: "yes", text: "AGPL-3.0, self-hosted" },
      ...COMPETITORS.map(() => ({ v: "info" as const, text: "Hosted service" })),
    ],
  },
  {
    feature: "Seats and pricing model",
    // clay.com/pricing, lemlist.com/pricing, heyreach.io/pricing, instantly.ai/pricing + /crm, apollo.io/pricing
    cells: [
      { v: "info", text: "No seat fees from AgentSDR" },
      { v: "info", text: "Plans plus credits, unlimited seats" },
      { v: "info", text: "Tiered plans, credits as add-on" },
      { v: "info", text: "Per sender, tiered" },
      { v: "info", text: "Plans plus credits, unlimited CRM seats" },
      { v: "info", text: "Per seat, pooled credits" },
    ],
  },
  {
    feature: "Built-in contact data",
    cells: [
      { v: "no", text: "None, bring providers" },
      { v: "partial", text: "Provider marketplace" },
      { v: "yes", text: "650M+ contacts" },
      { v: "unknown", text: "Not compared" },
      { v: "yes", text: "450M+ contacts" },
      { v: "yes", text: "240M contacts" },
    ],
  },
  {
    feature: "Enrichment tables and AI columns",
    cells: [
      { v: "yes", text: "Tables, 15 providers, AI" },
      { v: "yes", text: "Core product" },
      { v: "partial", text: "Enrichment credits and agents" },
      { v: "unknown", text: "Not compared" },
      { v: "partial", text: "Enrichment and AI agents" },
      { v: "partial", text: "Enrichment and AI agents" },
    ],
  },
  {
    feature: "Email from your own mailboxes",
    cells: [
      { v: "partial", text: "Google Workspace only" },
      { v: "partial", text: "Email-only sequencer" },
      { v: "yes", text: "With warm-up" },
      { v: "partial", text: "Via integrations" },
      { v: "yes", text: "Unlimited accounts" },
      { v: "yes", text: "Email sequences" },
    ],
  },
  {
    feature: "LinkedIn automation",
    cells: [
      { v: "yes", text: "Several accounts" },
      { v: "no", text: "Sequencer is email only" },
      { v: "yes", text: "Multichannel plan" },
      { v: "yes", text: "Core product" },
      { v: "unknown", text: "Not compared" },
      { v: "unknown", text: "Not compared" },
    ],
  },
  {
    feature: "WhatsApp",
    cells: [
      { v: "yes", text: "Messages and calls" },
      { v: "no", text: "Sequencer is email only" },
      { v: "partial", text: "Add-on" },
      { v: "unknown", text: "Not compared" },
      { v: "unknown", text: "Not compared" },
      { v: "unknown", text: "Not compared" },
    ],
  },
  {
    feature: "Unified inbox",
    cells: [
      { v: "yes", text: "All three channels" },
      { v: "partial", text: "Email replies" },
      { v: "yes", text: "Across channels" },
      { v: "partial", text: "LinkedIn messages" },
      { v: "yes", text: "Master inbox" },
      { v: "unknown", text: "Not compared" },
    ],
  },
  {
    feature: "AI classifies and drafts replies",
    cells: [
      { v: "yes", text: "With approval" },
      { v: "unknown", text: "Not compared" },
      { v: "unknown", text: "Not compared" },
      { v: "unknown", text: "Not compared" },
      { v: "yes", text: "AI Reply Agent" },
      { v: "unknown", text: "Not compared" },
    ],
  },
  {
    feature: "Email warm-up",
    cells: [
      { v: "no", text: "Not built in" },
      { v: "yes", text: "In its sequencer docs" },
      { v: "yes", text: "lemwarm" },
      { v: "unknown", text: "Not compared" },
      { v: "yes", text: "Included" },
      { v: "unknown", text: "Not compared" },
    ],
  },
];
