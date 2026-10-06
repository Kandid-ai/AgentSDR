/**
 * The public marketing site: its canonical origin, the URL prefixes it owns,
 * and every page on it. Plain data with no React or icon imports, because
 * proxy.ts (which decides what is public) and sitemap.ts read it too. The nav,
 * footer and related-page cards add icons on top of it in
 * src/components/marketing/catalog.ts.
 */

/**
 * Where the marketing site lives. Canonical URLs, the sitemap and Open Graph
 * images all point here, so a self-hosted copy of the app (which serves the
 * same pages) never competes with it in search.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://agentsdr.ai").replace(/\/$/, "");

export const SITE_NAME = "AgentSDR";

/**
 * Path prefixes served by src/app/(marketing). Public in proxy.ts and
 * chromeless in AppShell. None may collide with an app route (/linkedin,
 * /whatsapp, /crm, /leads, /tables and /analytics are all taken by the app).
 */
export const MARKETING_PREFIXES = ["/product", "/solutions", "/compare", "/open-source", "/guides", "/changelog", "/og"] as const;

export function isMarketingPath(pathname: string): boolean {
  return pathname === "/" || MARKETING_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export type MarketingPage = {
  path: string;
  /** Short name, as the nav and footer show it. */
  label: string;
  /** One line under the label in the mega-menu, and on related-page cards. */
  blurb: string;
  section: "product" | "solutions" | "compare" | "resources";
  /** Sitemap priority, 0–1. */
  priority: number;
};

export const PAGES: readonly MarketingPage[] = [
  // Product: channels
  { path: "/product/email", label: "Email sequences", blurb: "Cold email from your own Google Workspace mailboxes", section: "product", priority: 0.9 },
  { path: "/product/linkedin", label: "LinkedIn automation", blurb: "Invites and follow-ups across many accounts, safely paced", section: "product", priority: 0.9 },
  { path: "/product/whatsapp", label: "WhatsApp", blurb: "Recorded calls and message campaigns from your own number", section: "product", priority: 0.9 },
  // Product: AI CRM
  { path: "/product/ai-crm", label: "AI CRM", blurb: "Every reply classified and the lead moved for you", section: "product", priority: 0.9 },
  { path: "/product/inbox", label: "Unified inbox", blurb: "Email, LinkedIn and WhatsApp replies with drafts ready", section: "product", priority: 0.8 },
  // Product: data
  { path: "/product/lead-database", label: "Lead database", blurb: "People and companies shared by every channel", section: "product", priority: 0.8 },
  { path: "/product/tables", label: "Enrichment tables", blurb: "AI columns, APIs, formulas and Apollo in a grid", section: "product", priority: 0.8 },
  { path: "/product/analytics", label: "Analytics", blurb: "Replies, meetings and customers by channel", section: "product", priority: 0.7 },
  // Solutions
  { path: "/solutions/founders", label: "Founders", blurb: "Founder-led outbound without an SDR team", section: "solutions", priority: 0.8 },
  { path: "/solutions/agencies", label: "Agencies", blurb: "One deployment, a separate organization per client", section: "solutions", priority: 0.8 },
  { path: "/solutions/sales-teams", label: "Sales teams", blurb: "Shared pipeline, per-rep accounts, one inbox", section: "solutions", priority: 0.8 },
  { path: "/open-source", label: "Open source & self-hosted", blurb: "AGPL code on your server, with your own AI key", section: "solutions", priority: 0.9 },
  // Compare
  { path: "/compare", label: "All comparisons", blurb: "How AgentSDR stacks up against the tools it replaces", section: "compare", priority: 0.7 },
  { path: "/compare/clay", label: "Clay alternative", blurb: "Open-source enrichment tables plus outreach", section: "compare", priority: 0.8 },
  { path: "/compare/lemlist", label: "Lemlist alternative", blurb: "Multichannel sequences without per-seat pricing", section: "compare", priority: 0.8 },
  { path: "/compare/heyreach", label: "HeyReach alternative", blurb: "Multi-account LinkedIn on your own server", section: "compare", priority: 0.8 },
  { path: "/compare/instantly", label: "Instantly alternative", blurb: "Cold email with an AI CRM behind it", section: "compare", priority: 0.8 },
  { path: "/compare/apollo", label: "Apollo alternative", blurb: "Bring Apollo's data, own the workflow", section: "compare", priority: 0.8 },
  // Resources
  { path: "/guides", label: "Guides", blurb: "Playbooks for safe, multichannel outbound", section: "resources", priority: 0.7 },
  { path: "/guides/cold-email-google-workspace", label: "Cold email from Google Workspace", blurb: "Mailboxes, daily limits and deliverability", section: "resources", priority: 0.7 },
  { path: "/guides/linkedin-automation-limits", label: "LinkedIn automation limits", blurb: "How many invites and messages are safe", section: "resources", priority: 0.7 },
  { path: "/guides/whatsapp-b2b-outreach", label: "WhatsApp for B2B outreach", blurb: "Calls, warm-up and new-chat limits", section: "resources", priority: 0.7 },
  { path: "/changelog", label: "Changelog", blurb: "What shipped, release by release", section: "resources", priority: 0.5 },
];

export function pageByPath(path: string): MarketingPage {
  const page = PAGES.find((p) => p.path === path);
  if (!page) throw new Error(`Unknown marketing page: ${path}`);
  return page;
}

/** Off-site destinations. */
export const EXTERNAL = {
  github: "https://github.com/Kandid-ai/AgentSDR",
  issues: "https://github.com/Kandid-ai/AgentSDR/issues",
  /**
   * The Mintlify docs are planned at agentsdr.ai/docs (subdirectory hosting),
   * but nothing serves that path yet. Until it does, the docs are read on
   * GitHub; switch this one constant when /docs is live.
   */
  docs: "https://github.com/Kandid-ai/AgentSDR/tree/main/docs",
} as const;
