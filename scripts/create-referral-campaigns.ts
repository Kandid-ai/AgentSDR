/**
 * Creates the standing "Referral" campaigns, one email and one LinkedIn, that
 * a referral's "Start outreach" enrolls the referred person into (the
 * referral card pre-selects a campaign whose name says "referral";
 * src/lib/crm/referrals.ts). Both are Urgent priority, so every mailbox and
 * LinkedIn account works a referral before any other campaign, and email
 * starts the same day (src/lib/campaigns/priority.ts).
 *
 * They are created as drafts (email) / paused (LinkedIn): read the copy, edit
 * it if you like, then press Launch on each campaign's page. Until then the
 * referral card says the campaign is not running.
 *
 * The copy uses the referral merge fields with fallbacks, so it reads right
 * when the referrer asked not to be named: {{referrerFirstName|A colleague}},
 * {{referrerBrand|your team}} (src/lib/crm/referralRules.ts).
 *
 * Run: bun run --conditions=react-server scripts/create-referral-campaigns.ts --org <id> [--apply]
 * Without --apply it prints what it would do. Re-runnable: a campaign that
 * already exists by name keeps its copy, status and senders; only a priority
 * other than Urgent is raised.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { outreachCampaigns, type SequenceStep } from "../src/lib/outreach/schema";
import { campaigns as linkedinCampaigns } from "../src/lib/linkedin/schema";
import { linkedinSequenceError } from "../src/lib/linkedin/campaignSequence";
import { MAX_INVITATION_MESSAGE_LENGTH } from "../src/lib/linkedin/invitationMessage";
import { fillTemplate } from "../src/lib/outreach/render";
import { inOrg, runInOrganization } from "../src/lib/tenancy/scope";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const orgIndex = args.indexOf("--org");
const organizationId = orgIndex >= 0 ? args[orgIndex + 1] : undefined;
if (!organizationId) {
  console.error("Usage: --org <organization id> [--apply]");
  process.exit(1);
}

const NAME = "Referral";

const EMAIL_SEQUENCE: SequenceStep[] = [
  {
    stepNumber: 1,
    waitDays: 0,
    subject: "{{referrerFirstName|Your colleague}} suggested I reach out",
    body: [
      "Hi {{firstName|there}},",
      "",
      "{{referrerFirstName|A colleague of yours}} mentioned you're the right person to talk to about the ads and product pages at {{referrerBrand|your company}}.",
      "",
      "Quick context: we give each Meta ad its own version of the product page, leading with what that ad promised. Same product, same link, your ads untouched. A few minutes to set up, no dev needed. Supply6 and d'you already run this.",
      "",
      "Worth a 2 min before/after video?",
      "",
      "%signature%",
    ].join("\n"),
  },
  {
    stepNumber: 2,
    waitDays: 2,
    subject: "",
    body: [
      "{{firstName|Hi}} - here's the 2 min walkthrough: https://youtu.be/U_1fIKtMgdc",
      "",
      "One ad, the page it used to land on, and the page rebuilt to match it.",
      "",
      "Is that something your team is already looking at for {{referrerBrand|the brand}}?",
      "",
      "%signature%",
    ].join("\n"),
  },
  {
    stepNumber: 3,
    waitDays: 3,
    subject: "",
    body: [
      "{{firstName|Hi}} - last note from me.",
      "",
      "If this sits with someone else on your team, mind pointing me their way? And if the timing is off, no problem at all.",
      "",
      "%signature%",
    ].join("\n"),
  },
];

const LINKEDIN_SEQUENCE = {
  invitationMessage:
    "Hi {{firstName|there}}, {{referrerFirstName|a colleague of yours}} suggested I connect with you about the ads and product pages at {{referrerBrand|your company}}. Would be great to connect.",
  acceptanceMessage: [
    "Thanks for connecting, {{firstName|there}}.",
    "",
    "Quick context on why {{referrerFirstName|your colleague}} pointed me to you: we give each Meta ad its own version of the product page, leading with what that ad promised. Same product, same link, your ads untouched. Supply6 and d'you already run this.",
    "",
    "Worth a 2 min before/after video?",
  ].join("\n"),
  followUp1Message: [
    "{{firstName|Hi}}, here's that 2 min walkthrough: https://youtu.be/U_1fIKtMgdc",
    "",
    "One ad, the page it used to land on, and the page rebuilt to match it. Is that something your team is already looking at for {{referrerBrand|the brand}}?",
  ].join("\n"),
  followUp2Message:
    "Last one from me, {{firstName|there}}. If this sits with someone else on your team, mind pointing me their way? And if the timing is off, totally fine.",
  followUp3Message: "",
};

function checkCopy() {
  // The longest a note can render: long names and a long brand, and the fallbacks.
  const long = { firstName: "Bartholomew", referrerFirstName: "Alexandrina", referrerBrand: "The Very Long Brand Name Company" };
  for (const variables of [long, {}]) {
    const note = fillTemplate(LINKEDIN_SEQUENCE.invitationMessage, variables);
    if (note.length > MAX_INVITATION_MESSAGE_LENGTH) throw new Error(`Invitation note renders to ${note.length} characters (max ${MAX_INVITATION_MESSAGE_LENGTH})`);
  }
  const error = linkedinSequenceError(LINKEDIN_SEQUENCE);
  if (error) throw new Error(error);
  if (!EMAIL_SEQUENCE[0].subject.trim() || EMAIL_SEQUENCE.some((step) => !step.body.trim())) throw new Error("Email sequence is incomplete");
}

async function run() {
  checkCopy();
  const [email] = await db.select({ id: outreachCampaigns.id, status: outreachCampaigns.status, priority: outreachCampaigns.priority })
    .from(outreachCampaigns)
    .where(and(inOrg(outreachCampaigns), sql`lower(${outreachCampaigns.name}) = lower(${NAME})`))
    .limit(1);
  if (email) {
    console.log(`Email "${NAME}" exists (${email.status}, ${email.priority}).${email.priority === "urgent" ? "" : " Raising it to Urgent."}`);
    if (apply && email.priority !== "urgent") {
      await db.update(outreachCampaigns).set({ priority: "urgent", updatedAt: new Date() }).where(and(inOrg(outreachCampaigns), eq(outreachCampaigns.id, email.id)));
    }
  } else {
    console.log(`Email "${NAME}": creating as a draft, Urgent, all connected mailboxes, ${EMAIL_SEQUENCE.length} steps.`);
    if (apply) {
      const [row] = await db.insert(outreachCampaigns).values({
        organizationId: organizationId!,
        name: NAME,
        status: "draft",
        priority: "urgent",
        sequence: EMAIL_SEQUENCE,
        mailboxIds: null,
      }).returning({ id: outreachCampaigns.id });
      console.log(`  created ${row.id}`);
    }
  }

  const [linkedin] = await db.select({ id: linkedinCampaigns.id, status: linkedinCampaigns.status, priority: linkedinCampaigns.priority })
    .from(linkedinCampaigns)
    .where(and(inOrg(linkedinCampaigns), sql`lower(${linkedinCampaigns.name}) = lower(${NAME})`))
    .limit(1);
  if (linkedin) {
    console.log(`LinkedIn "${NAME}" exists (${linkedin.status}, ${linkedin.priority}).${linkedin.priority === "urgent" ? "" : " Raising it to Urgent."}`);
    if (apply && linkedin.priority !== "urgent") {
      await db.update(linkedinCampaigns).set({ priority: "urgent" }).where(and(inOrg(linkedinCampaigns), eq(linkedinCampaigns.id, linkedin.id)));
    }
  } else {
    console.log(`LinkedIn "${NAME}": creating paused, Urgent, every connected account may send, note + 3 messages.`);
    if (apply) {
      const [row] = await db.insert(linkedinCampaigns).values({
        organizationId: organizationId!,
        name: NAME,
        description: "People a lead pointed us to. Started from a referral in the CRM.",
        status: "PAUSED",
        type: "REGULAR",
        priority: "urgent",
        invitationMessage: LINKEDIN_SEQUENCE.invitationMessage,
        acceptanceMessage: LINKEDIN_SEQUENCE.acceptanceMessage,
        followUp1Message: LINKEDIN_SEQUENCE.followUp1Message,
        followUp2Message: LINKEDIN_SEQUENCE.followUp2Message,
        followUp3Message: null,
        updatedAt: new Date(),
      }).returning({ id: linkedinCampaigns.id });
      console.log(`  created ${row.id}`);
    }
  }
}

console.log(apply ? "APPLY" : "DRY RUN (add --apply to write)");
await runInOrganization(organizationId, run);
process.exit(0);
