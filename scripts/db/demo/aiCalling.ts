/**
 * Northwind's AI calling: two cloud calling numbers (a US and a UK WhatsApp
 * number, each with its station WhatsApp account), an AI campaign that has
 * been running for about three weeks, and a draft one ready to launch.
 *
 * The running campaign's leads stand everywhere a lead can: queued, being
 * reached, a call-back scheduled, a yes waiting for the booking, meetings
 * booked (one after the lead rang the number back), handed to the team, not
 * interested, unreached, replied on WhatsApp, stopped and failed. Each got
 * there through the steps the engine would have taken (step runs), with the
 * calls it placed (recorded, transcribed, the agent's outcome) and the
 * WhatsApp messages its numbers sent (station message jobs), so the lead
 * drawer, the stats and Analytics agree.
 *
 * Its leads are the people no other channel module tells a story about
 * (`ctx.pools.unassigned`); they get phone numbers in the ranges reserved
 * for fiction. What the CRM holds for them goes through the application's
 * own functions (setLeadStage, syncCallFollowUp, the WhatsApp CRM bridge),
 * then is put at the time it happened. Nothing here calls out.
 *
 * Runs after whatsapp.ts and before crm.ts: the lead who replied joins
 * `ctx.replies`, and crm.ts places the CRM events written here at their calls.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { WeeklyHours } from "@/lib/channels/rules";
import { people } from "@/lib/leads/schema";
import {
  callCampaignContacts,
  callCampaignStations,
  callCampaignStepRuns,
  callCampaigns,
  callSessions,
  callingStations,
  stationMessageJobs,
} from "@/lib/calls/schema";
import type { AgentOutcome, AgentOutcomeKind, CallStatus, CallTranscript, ContactCallStatus, LeadStageCategory } from "@/lib/calls/contract";
import type { AiCallResult, AiCampaignStep, AiContactStatus } from "@/lib/calls/aiCampaigns/contract";
import { composeAgentBrief } from "@/lib/calls/aiCampaigns/brief";
import { BOOKING_CODE_ALPHABET, BOOKING_LINK_KEY, bookingLinkFor } from "@/lib/calls/aiCampaigns/engineRules";
import { setLeadStage } from "@/lib/calls/leadStage";
import { syncCallFollowUpSafely } from "@/lib/calls/crmFollowUp";
import { crmKnowledgeDocuments, crmSettings, crmSubcategories } from "@/lib/crm/schema";
import { ensureStationWhatsappAccount } from "@/lib/whatsapp/accounts";
import { forwardWhatsappInboundToCrm } from "@/lib/whatsapp/crmBridge";
import { whatsappAccounts, whatsappChats, whatsappMessages } from "@/lib/whatsapp/schema";
import { stationAccountRef, stationChatId } from "@/lib/whatsapp/stationParse";
import { currentOrganizationId, inOrg } from "@/lib/tenancy/scope";
import type { TeamKey } from "./content";
import { DAY, HOUR, MINUTE, count, createRng, type DemoContext, type DemoPerson } from "./context";

/**
 * The organization's Cal.com page (CRM `{{booking_link}}` and both
 * campaigns). Not cal.com/northwind: that page belongs to someone real.
 */
export const DEMO_BOOKING_URL = "https://cal.com/northwind-demo/intro";

/** The call worker that keeps the numbers' WhatsApp Web open. */
const WORKER = "call-worker-1";
const TRANSCRIBER = "google/gemini-2.5-flash";

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

type StationKey = "us" | "uk";

const STATIONS: Record<
  StationKey,
  { name: string; phone: string; hours: WeeklyHours; callsPerDay: number | null; createdDays: number; profileVersion: number; profileMb: number; open: [number, number]; window: [number, number] }
> = {
  us: {
    name: "Northwind US",
    phone: "+12025550160",
    hours: { timezone: "America/New_York", days: [1, 2, 3, 4, 5], start: "09:30", end: "17:30" },
    callsPerDay: 25,
    createdDays: 27,
    profileVersion: 31,
    profileMb: 48.6,
    // Calling hours in UTC (EST), and the part of them history is placed in.
    open: [14.5, 22.5],
    window: [14.75, 21.75],
  },
  uk: {
    name: "Northwind UK",
    phone: "+447700900260",
    hours: { timezone: "Europe/London", days: [1, 2, 3, 4, 5], start: "09:00", end: "17:30" },
    callsPerDay: null,
    createdDays: 24,
    profileVersion: 22,
    profileMb: 44.1,
    open: [9, 17.5],
    window: [9.25, 16.75],
  },
};

/** Leads at European companies are called from the UK number. */
const EUROPE = new Set(["UK", "IE", "DE", "NL", "FR", "SE", "ES"]);

// ---------------------------------------------------------------------------
// The campaigns
// ---------------------------------------------------------------------------

const AGENT_A = { name: "Maya", voice: "Aoede" };
const AGENT_B = { name: "Oliver", voice: "Charon" };

const INSTRUCTIONS_A = [
  "You are calling heads of sales, sales development and RevOps at B2B companies that run outbound. Northwind Signal pulls lead and company data together, scores accounts against the customer's ideal profile and tells reps who to contact this week and why. It works next to the sequencer they already use and syncs with HubSpot and Salesforce.",
  "Find out three things, in a natural order: how the team decides which accounts to work each week, how many SDRs and AEs do outbound, and which CRM and sequencer they use. Do not run through them like a survey; one good question and a follow-up is enough.",
  "If it sounds relevant, offer a 30-minute intro with an account executive (Jordan Blake or Priya Raman) and send the booking link. If they ask about price: plans start at $49 per seat a month, and the team goes through the details on the intro. Never promise discounts, integrations or results beyond what the knowledge says. Brightloop (140 people, six SDRs) went from 38 to 81 first meetings a month in a quarter: use it once, and only if they ask for proof.",
  "If they are busy, ask when to call back and keep to that time. If they say no, thank them and end the call.",
].join("\n\n");

const STEPS_A: AiCampaignStep[] = [
  { id: "call-1", kind: "call", delayHours: 0, instructions: "First call: say who you are and that you are an AI assistant, then ask how they choose which accounts the team works each week." },
  {
    id: "message-1",
    kind: "message",
    delayHours: 1,
    body: "Hi {{firstName}}, {{agentName}} from Northwind here. I just tried calling: we help sales teams like {{company}}'s decide which accounts are worth a call each week. Worth a 2-minute chat? Reply with a good time and I'll call you then.",
  },
  { id: "call-2", kind: "call", delayHours: 48, instructions: "Second try: mention in one line that you called two days ago and sent a WhatsApp. Get to the question quickly." },
  { id: "call-3", kind: "call", delayHours: 72, instructions: "Last try: keep it under a minute. If it isn't a fit, thank them and let them go." },
  {
    id: "message-2",
    kind: "message",
    delayHours: 4,
    body: "Last note from me, {{firstName}}: if deciding who to call each week ever eats your team's time, here's a 2-minute overview: northwind.example/signal-overview. All the best, {{agentName}} at Northwind",
  },
];

const CHASE_A: AiCampaignStep[] = [
  {
    id: "chase-message-1",
    kind: "message",
    delayHours: 24,
    body: "Hi {{firstName}}, {{agentName}} from Northwind again. Here's the link for the 30-minute intro whenever you have a moment: {{bookingLink}}",
  },
  {
    id: "chase-call-1",
    kind: "call",
    delayHours: 48,
    instructions: "They agreed to an intro but have not booked it. Ask kindly whether the link worked; offer to have Jordan call them instead.",
  },
];

const BOOKING_MESSAGE_A = "Thanks for the chat, {{firstName}}! Here's the link to pick a time for the 30-minute intro with our team: {{bookingLink}}. {{agentName}}, Northwind";

const INSTRUCTIONS_B = [
  "You are calling people in the UK and Europe who signed up for Northwind's November webinar, \"Outbound that books meetings in 2027\". Some joined live, some only registered.",
  "Ask what made them sign up and what they took away (or, if they missed it, offer the replay). If prioritising accounts is a live problem for their team, offer either a 30-minute intro with Priya Raman or a call from the team, whichever they prefer.",
  "Keep it light: they came to us. No pricing on this call.",
].join("\n\n");

