/**
 * Sample LinkedIn conversations for the landing page's inbox showcase, drawn
 * with the real inbox shell (src/components/inbox/shell) the way LinkedIn
 * Messages uses it. Fictional people and
 * messages; times are minutes before "now" so they read as today.
 */

export type SampleMessage = { outbound: boolean; minutesAgo: number; text: string; via?: string };

export type SampleThread = {
  id: string;
  name: string;
  company: string;
  headline: string;
  channel: "email" | "linkedin" | "whatsapp";
  subject?: string;
  minutesAgo: number;
  unread: boolean;
  categoryKey: string;
  category: string;
  draft?: string;
  sequence?: string;
  step?: string;
  messages: SampleMessage[];
};

export const THREADS: SampleThread[] = [
  {
    id: "t1",
    name: "Hannah Weiss",
    company: "Lumen Freight",
    headline: "Head of Growth · Lumen Freight",
    channel: "linkedin",
    minutesAgo: 14,
    unread: true,
    categoryKey: "interested",
    category: "Meeting Requested",
    sequence: "Meeting Requested",
    step: "Immediate reply",
    draft: "Thursday works — I've held 3:00pm CET and sent the invite to your inbox. I'll bring the reply-rate numbers from teams your size, plus a look at how the pipeline view would map to your ops team.",
    messages: [
      { outbound: true, minutesAgo: 60 * 26, text: "Hi Hannah — saw Lumen is hiring two SDRs. Most teams we talk to lose the first month to tooling. Worth comparing notes?", via: "Invite note" },
      { outbound: false, minutesAgo: 60 * 20, text: "Thanks for connecting! Yes, we're rebuilding outbound this quarter." },
      { outbound: true, minutesAgo: 60 * 19, text: "Great timing then. Happy to show you how we run email, LinkedIn and WhatsApp from one place — 20 minutes this week?", via: "Follow-up 1" },
      { outbound: false, minutesAgo: 14, text: "This is timely. Could you do Thursday afternoon? I'll bring our ops lead." },
    ],
  },
  {
    id: "t2",
    name: "Rafael Costa",
    company: "Brightloop",
    headline: "VP Sales · Brightloop",
    channel: "linkedin",
    minutesAgo: 52,
    unread: true,
    categoryKey: "interested",
    category: "Information Requested",
    draft: "It sends from the Google Workspace mailboxes you already have — each one keeps its own daily limit, sending window and signature, so there's nothing new to warm up. Want me to walk you through the setup on a short call?",
    messages: [{ outbound: false, minutesAgo: 52, text: "Interesting. Does it work with our own Google Workspace mailboxes, or do we need new ones?" }],
  },
  {
    id: "t3",
    name: "Aiko Tanaka",
    company: "Kestrel Health",
    headline: "Growth Lead · Kestrel Health",
    channel: "linkedin",
    minutesAgo: 95,
    unread: false,
    categoryKey: "other",
    category: "Connected to Different POC",
    messages: [{ outbound: false, minutesAgo: 95, text: "I've moved teams — Daniel runs growth now, I'll forward this to him." }],
  },
  {
    id: "t4",
    name: "Marcus Lindqvist",
    company: "Oakridge Capital",
    headline: "Partner · Oakridge Capital",
    channel: "linkedin",
    minutesAgo: 60 * 5,
    unread: false,
    categoryKey: "interested",
    category: "Demo Requested",
    draft: "No per-seat fee — you host it yourself, so it costs the same for two reps or twenty. The running costs are your server and your own AI usage. Happy to show you a deploy before the demo.",
    messages: [{ outbound: false, minutesAgo: 60 * 5, text: "Before a demo — is there a per-seat fee?" }],
  },
  {
    id: "t5",
    name: "Chloé Martin",
    company: "Atelier Nord",
    headline: "Founder · Atelier Nord",
    channel: "linkedin",
    minutesAgo: 60 * 7,
    unread: false,
    categoryKey: "not_interested",
    category: "Not Required Right Now",
    messages: [{ outbound: false, minutesAgo: 60 * 7, text: "Not this quarter, but reach out again in January." }],
  },
  {
    id: "t6",
    name: "Samir Haddad",
    company: "Parcelly",
    headline: "COO · Parcelly",
    channel: "linkedin",
    minutesAgo: 60 * 9,
    unread: false,
    categoryKey: "customer",
    category: "Customer",
    messages: [{ outbound: false, minutesAgo: 60 * 9, text: "Signed on our side — send over the onboarding doc when you can." }],
  },
];