const STEPS_B: AiCampaignStep[] = [
  { id: "call-1", kind: "call", delayHours: 0, instructions: "Thank them for signing up for the webinar and ask what they hoped to get out of it." },
  {
    id: "message-1",
    kind: "message",
    delayHours: 2,
    body: "Hi {{firstName}}, {{agentName}} from Northwind, thanks for signing up for our webinar. I tried calling to see if the replay would be useful: northwind.example/webinar-replay",
  },
  { id: "call-2", kind: "call", delayHours: 72, instructions: "Second try: mention the replay link you sent, and ask if a short call with the team would help." },
];

const CHASE_B: AiCampaignStep[] = [
  {
    id: "chase-message-1",
    kind: "message",
    delayHours: 24,
    body: "Hi {{firstName}}, here's the link again to pick a time with Priya: {{bookingLink}}",
  },
];

// ---------------------------------------------------------------------------
// What the calls sound like. {lead} {company} {agent}.
// ---------------------------------------------------------------------------

type Spk = "rep" | "lead";
type Script = {
  outcome: AgentOutcomeKind;
  /** The agent's own one-sentence summary (record_outcome). */
  outcomeSummary: string;
  /** The time agreed, in the person's words. */
  when?: string;
  /** The transcript's summary. */
  summary: string;
  lines: (readonly [Spk, string])[];
};
const A = (text: string) => ["rep", text] as const;
const L = (text: string) => ["lead", text] as const;

const SCRIPTS = {
  meetingFirst: {
    outcome: "meeting_booked",
    outcomeSummary: "Research eats Mondays for their SDRs; agreed to a 30-minute intro, booking link on WhatsApp.",
    when: "next week",
    summary: "{lead} said {company}'s SDRs pick accounts from spreadsheets and spend much of Monday on research. Agreed to a 30-minute intro with the Northwind team; the booking link goes out on WhatsApp.",
    lines: [
      A("Hi, is this {lead}?"),
      L("Yes, speaking."),
      A("Hi {lead}, this is {agent}. I'm an AI assistant calling for Northwind, so you know up front. Do you have a minute?"),
      L("Uh, sure, a quick one."),
      A("Thanks. Northwind Signal helps sales teams decide which accounts are worth a call each week, and why. How does your team at {company} pick who to go after today?"),
      L("Honestly, mostly spreadsheets and gut feel. The SDRs lose half of Monday to research."),
      A("That's the thing we hear most. Our customers cut research per account from about twenty-five minutes to under five. Would a thirty-minute intro with someone from our team be worth it?"),
      L("Yeah, I'd look at that. Not this week though."),
      A("Of course. I'll send you a booking link on WhatsApp right after this call, so you can pick any time that suits you."),
      L("Perfect, do that."),
      A("Done. Thanks {lead}, have a good rest of the day."),
    ],
  },
  meetingSecond: {
    outcome: "meeting_booked",
    outcomeSummary: "Eight SDRs, a sequencer and HubSpot; agreed to an intro with Jordan.",
    when: "this week",
    summary: "{lead} runs eight SDRs and two AEs at {company} with a sequencer and HubSpot. Open to seeing Signal on their own accounts; agreed to an intro with Jordan, booking link sent on WhatsApp.",
    lines: [
      A("Hi {lead}, this is {agent}, an AI assistant calling for Northwind. I tried you a couple of days ago. Is now any better?"),
      L("I've got five minutes. What's it about?"),
      A("We help sales teams spend their time on the accounts most likely to buy this quarter. Out of interest, how big is the outbound team at {company}?"),
      L("Eight SDRs and two AEs. And we already have a sequencer, before you ask."),
      A("Most of our customers keep theirs. Signal sits in front of it and decides who goes into it, with the reason. Would it be worth a short intro to see it on your own accounts?"),
      L("If it plugs into HubSpot, maybe. Who would I be talking to?"),
      A("Jordan Blake, one of our account executives. The HubSpot sync is part of the Team plan. I'll WhatsApp you a link to pick a time with Jordan."),
      L("Okay, send it over."),
      A("Sending it now. Thanks for your time, {lead}."),
    ],
  },
  meetingAfterMessage: {
    outcome: "meeting_booked",
    outcomeSummary: "Rebuilding outbound for Q1, prioritisation is the gap; wants a walkthrough Thursday or Friday.",
    when: "Thursday or Friday",
    summary: "{lead} is rebuilding {company}'s outbound for Q1 and sees account prioritisation as the gap. Agreed to a 30-minute walkthrough, ideally Thursday or Friday; booking link sent.",
    lines: [
      A("Hello, is that {lead}?"),
      L("It is."),
      A("Hi {lead}, I'm {agent}, an AI assistant calling on behalf of Northwind. I sent you a WhatsApp earlier this week. Is it a bad moment?"),
      L("No, go ahead. I saw the message, actually."),
      A("Great. In one line: Northwind Signal scores your accounts against your ideal customer and tells reps who to contact this week and why. Is prioritising accounts something {company} is working on?"),
      L("It is. We're rebuilding outbound for Q1 and that's exactly the gap."),
      A("Then the best next step is a thirty-minute walkthrough with our team. Shall I send you a link to book it?"),
      L("Yes please. Thursday or Friday would be ideal."),
      A("I'll send it now; you'll see Thursday and Friday slots there. Thanks {lead}!"),
    ],
  },
  inbound: {
    outcome: "meeting_booked",
    outcomeSummary: "Called back; four new SDRs need direction. Agreed to a 30-minute intro.",
    when: "next week",
    summary: "{lead} returned a missed call. {company} just hired four SDRs who need direction on which accounts to work. Agreed to a 30-minute intro; booking link sent on WhatsApp.",
    lines: [
      L("Hi, I had a missed call from this number?"),
      A("Hi, thanks for calling back! This is {agent}, an AI assistant for Northwind. Am I speaking with {lead}?"),
      L("Yes. What was it about?"),
      A("We got in touch because Northwind Signal helps sales teams like yours at {company} decide which accounts to work each week. Is that on your radar at all?"),
      L("We just hired four SDRs, so actually yes. They don't know where to start."),
      A("That's a good moment for it: new reps get a ranked list with the reason for each account. Would you like to see it in a thirty-minute intro?"),
      L("Sure. Send me something."),
      A("I'll WhatsApp you a booking link right after this. Thanks for calling back, {lead}."),
    ],
  },
  callbackTomorrow: {
    outcome: "call_back",
    outcomeSummary: "Heading into board prep; call back tomorrow around 4pm.",
    when: "tomorrow around 4pm",
    summary: "{lead} was heading into a meeting and asked to be called back tomorrow around 4pm.",
    lines: [
      A("Hi {lead}, this is {agent}, an AI assistant calling for Northwind. Have I caught you at an okay time?"),
      L("Not really, I'm about to walk into board prep. Can you call me back?"),
      A("Of course. When suits you?"),
      L("Tomorrow afternoon. Around four."),
      A("Tomorrow around four it is. I'll keep it short then. Good luck with the prep!"),
      L("Thanks, bye."),
    ],
  },
  callbackNextWeek: {
    outcome: "call_back",
    outcomeSummary: "At a conference all week; the topic is relevant. Call back next Tuesday morning.",
    when: "next Tuesday morning",
    summary: "{lead} was at a conference and the topic sounded relevant. Asked for a call back next Tuesday morning.",
    lines: [
      A("Hello {lead}, {agent} here, an AI assistant calling on behalf of Northwind. Is now a good time for two minutes?"),
      L("I'm at a conference all week, it's loud here. What's it regarding?"),
      A("Helping {company}'s sales team decide which accounts to prioritise each week. Happy to call another time."),
      L("That's actually relevant. Try me next Tuesday morning."),
      A("Next Tuesday morning, noted. Enjoy the conference."),
    ],
  },
  wantsTeam: {
    outcome: "human_callback",
    outcomeSummary: "Interested, but wants pricing and the HubSpot sync from a person; call Friday before 10.",
    when: "Friday morning, before 10",
    summary: "{lead} has a RevOps scoring model at {company} that has gone stale. Interested, but wants pricing and HubSpot sync details from a person; asked for a call from the team on Friday morning before 10.",
    lines: [
      A("Hi {lead}, I'm {agent}, an AI assistant calling for Northwind. Do you have a minute?"),
      L("A minute, yes."),
      A("Northwind Signal tells your reps which accounts to work this week and why. How do you choose accounts at {company} today?"),
      L("We have a RevOps scoring model, but it's stale. Look, I'm interested, but I'd want to talk numbers and the HubSpot sync with a person."),
      A("That makes sense. I can have someone from our team call you. When's a good time?"),
      L("Friday morning, before ten."),
      A("Friday morning before ten. Priya or Jordan from our team will call you then. Thanks, {lead}."),
    ],
  },
  otherVendor: {
    outcome: "not_interested",
    outcomeSummary: "Signed with another prioritisation platform last month; not looking.",
    summary: "{lead} said {company} signed with another account-prioritisation platform last month. Not looking; no follow-up.",
    lines: [
      A("Hi {lead}, {agent} here, an AI assistant calling for Northwind. Is now okay for a quick question?"),
      L("Quickly."),
      A("How does {company}'s team decide which accounts to prioritise each week?"),
      L("We signed with another platform last month for exactly that, so I'm not looking right now."),
      A("Understood, thanks for telling me. I won't follow up on this. Have a great day."),
    ],
  },
  budgetFreeze: {
    outcome: "not_interested",
    outcomeSummary: "Sales headcount and tooling frozen until next year's budget.",
    summary: "{lead} said {company} froze sales headcount and tooling until next year's budget. Not a priority now.",
    lines: [
      A("Hi {lead}, this is {agent}, an AI assistant for Northwind. I tried you earlier in the week. Is now better?"),
      L("Sure, what is it?"),
      A("We help sales teams decide which accounts to work each week. Is that a priority at {company} this quarter?"),
      L("Not this year. We've frozen sales headcount and tooling until the new budget."),
      A("Fair enough. Thanks for being straight with me, {lead}. All the best."),
    ],
  },
  doNotContact: {
    outcome: "do_not_contact",
    outcomeSummary: "Asked not to be called again.",
    summary: "{lead} asked not to be contacted again. Marked Do Not Contact.",
    lines: [
      A("Hi, is this {lead}? This is {agent}, an AI assistant calling on behalf of Northwind."),
      L("An AI? Please take my number off your list. Don't call again."),
      A("Of course. I've noted that, and nobody from Northwind will contact you again. Sorry for the interruption."),
    ],
  },
  wrongPerson: {
    outcome: "wrong_person",
    outcomeSummary: "The number is a shared support line, not the lead.",
    summary: "The number reaches a shared support line, not {lead}. Wrong person.",
    lines: [
      A("Hi, am I speaking with {lead}?"),
      L("No, you've got the wrong person. This is a shared support line."),
      A("My apologies. I'm {agent}, an AI assistant for Northwind; I'll make sure we don't call this number for {lead} again. Have a good day."),
    ],
  },
  silent: {
    outcome: "no_response",
    outcomeSummary: "Picked up, but nobody spoke.",
    summary: "The call was picked up but nobody spoke; the agent ended it after a few seconds.",
    lines: [
      A("Hello, is this {lead}?"),
      A("Hi, this is {agent}, an AI assistant calling for Northwind. Can you hear me?"),
      A("It seems to be a bad line. I'll try you another time. Bye for now."),
    ],
  },
} satisfies Record<string, Script>;
type ScriptKey = keyof typeof SCRIPTS;

function timeUtterances(lines: (readonly [Spk, string])[], offsetSeconds: number) {
  let t = offsetSeconds + 1;
  const utterances: CallTranscript["utterances"] = [];
  for (const [speaker, text] of lines) {
    utterances.push({ startSeconds: Math.round(t), speaker, text });
    const words = text.split(/\s+/).length;
    t += words / 2.4 + 1.1 + (words % 3) * 0.4;
  }
  return { utterances, talkSeconds: t - offsetSeconds };
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const preview = (body: string) => {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
};

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

type CallKind = "conversation" | "no_answer" | "busy" | "not_on_whatsapp" | "error";

type PlannedCall = {
  id: string;
  at: Date;
  endedAt: Date;
  status: CallStatus;
  error: string | null;
  talkMs: number | null;
  offsetMs: number | null;
  transcript: CallTranscript | null;
  outcome: AgentOutcome | null;
  direction: "outbound" | "inbound";
  brief: string;
  result: AiCallResult;
  busy: boolean;
};
type PlannedMsg = { id: string; at: Date; body: string; dir: "outbound" | "inbound"; key: string; jobId: string | null };
type PlannedRun = {
  stepKey: string;
  kind: "call" | "message";
  status: "done" | "failed";
  result: AiCallResult | null;
  callId: string | null;
  messageId: string | null;
  error: string | null;
  at: Date;
  finishedAt: Date;
};

type Lead = {
  id: string;
  campaign: "A" | "B";
  person: DemoPerson;
  station: StationKey;
  enrolledAt: Date;
  cursor: Date;
  calls: PlannedCall[];
  msgs: PlannedMsg[];
  runs: PlannedRun[];
  status: AiContactStatus;
  step: number;
  nextAt: Date | null;
  callbacks: number;
  note: string | null;
  followUpAt: Date | null;
  bookedAt: Date | null;
  meetingAt: Date | null;
  code: string | null;
  instructions: string | null;
  /** The CRM stage (subcategory key) a person would see after this. */
  crmStage: string | null;
  /** They wrote back on WhatsApp: crm.ts reads it as this. */
  reply: { at: Date; body: string } | null;
};

export async function seedAiCalling(shared: DemoContext): Promise<void> {
  // Its own random stream: what the other modules drew must not change this module's story.
  const ctx: DemoContext = { ...shared, rand: createRng(Number(process.env.DEMO_AI_CALLING_SEED) || 31) };
  const org = currentOrganizationId();
  const now = ctx.now;
  const rand = ctx.rand;
  const stationIds: Record<StationKey, string> = { us: randomUUID(), uk: randomUUID() };

  // --- time ----------------------------------------------------------------
  const latest = () => new Date(now.getTime() - rand.int(2, 6) * MINUTE);
  /** `days` before now, a weekday, inside the number's calling hours; never later than a few minutes ago. */
  const slot = (days: number, station: StationKey): Date => {
    const d = new Date(now.getTime() - days * DAY);
    const dow = d.getUTCDay();
    if (dow === 0) d.setUTCDate(d.getUTCDate() - 2);
    if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
    const [from, to] = STATIONS[station].window;
    d.setUTCHours(0, Math.round(from * 60 + rand.next() * (to - from) * 60), rand.int(0, 59), 0);
    return d.getTime() > now.getTime() - 10 * MINUTE ? new Date(now.getTime() - rand.int(15, 120) * MINUTE) : d;
  };
  const ago = (minMinutes: number, maxMinutes: number) => new Date(now.getTime() - rand.int(minMinutes, maxMinutes) * MINUTE);
  const plus = (d: Date, minMinutes: number, maxMinutes: number) => new Date(d.getTime() + rand.int(minMinutes, maxMinutes) * MINUTE + rand.int(0, 59) * 1000);
  /** A due time that has not come yet. */
  const future = (d: Date) => (d.getTime() > now.getTime() + 10 * MINUTE ? d : new Date(now.getTime() + rand.int(20, 90) * MINUTE));
  /** `days` from now (or ago, negative), a weekday, at `utcHour` (a meeting or an agreed time). */
  const dayAt = (days: number, utcHour: number, minute = 0): Date => {
    const d = new Date(now.getTime() + days * DAY);
    if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + (days >= 0 ? 2 : -1));
    if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + (days >= 0 ? 1 : -2));
    d.setUTCHours(utcHour, minute, 0, 0);
    return d;
  };
  /** The first `weekday` (0 = Sunday) strictly after `from`, at `utcHour`. */
  const nextWeekday = (from: Date, weekday: number, utcHour: number): Date => {
    const d = new Date(from);
    do d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() !== weekday);
    d.setUTCHours(utcHour, 0, 0, 0);
    return d;
  };
  /** Morning and afternoon in the number's zone, as UTC hours. */
  const morning = (station: StationKey) => (station === "us" ? 15 : 10);
  const afternoon = (station: StationKey) => (station === "us" ? 21 : 16);

  // --- who --------------------------------------------------------------------
  const pool = rand.shuffle(ctx.pools.unassigned);
  if (pool.length < 30) throw new Error(`AI calling needs 30 people outside the other channels; there are ${pool.length}`);
  let usPhone = 0;
  let ukPhone = 0;
  const leads: Lead[] = [];
  const newLead = (campaign: "A" | "B", person: DemoPerson, enrolledAt: Date, forceStation?: StationKey): Lead => {
    const station: StationKey = forceStation ?? (EUROPE.has(person.company.country) ? "uk" : "us");
    // Fiction-reserved numbers: 555-0100…0199 in the US, 07700 900xxx in the UK.
    person.phone = station === "uk" ? `+447700900${300 + ukPhone++}` : `+1303555${String(100 + usPhone++).padStart(4, "0")}`;
    const lead: Lead = {
      id: randomUUID(), campaign, person, station, enrolledAt, cursor: enrolledAt, calls: [], msgs: [], runs: [],
      status: "queued", step: 0, nextAt: null, callbacks: 0, note: null, followUpAt: null, bookedAt: null,
      meetingAt: null, code: null, instructions: null, crmStage: null, reply: null,
    };
    leads.push(lead);
    return lead;
  };

  const fill = (text: string, lead: Lead, agent: string) =>
    text.replaceAll("{lead}", lead.person.firstName).replaceAll("{company}", lead.person.company.name).replaceAll("{agent}", agent);
  const render = (body: string, lead: Lead, agent: string, link: string | null = null) =>
    body
      .replaceAll("{{firstName}}", lead.person.firstName)
      .replaceAll("{{company}}", lead.person.company.name)
      .replaceAll("{{agentName}}", agent)
      .replaceAll("{{bookingLink}}", link ?? "");

  const hourOf = (t: Date) => t.getUTCHours() + t.getUTCMinutes() / 60;
  const weekend = (t: Date) => t.getUTCDay() === 0 || t.getUTCDay() === 6;
  const inHours = (t: Date, station: StationKey) => {
    const [from, to] = STATIONS[station].open;
    return !weekend(t) && hourOf(t) >= from && hourOf(t) < to;
  };
  /** The number's next opening after `t` (a few minutes in). */
  const nextOpen = (t: Date, station: StationKey): Date => {
    const d = new Date(t);
    const [from] = STATIONS[station].open;
    if (hourOf(d) >= from) d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(0, Math.round(from * 60) + rand.int(3, 40), rand.int(0, 59), 0);
    while (weekend(d)) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  };
  /** The number's last closing before `t` (a little before it). */
  const prevClose = (t: Date, station: StationKey): Date => {
    const d = new Date(t);
    const [, to] = STATIONS[station].open;
    if (hourOf(d) < to) d.setUTCDate(d.getUTCDate() - 1);
    d.setUTCHours(0, Math.round(to * 60) - rand.int(10, 70), rand.int(0, 59), 0);
    while (weekend(d)) d.setUTCDate(d.getUTCDate() - 1);
    return d;
  };
  /**
   * Never before what already happened to the lead, never after now, and —
   * for what the engine did (`hours`) — inside the number's calling hours:
   * moved to the next opening, or, when that has not come yet, to the last
   * closing, if that is still after the lead's previous step.
   */
  const settle = (lead: Lead, at: Date, hours = true): Date => {
    let t = at.getTime();
    if (t < lead.cursor.getTime() + 3 * MINUTE) t = lead.cursor.getTime() + rand.int(3, 9) * MINUTE;
    let d = new Date(Math.min(t, latest().getTime()));
    if (hours && !inHours(d, lead.station)) {
      const next = nextOpen(d, lead.station);
      if (next.getTime() < now.getTime() - 3 * MINUTE) d = next;
      else {
        const prev = prevClose(d, lead.station);
        if (prev.getTime() > lead.cursor.getTime() + 3 * MINUTE) d = prev;
      }
    }
    return d;
  };

  const usedKeys = new Set<string>();
  const messageKey = (lead: Lead) => {
    let key: string;
    do key = `station:${stationIds[lead.station]}:3EB0${randomBytes(8).toString("hex").toUpperCase()}`;
    while (usedKeys.has(key));
    usedKeys.add(key);
    return key;
  };

  const stepOf = (id: string) => [...STEPS_A, ...CHASE_A].find((s) => s.id === id) ?? null;

  /** A call the engine placed (or, for "inbound", the lead placed); returns when it ended. */
  function call(lead: Lead, stepKey: string, when: Date, kind: CallKind, scriptKey?: ScriptKey, opts: { inbound?: boolean; whenAt?: Date } = {}): Date {
    const at = settle(lead, when, !opts.inbound);
    const id = randomUUID();
    const key = opts.inbound ? `inbound:${id}` : stepKey;
    const purpose = opts.inbound ? "inbound" : key.includes("chase:") ? "chase" : key.startsWith("callback:") ? "callback" : "reach";
    const stepId = key.replace(/^retry:/, "").replace(/^(reach|chase):/, "").replace(/:\d+$/, "");
    const step = stepOf(stepId);
    const brief = composeAgentBrief({
      campaignInstructions: INSTRUCTIONS_A,
      purpose,
      stepInstructions: step?.kind === "call" ? step.instructions : null,
      leadInstructions: lead.instructions,
    });
    const planned: PlannedCall = {
      id, at, endedAt: at, status: "no_recording", error: null, talkMs: null, offsetMs: null, transcript: null,
      outcome: null, direction: opts.inbound ? "inbound" : "outbound", brief, result: "no_answer", busy: kind === "busy",
    };
    if (kind === "conversation") {
      const script: Script = SCRIPTS[scriptKey ?? "meetingFirst"];
      const offsetSec = opts.inbound ? rand.int(1, 3) : rand.int(6, 18);
      const timed = timeUtterances(script.lines.map(([who, text]) => [who, fill(text, lead, AGENT_A.name)] as const), offsetSec);
      planned.talkMs = Math.round((timed.talkSeconds + rand.int(2, 6)) * 1000);
      planned.offsetMs = offsetSec * 1000;
      planned.endedAt = new Date(at.getTime() + planned.offsetMs + planned.talkMs);
      planned.status = "recorded";
      planned.transcript = { language: "en", summary: fill(script.summary, lead, AGENT_A.name), utterances: timed.utterances, model: TRANSCRIBER };
      planned.outcome = {
        outcome: script.outcome,
        summary: fill(script.outcomeSummary, lead, AGENT_A.name),
        when: script.when ?? null,
        whenAt: opts.whenAt ? opts.whenAt.toISOString() : null,
        recordedAt: new Date(planned.endedAt.getTime() - 2000).toISOString(),
      };
      planned.result = script.outcome === "no_response" ? "no_answer" : "conversation";
    } else if (kind === "not_on_whatsapp") {
      planned.status = "failed";
      planned.error = "This number isn't on WhatsApp";
      planned.endedAt = new Date(at.getTime() + rand.int(5, 9) * 1000);
      planned.result = "not_on_whatsapp";
    } else if (kind === "error") {
      planned.status = "failed";
      planned.error = "The call could not be placed: WhatsApp Web did not finish loading";
      planned.endedAt = new Date(at.getTime() + rand.int(40, 70) * 1000);
      planned.result = "error";
    } else {
      planned.endedAt = new Date(at.getTime() + (kind === "busy" ? rand.int(6, 12) : rand.int(32, 48)) * 1000);
    }
    lead.calls.push(planned);
    lead.runs.push({
      stepKey: key, kind: "call", status: planned.result === "error" ? "failed" : "done", result: planned.result,
      callId: id, messageId: null, error: planned.result === "error" || planned.result === "not_on_whatsapp" ? planned.error : null,
      at, finishedAt: new Date(planned.endedAt.getTime() + rand.int(20, 100) * 1000),
    });
    lead.cursor = planned.endedAt;
    return planned.endedAt;
  }

  /** A WhatsApp the engine sent from the lead's number; returns when it went out. */
  function message(lead: Lead, stepKey: string, when: Date, body: string): Date {
    const at = settle(lead, when);
    const id = randomUUID();
    lead.msgs.push({ id, at, body, dir: "outbound", key: messageKey(lead), jobId: randomUUID() });
    lead.runs.push({ stepKey, kind: "message", status: "done", result: null, callId: null, messageId: id, error: null, at: new Date(at.getTime() - rand.int(30, 90) * 1000), finishedAt: new Date(at.getTime() + rand.int(15, 60) * 1000) });
    lead.cursor = at;
    return at;
  }
  const step = (lead: Lead, id: string, when: Date) => message(lead, `reach:${id}`, when, render((STEPS_A.find((s) => s.id === id) as { body: string }).body, lead, AGENT_A.name));
  const chaseMessage = (lead: Lead, when: Date) => message(lead, "chase:chase-message-1", when, render((CHASE_A[0] as { body: string }).body, lead, AGENT_A.name, bookingLinkFor(DEMO_BOOKING_URL, lead.code!)));

  const codes = new Set<string>();
  /** Right after a yes: the booking link with the lead's own code. */
  function sendLink(lead: Lead, callEnd: Date): Date {
    let code: string;
    do code = Array.from({ length: 4 }, () => BOOKING_CODE_ALPHABET[Math.floor(rand.next() * BOOKING_CODE_ALPHABET.length)]).join("");
    while (codes.has(code));
    codes.add(code);
    lead.code = code;
    const link = bookingLinkFor(DEMO_BOOKING_URL, code)!;
    return message(lead, BOOKING_LINK_KEY, plus(callEnd, 1, 3), render(BOOKING_MESSAGE_A, lead, AGENT_A.name, link));
  }
  function booked(lead: Lead, bookedAt: Date, meetingAt: Date) {
    lead.status = "booked";
    lead.bookedAt = settle(lead, bookedAt, false);
    lead.meetingAt = meetingAt;
    lead.note = "Meeting booked";
    lead.followUpAt = new Date(Math.max(lead.bookedAt.getTime(), meetingAt.getTime() - DAY));
    lead.nextAt = null;
    lead.crmStage = meetingAt.getTime() < now.getTime() ? "meeting_done" : "meeting_booked";
  }

  // =========================================================================
  // Campaign A: the running one. Three waves (19, 9 and 0 days ago).
  // =========================================================================
  const launchedAt = slot(19, "us");
  const peopleA = pool.slice(0, 26);
  const peopleB = pool.slice(26, 30);
  const wave = (days: number) => new Date(slot(days, "us").getTime() - rand.int(30, 120) * MINUTE);

  const stories: ((lead: Lead) => void)[] = [
    // 0–2 queued: added this morning, first call soon.
    (l) => { l.nextAt = future(plus(now, 20, 80)); },
    (l) => { l.nextAt = future(plus(now, 30, 110)); },
    (l) => { l.nextAt = future(plus(now, 45, 150)); },
    // 3 reaching: two unanswered calls and the WhatsApp; the last call is due.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(3, l.station), "no_answer");
      step(l, "message-1", plus(c1, 58, 66));
      const c2 = call(l, "reach:call-2", slot(1, l.station), "no_answer");
      Object.assign(l, { status: "reaching", step: 3, nextAt: future(new Date(c2.getTime() + 72 * HOUR)) });
    },
    // 4 reaching: one unanswered call and the WhatsApp; call 2 in two days.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(1, l.station), "no_answer");
      const m1 = step(l, "message-1", plus(c1, 58, 66));
      Object.assign(l, { status: "reaching", step: 2, nextAt: future(new Date(m1.getTime() + 48 * HOUR)) });
    },
    // 5 reaching: busy this morning, WhatsApp an hour later.
    (l) => {
      const c1 = call(l, "reach:call-1", ago(150, 200), "busy");
      const m1 = step(l, "message-1", plus(c1, 58, 64));
      Object.assign(l, { status: "reaching", step: 2, nextAt: future(new Date(m1.getTime() + 48 * HOUR)) });
    },
    // 6 reaching: picked up and said nothing (not a conversation); the WhatsApp is next.
    (l) => {
      const c1 = call(l, "reach:call-1", ago(28, 40), "conversation", "silent");
      Object.assign(l, { status: "reaching", step: 1, nextAt: future(new Date(c1.getTime() + HOUR)) });
    },
    // 7 callback: busy today, call back tomorrow around four.
    (l) => {
      l.instructions = "Prefers short calls: get to the point in the first sentence.";
      const whenAt = dayAt(1, afternoon(l.station));
      call(l, "reach:call-1", ago(170, 230), "conversation", "callbackTomorrow", { whenAt });
      Object.assign(l, { status: "callback", step: 1, callbacks: 1, nextAt: whenAt, note: "Call back: tomorrow around 4pm" });
    },
    // 8 callback: reached on the second call at a conference; next Tuesday morning.
    (l) => {
      l.instructions = "Mentioned SDR hiring for Q1 on LinkedIn: ask how onboarding new reps is going.";
      const c1 = call(l, "reach:call-1", slot(5, l.station), "no_answer");
      step(l, "message-1", plus(c1, 58, 66));
      const c2Time = slot(3, l.station);
      const whenAt = nextWeekday(new Date(Math.max(c2Time.getTime() + 5 * DAY, now.getTime())), 2, morning(l.station));
      call(l, "reach:call-2", c2Time, "conversation", "callbackNextWeek", { whenAt });
      Object.assign(l, { status: "callback", step: 3, callbacks: 1, nextAt: whenAt, note: "Call back: next Tuesday morning" });
    },
    // 9 chasing: said yes this morning; the link went out, the reminder is tomorrow.
    (l) => {
      const c1 = call(l, "reach:call-1", ago(230, 300), "conversation", "meetingFirst");
      const link = sendLink(l, c1);
      Object.assign(l, { status: "chasing", step: 0, nextAt: future(new Date(link.getTime() + 24 * HOUR)), followUpAt: new Date(link.getTime() + 24 * HOUR), note: "Booking link sent", crmStage: "meeting_requested" });
    },
    // 10 chasing: said yes two days ago, reminder sent, not booked: in Action required, chase call next.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(2, l.station), "conversation", "meetingFirst");
      const link = sendLink(l, c1);
      const m = chaseMessage(l, plus(link, 24 * 60, 24 * 60 + 40));
      Object.assign(l, { status: "chasing", step: 1, nextAt: future(new Date(m.getTime() + 48 * HOUR)), followUpAt: new Date(link.getTime() + 24 * HOUR), note: null, crmStage: "meeting_requested" });
    },
    // 11 chasing: reached on the second call after the WhatsApp.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(3, l.station), "no_answer");
      step(l, "message-1", plus(c1, 58, 66));
      const c2 = call(l, "reach:call-2", slot(1, l.station), "conversation", "meetingAfterMessage");
      const link = sendLink(l, c2);
      Object.assign(l, { status: "chasing", step: 0, nextAt: future(new Date(link.getTime() + 24 * HOUR)), followUpAt: new Date(link.getTime() + 24 * HOUR), note: "Booking link sent", crmStage: "meeting_requested" });
    },
    // 12 booked from the first call, meeting already held.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(16, l.station), "conversation", "meetingFirst");
      const link = sendLink(l, c1);
      booked(l, plus(link, 40, 180), dayAt(-12, morning(l.station) + 1));
    },
    // 13 booked on the second call, meeting tomorrow.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(9, l.station), "no_answer");
      step(l, "message-1", plus(c1, 58, 66));
      const c2 = call(l, "reach:call-2", slot(7, l.station), "conversation", "meetingAfterMessage");
      const link = sendLink(l, c2);
      booked(l, plus(link, 20, 90), dayAt(1, morning(l.station) + 1, 30));
    },
    // 14 they rang the number back after the WhatsApp; the agent answered and they booked.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(6, l.station), "no_answer");
      const m1 = step(l, "message-1", plus(c1, 58, 66));
      const back = call(l, "inbound", plus(m1, 90, 240), "conversation", "inbound", { inbound: true });
      const link = sendLink(l, back);
      booked(l, plus(link, 60, 300), dayAt(3, afternoon(l.station) - 2));
    },
    // 15 booked after the chase reminder.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(6, l.station), "no_answer");
      step(l, "message-1", plus(c1, 58, 66));
      const c2 = call(l, "reach:call-2", slot(4, l.station), "conversation", "meetingSecond");
      const link = sendLink(l, c2);
      const m = chaseMessage(l, plus(link, 24 * 60, 24 * 60 + 40));
      booked(l, plus(m, 30, 200), dayAt(6, morning(l.station) + 2));
    },
    // 16 handoff: wants a person, Friday morning.
    (l) => {
      const callAt = slot(4, l.station);
      const whenAt = nextWeekday(callAt, 5, morning(l.station) - 1);
      call(l, "reach:call-1", callAt, "conversation", "wantsTeam", { whenAt });
      Object.assign(l, { status: "handoff", nextAt: null, followUpAt: whenAt, note: "Wants a call from the team", crmStage: "demo_request" });
    },
    // 17 handoff: said yes, the chase ran out without a booking.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(13, l.station), "no_answer");
      step(l, "message-1", plus(c1, 58, 66));
      const c2 = call(l, "reach:call-2", slot(11, l.station), "conversation", "meetingAfterMessage");
      const link = sendLink(l, c2);
      chaseMessage(l, plus(link, 24 * 60, 24 * 60 + 40));
      const cc = call(l, "chase:chase-call-1", slot(8, l.station), "no_answer");
      Object.assign(l, { status: "handoff", step: 1, nextAt: null, followUpAt: cc, note: "Said yes, but has not booked", crmStage: "meeting_requested" });
    },
    // 18 not interested: signed with someone else.
    (l) => {
      call(l, "reach:call-1", slot(17, l.station), "conversation", "otherVendor");
      Object.assign(l, { status: "not_interested", note: fill(SCRIPTS.otherVendor.outcomeSummary, l, AGENT_A.name), crmStage: "already_using_a_tool_not_required" });
    },
    // 19 not interested: budget freeze, on the second call.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(10, l.station), "no_answer");
      step(l, "message-1", plus(c1, 58, 66));
      call(l, "reach:call-2", slot(8, l.station), "conversation", "budgetFreeze");
      Object.assign(l, { status: "not_interested", step: 2, note: fill(SCRIPTS.budgetFreeze.outcomeSummary, l, AGENT_A.name), crmStage: "not_required_right_now" });
    },
    // 20 unreached, after a worker error on the first try.
    (l) => {
      const c0 = call(l, "reach:call-1", slot(18, l.station), "error");
      const c1 = call(l, "retry:reach:call-1:1", plus(c0, 30, 36), "no_answer");
      step(l, "message-1", plus(c1, 58, 66));
      call(l, "reach:call-2", slot(16, l.station), "no_answer");
      const c3 = call(l, "reach:call-3", slot(13, l.station), "busy");
      step(l, "message-2", plus(c3, 240, 250));
      Object.assign(l, { status: "unreached", step: 4, note: "The sequence ran out without a conversation" });
    },
    // 21 unreached.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(15, l.station), "no_answer");
      step(l, "message-1", plus(c1, 58, 66));
      call(l, "reach:call-2", slot(13, l.station), "no_answer");
      const c3 = call(l, "reach:call-3", slot(10, l.station), "no_answer");
      step(l, "message-2", plus(c3, 240, 250));
      Object.assign(l, { status: "unreached", step: 4, note: "The sequence ran out without a conversation" });
    },
    // 22 replied on WhatsApp after the first message: a person takes it from here.
    (l) => {
      const c1 = call(l, "reach:call-1", slot(5, l.station), "no_answer");
      const m1 = step(l, "message-1", plus(c1, 58, 66));
      const at = settle(l, plus(m1, 100, 200), false);
      l.reply = { at, body: `Missed your call. What's this about? Happy to read something first, email is easiest: ${l.person.email}` };
      l.cursor = at;
      Object.assign(l, { status: "replied", step: 2, nextAt: null });
    },
    // 23 Do Not Contact.
    (l) => {
      call(l, "reach:call-1", slot(12, l.station), "conversation", "doNotContact");
      Object.assign(l, { status: "stopped", note: "Asked not to be contacted", crmStage: "do_not_contact" });
    },
    // 24 wrong person.
    (l) => {
      call(l, "reach:call-1", slot(14, l.station), "conversation", "wrongPerson");
      Object.assign(l, { status: "stopped", note: "Wrong person" });
    },
    // 25 not on WhatsApp.
    (l) => {
      call(l, "reach:call-1", slot(14, l.station), "not_on_whatsapp");
      Object.assign(l, { status: "failed", note: "Not on WhatsApp" });
    },
  ];

  const firstWave = new Date(launchedAt.getTime() - rand.int(60, 180) * MINUTE);
  const secondWave = wave(9);
  peopleA.forEach((person, i) => {
    // The first three were added this morning; the rest went in with the first or second wave.
    const lead = newLead("A", person, i < 3 ? ago(40, 170) : firstWave);
    stories[i]!(lead);
    const first = lead.runs[0]?.at;
    if (first && first.getTime() > secondWave.getTime() + HOUR) lead.enrolledAt = new Date(secondWave.getTime() + i * 1000);
    else if (i >= 3) lead.enrolledAt = new Date(firstWave.getTime() + i * 1000);
  });

  // =========================================================================
  // Campaign B: a draft, its leads added yesterday, nothing placed yet.
  // =========================================================================
  const bCreated = slot(1, "uk");
  for (const person of peopleB) {
    const lead = newLead("B", person, plus(bCreated, 20, 40), "uk");
    lead.nextAt = lead.enrolledAt;
  }

  // =========================================================================
  // Write: people's numbers, calling numbers and their WhatsApp accounts
  // =========================================================================
  for (const lead of leads) await db.update(people).set({ phone: lead.person.phone }).where(and(inOrg(people), eq(people.id, lead.person.id)));

  const allCalls = leads.flatMap((l) => l.calls.map((c) => ({ ...c, station: l.station })));
  const firstCall = (key: StationKey) => allCalls.filter((c) => c.station === key).reduce<Date | null>((m, c) => (!m || c.at < m ? c.at : m), null);
  const lastCall = (key: StationKey) => allCalls.filter((c) => c.station === key).reduce<Date | null>((m, c) => (!m || c.at > m ? c.at : m), null);
  const accountIds = {} as Record<StationKey, { id: string; ref: string }>;
  for (const key of ["us", "uk"] as const) {
    const s = STATIONS[key];
    const id = stationIds[key];
    const createdAt = slot(s.createdDays, key);
    const [row] = await db
      .insert(callingStations)
      .values({
        organizationId: org,
        id,
        name: s.name,
        phone: s.phone,
        launcher: "cloak",
        status: "active",
        linkUpdatedAt: new Date(createdAt.getTime() + 25 * MINUTE),
        workerId: WORKER,
        // Held open by the worker, so the number shows as ready. The demo clock moves it forward each day.
        leaseHolder: WORKER,
        leaseUntil: new Date(now.getTime() + 26 * HOUR),
        lastSeenAt: new Date(now.getTime() - rand.int(20, 50) * 1000),
        lastCallAt: lastCall(key),
        profileKey: `stations/${id}/profile.tar.gz`,
        profileBytes: Math.round(s.profileMb * 1_000_000),
        profileVersion: s.profileVersion,
        profileSavedAt: ago(70, 200),
        linkedPhone: s.phone,
        callsPerDay: s.callsPerDay,
        callingHours: s.hours,
        automationStartedAt: firstCall(key),
        createdAt,
        updatedAt: ago(5, 30),
      })
      .returning();
    const account = await ensureStationWhatsappAccount(row!);
    await db
      .update(whatsappAccounts)
      .set({ connectedAt: createdAt, createdAt, updatedAt: ago(5, 30), lastSyncedAt: ago(5, 30) })
      .where(and(inOrg(whatsappAccounts), eq(whatsappAccounts.id, account.id)));
    accountIds[key] = { id: account.id, ref: stationAccountRef(id) };
  }
  count(ctx, "AI calling numbers (with their WhatsApp accounts)", 2);

  // =========================================================================
  // Write: campaigns
  // =========================================================================
  const docs = await db
    .select({ id: crmKnowledgeDocuments.id, title: crmKnowledgeDocuments.title })
    .from(crmKnowledgeDocuments)
    .where(inOrg(crmKnowledgeDocuments));
  const knowledgeIds = docs.filter((d) => !/^Pricing/i.test(d.title)).map((d) => d.id);
  const campaignIds = { A: randomUUID(), B: randomUUID() };
  await db.insert(callCampaigns).values([
    {
      organizationId: org,
      id: campaignIds.A,
      name: "Sales leaders · AI intro calls",
      description: "Heads of sales and RevOps at growing B2B teams: the AI agent calls, follows up on WhatsApp, and books a 30-minute intro with an AE.",
      status: "active",
      runBy: "ai",
      aiGoal: "book_meeting",
      aiInstructions: INSTRUCTIONS_A,
      aiAgentName: AGENT_A.name,
      aiAgentVoice: AGENT_A.voice,
      aiSteps: STEPS_A,
      aiChaseSteps: CHASE_A,
      aiBookingUrl: DEMO_BOOKING_URL,
      aiBookingMessage: BOOKING_MESSAGE_A,
      aiMaxCallbacks: 2,
      aiKnowledgeIds: knowledgeIds.length ? knowledgeIds : null,
      aiLaunchedAt: launchedAt,
      createdAt: new Date(launchedAt.getTime() - 2 * DAY),
      updatedAt: ago(60, 600),
    },
    {
      organizationId: org,
      id: campaignIds.B,
      name: "Webinar sign-ups · EMEA follow-up",
      description: "UK and European sign-ups for the November webinar: a short call about what they took away, then the intro or a call from the team.",
      status: "paused",
      runBy: "ai",
      aiGoal: "either",
      aiInstructions: INSTRUCTIONS_B,
      aiAgentName: AGENT_B.name,
      aiAgentVoice: AGENT_B.voice,
      aiSteps: STEPS_B,
      aiChaseSteps: CHASE_B,
      aiBookingUrl: DEMO_BOOKING_URL,
      aiBookingMessage: null,
      aiMaxCallbacks: 1,
      aiKnowledgeIds: null,
      aiLaunchedAt: null,
      createdAt: bCreated,
      updatedAt: plus(bCreated, 45, 80),
    },
  ]);
  await db.insert(callCampaignStations).values([
    { campaignId: campaignIds.A, stationId: stationIds.us, createdAt: new Date(launchedAt.getTime() - 2 * DAY) },
    { campaignId: campaignIds.A, stationId: stationIds.uk, createdAt: new Date(launchedAt.getTime() - 2 * DAY) },
    { campaignId: campaignIds.B, stationId: stationIds.uk, createdAt: bCreated },
  ]);
  count(ctx, "AI calling campaigns", 2);

  // =========================================================================
  // Write: leads (where each stands now), calls, messages, step runs
  // =========================================================================
  const OPEN: AiContactStatus[] = ["queued", "reaching", "callback", "chasing"];
  const callStatusOf = (c: PlannedCall | undefined): ContactCallStatus =>
    !c ? "new" : c.status === "recorded" ? "connected" : c.result === "not_on_whatsapp" ? "not_on_whatsapp" : c.result === "error" ? "failed" : c.busy ? "busy" : "no_answer";
  await db.insert(callCampaignContacts).values(
    leads.map((l) => {
      const last = l.calls.at(-1);
      let unanswered = 0;
      for (let i = l.calls.length - 1; i >= 0 && l.calls[i]!.status === "no_recording"; i--) unanswered++;
      const touched = l.calls.length > 0 || l.msgs.length > 0;
      const updatedAt = [l.cursor, l.bookedAt].filter((d): d is Date => !!d).reduce((m, d) => (d > m ? d : m), l.enrolledAt);
      return {
        id: l.id,
        campaignId: campaignIds[l.campaign],
        personId: l.person.id,
        stage: l.followUpAt ? ("follow_up" as const) : OPEN.includes(l.status) ? ("to_call" as const) : ("done" as const),
        callStatus: callStatusOf(last),
        statusUpdatedAt: last?.endedAt ?? null,
        unansweredAttempts: unanswered,
        followUpAt: l.followUpAt,
        callCount: l.calls.length,
        lastCalledAt: last?.at ?? null,
        aiStatus: l.status,
        aiStep: l.step,
        aiNextAt: OPEN.includes(l.status) ? l.nextAt : null,
        aiStationId: touched ? stationIds[l.station] : null,
        aiCallbacks: l.callbacks,
        aiFailures: 0,
        aiNote: l.note,
        aiBookedAt: l.bookedAt,
        aiMeetingAt: l.meetingAt,
        aiBookingCode: l.code,
        aiInstructions: l.instructions,
        createdAt: l.enrolledAt,
        updatedAt,
      };
    }),
  );

  const sessionRows: (typeof callSessions.$inferInsert)[] = [];
  for (const l of leads) {
    for (const c of l.calls) {
      const recorded = c.status === "recorded";
      sessionRows.push({
        organizationId: org,
        id: c.id,
        personId: l.person.id,
        campaignContactId: l.id,
        phone: l.person.phone!,
        status: c.status,
        uploadTokenHash: sha256(randomBytes(16).toString("hex")),
        tokenExpiresAt: new Date(c.at.getTime() + 12 * HOUR),
        startedAt: c.at,
        endedAt: c.endedAt,
        durationMs: recorded ? c.talkMs : null,
        recordingKey: recorded ? `demo/recordings/${c.id}.webm` : null,
        recordingBytes: recorded ? Math.round((((c.talkMs ?? 0) + (c.offsetMs ?? 0)) / 1000) * 16_000) : null,
        recordingContentType: recorded ? "audio/webm" : null,
        recordingOffsetMs: recorded ? c.offsetMs : null,
        error: c.error,
        transcriptStatus: recorded ? "done" : "none",
        transcript: c.transcript,
        transcribedAt: recorded ? new Date(c.endedAt.getTime() + rand.int(40, 110) * 1000) : null,
        mode: "agent_cloud",
        stationId: stationIds[l.station],
        agentBrief: c.brief,
        agentName: AGENT_A.name,
        agentVoice: AGENT_A.voice,
        agentOutcome: c.outcome,
        claimedAt: new Date(c.at.getTime() - rand.int(8, 25) * 1000),
        claimedBy: WORKER,
        direction: c.direction,
        createdAt: c.direction === "inbound" ? c.at : new Date(c.at.getTime() - rand.int(25, 60) * 1000),
        updatedAt: new Date(c.endedAt.getTime() + rand.int(60, 150) * 1000),
      });
    }
  }
  for (let i = 0; i < sessionRows.length; i += 100) await db.insert(callSessions).values(sessionRows.slice(i, i + 100));

  // One chat per lead on its number; the replied lead's answer goes through the CRM bridge after.
  let messageCount = 0;
  const jobRows: (typeof stationMessageJobs.$inferInsert)[] = [];
  const repliedLeads: { lead: Lead; chatId: string; unipileChatId: string; messageId: string; key: string }[] = [];
  for (const l of leads) {
    if (!l.msgs.length && !l.reply) continue;
    const phone = l.person.phone!;
    const chatKey = stationChatId(phone);
    const all = [...l.msgs, ...(l.reply ? [{ id: randomUUID(), at: l.reply.at, body: l.reply.body, dir: "inbound" as const, key: messageKey(l), jobId: null }] : [])].sort((a, b) => a.at.getTime() - b.at.getTime());
    const lastMsg = all.at(-1)!;
    const [chat] = await db
      .insert(whatsappChats)
      .values({
        accountId: accountIds[l.station].id,
        unipileChatId: chatKey,
        providerId: chatKey,
        phone,
        personId: l.person.id,
        name: l.person.fullName,
        lastMessageAt: lastMsg.at,
        lastMessagePreview: preview(lastMsg.body),
        lastDirection: lastMsg.dir,
        unreadCount: 0,
        createdAt: all[0]!.at,
        updatedAt: lastMsg.at,
      })
      .returning({ id: whatsappChats.id });
    await db.insert(whatsappMessages).values(
      all.map((m, i) => {
        const laterInbound = all.slice(i + 1).find((x) => x.dir === "inbound");
        let readAt: Date | null = null;
        if (m.dir === "outbound") {
          if (laterInbound) readAt = new Date(laterInbound.at.getTime() - rand.int(60, 900) * 1000);
          else if (rand.chance(0.6)) {
            const t = plus(m.at, 3, 600);
            if (t.getTime() < now.getTime() - MINUTE) readAt = t;
          }
        }
        return {
          id: m.id,
          chatId: chat!.id,
          unipileMessageId: m.key,
          direction: m.dir,
          origin: m.dir === "inbound" ? ("lead" as const) : ("agentsdr" as const),
          body: m.body,
          attachments: [],
          sentAt: m.at,
          deliveredAt: m.dir === "outbound" ? new Date(m.at.getTime() + rand.int(1, 8) * 1000) : null,
          readAt,
          raw: m.dir === "outbound" ? { status: "sent" } : { source: "demo-seed" },
          createdAt: m.at,
        };
      }),
    );
    messageCount += all.length;
    for (const m of l.msgs) {
      jobRows.push({
        organizationId: org,
        id: m.jobId!,
        stationId: stationIds[l.station],
        whatsappMessageId: m.id,
        phone,
        body: m.body,
        status: "sent",
        claimedBy: WORKER,
        claimedAt: new Date(m.at.getTime() - rand.int(10, 25) * 1000),
        sentAt: m.at,
        createdAt: new Date(m.at.getTime() - rand.int(30, 60) * 1000),
      });
    }
    if (l.reply) {
      const inbound = all.find((m) => m.dir === "inbound")!;
      repliedLeads.push({ lead: l, chatId: chat!.id, unipileChatId: chatKey, messageId: inbound.id, key: inbound.key });
    }
  }
  if (jobRows.length) await db.insert(stationMessageJobs).values(jobRows);

  const runRows = leads.flatMap((l) =>
    l.runs.map((r) => ({
      contactId: l.id,
      stepKey: r.stepKey,
      kind: r.kind,
      status: r.status,
      stationId: stationIds[l.station],
      callSessionId: r.callId,
      whatsappMessageId: r.messageId,
      result: r.result,
      error: r.error,
      createdAt: r.at,
      finishedAt: r.finishedAt,
    })),
  );
  if (runRows.length) await db.insert(callCampaignStepRuns).values(runRows);

  // =========================================================================
  // CRM: the booking link, stages, hand-offs, and the reply
  // =========================================================================
  await db.update(crmSettings).set({ bookingUrl: DEMO_BOOKING_URL }).where(eq(crmSettings.pipelineId, ctx.pipelineId));

  const subs = await db
    .select({ id: crmSubcategories.id, key: crmSubcategories.key, categoryKey: crmSubcategories.categoryKey })
    .from(crmSubcategories)
    .where(eq(crmSubcategories.pipelineId, ctx.pipelineId));
  const subByKey = new Map(subs.map((s) => [s.key, s]));
  let staged = 0;
  const callPeople: string[] = [];
  for (const l of leads) {
    if (!l.calls.some((c) => c.status === "recorded")) continue;
    if (l.reply) continue;
    callPeople.push(l.person.id);
    const sub = l.crmStage ? subByKey.get(l.crmStage) : null;
    if (sub) {
      try {
        await setLeadStage(l.id, { categoryKey: sub.categoryKey as LeadStageCategory, subcategoryId: sub.id });
        staged++;
      } catch (error) {
        console.error(`    could not set the stage for AI lead ${l.person.fullName}:`, error instanceof Error ? error.message : error);
      }
    } else {
      await syncCallFollowUpSafely(l.person.id);
    }
  }
  count(ctx, "AI leads with a CRM stage", staged);

  // The reply: through the bridge, as the station's inbound report would; crm.ts reads it.
  const replyRep: TeamKey = "sam";
  for (const r of repliedLeads) {
    const { crmConversationMessageId } = await forwardWhatsappInboundToCrm({
      personId: r.lead.person.id,
      unipileAccountId: accountIds[r.lead.station].ref,
      unipileChatId: r.unipileChatId,
      providerContactId: r.unipileChatId,
      unipileMessageId: r.key,
      body: r.lead.reply!.body,
      sentAt: r.lead.reply!.at,
      raw: { source: "demo-seed" },
    });
    if (!crmConversationMessageId) continue;
    await db.update(whatsappMessages).set({ crmConversationMessageId }).where(eq(whatsappMessages.id, r.messageId));
    // Ingest stopped the lead ("replied"); keep the time it happened.
    await db
      .update(callCampaignContacts)
      .set({ aiStatus: "replied", aiNextAt: null, stage: "done", updatedAt: r.lead.reply!.at })
      .where(eq(callCampaignContacts.id, r.lead.id));
    const [row] = await db.execute<{ conversation_id: string; crm_record_id: string }>(sql`
      select m.conversation_id, c.crm_record_id
        from crm_conversation_messages m join crm_conversations c on c.id = m.conversation_id
       where m.id = ${crmConversationMessageId}`);
    if (!row) continue;
    ctx.replies.push({
      recordId: row.crm_record_id,
      personId: r.lead.person.id,
      conversationId: row.conversation_id,
      messageId: crmConversationMessageId,
      channel: "whatsapp",
      intent: "Information Requested",
      sentAt: r.lead.reply!.at,
      rep: replyRep,
    });
    await db.execute(sql`
      update crm_webhook_events e set created_at = ${new Date(r.lead.reply!.at.getTime() + 2000).toISOString()}::timestamptz
       where e.organization_id = ${org} and e.source = 'whatsapp' and e.payload->>'unipileMessageId' = ${r.key}`);
  }

  // Calls belong to their lead's CRM record; records the calls created carry the calls' history.
  const personIds = leads.map((l) => l.person.id);
  await db.execute(sql`
    update call_sessions s set crm_record_id = r.id
      from crm_records r
     where s.organization_id = ${org} and r.organization_id = ${org}
       and r.person_id = s.person_id and s.crm_record_id is null
       and s.person_id in (${sql.join(personIds.map((id) => sql`${id}::uuid`), sql`, `)})`);
  if (callPeople.length) {
    await db.execute(sql`
      update crm_records r
         set created_at = h.first_at, updated_at = h.last_at, last_interaction_at = h.last_at
        from (select person_id, min(created_at) as first_at, max(coalesce(ended_at, created_at)) as last_at
                from call_sessions where organization_id = ${org} group by person_id) h
       where r.organization_id = ${org} and r.person_id = h.person_id
         and r.person_id in (${sql.join(callPeople.map((id) => sql`${id}::uuid`), sql`, `)})`);
  }
  // Do Not Contact was set when they asked, on the call.
  const dnc = leads.filter((l) => l.crmStage === "do_not_contact");
  for (const l of dnc) {
    const at = l.calls.at(-1)!.endedAt.toISOString();
    await db.execute(sql`update crm_person_contact_policies set set_at = ${at}::timestamptz, updated_at = ${at}::timestamptz where person_id = ${l.person.id}::uuid`);
  }

  const recorded = sessionRows.filter((r) => r.status === "recorded").length;
  count(ctx, "AI campaign leads", leads.length);
  count(ctx, "AI campaign calls", sessionRows.length);
  count(ctx, "AI calls with a conversation (recorded, transcribed)", recorded);
  count(ctx, "AI campaign WhatsApp messages", messageCount);
  count(ctx, "AI campaign step runs", runRows.length);
  const byStatus: Record<string, number> = {};
  for (const l of leads.filter((x) => x.campaign === "A")) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
  console.log(`\n    AI campaign lead statuses: ${JSON.stringify(byStatus)}`);
}
