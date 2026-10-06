import type { ComponentType, CSSProperties } from "react";
import {
  RiBarChartBoxLine,
  RiBookOpenLine,
  RiBuilding2Line,
  RiCodeSSlashLine,
  RiContactsBook3Line,
  RiFileList3Line,
  RiGitBranchLine,
  RiGithubFill,
  RiHistoryLine,
  RiInbox2Line,
  RiLayoutGridLine,
  RiLinkedinBoxFill,
  RiMailFill,
  RiRocket2Line,
  RiScales3Line,
  RiServerLine,
  RiSparkling2Line,
  RiTeamLine,
  RiWhatsappFill,
} from "@remixicon/react";
import { EXTERNAL, PAGES, type MarketingPage } from "@/lib/marketing/site";

/**
 * The marketing site's navigation: the pages in src/lib/marketing/site.ts
 * with an icon and an accent each, grouped the way the mega-menu, the phone
 * menu and the footer show them. Change a page's name or blurb there, its
 * place in the menus here.
 */

export type Icon = ComponentType<{ className?: string; style?: CSSProperties }>;

/** Channel colours, the same three hues the app and the landing page use. */
export const ACCENT = {
  email: "#fa7319",
  linkedin: "#335cff",
  whatsapp: "#1fc16b",
  ai: "#7d52f4",
  data: "#0b8a7a",
  neutral: "#525866",
} as const;

export type NavLink = { href: string; label: string; blurb?: string; icon: Icon; accent: string; external?: boolean };
export type NavGroup = { title: string; links: NavLink[] };
export type NavFeature = { href: string; eyebrow: string; title: string; external?: boolean };
export type NavSection = { key: string; label: string; groups: NavGroup[]; feature: NavFeature };

const ICONS: Record<string, { icon: Icon; accent: string }> = {
  "/product/email": { icon: RiMailFill, accent: ACCENT.email },
  "/product/linkedin": { icon: RiLinkedinBoxFill, accent: ACCENT.linkedin },
  "/product/whatsapp": { icon: RiWhatsappFill, accent: ACCENT.whatsapp },
  "/product/ai-crm": { icon: RiSparkling2Line, accent: ACCENT.ai },
  "/product/inbox": { icon: RiInbox2Line, accent: ACCENT.ai },
  "/product/lead-database": { icon: RiContactsBook3Line, accent: ACCENT.data },
  "/product/tables": { icon: RiLayoutGridLine, accent: ACCENT.data },
  "/product/analytics": { icon: RiBarChartBoxLine, accent: ACCENT.linkedin },
  "/solutions/founders": { icon: RiRocket2Line, accent: ACCENT.email },
  "/solutions/agencies": { icon: RiBuilding2Line, accent: ACCENT.ai },
  "/solutions/sales-teams": { icon: RiTeamLine, accent: ACCENT.linkedin },
  "/open-source": { icon: RiServerLine, accent: ACCENT.neutral },
  "/compare": { icon: RiScales3Line, accent: ACCENT.neutral },
  "/compare/clay": { icon: RiScales3Line, accent: ACCENT.neutral },
  "/compare/lemlist": { icon: RiScales3Line, accent: ACCENT.neutral },
  "/compare/heyreach": { icon: RiScales3Line, accent: ACCENT.neutral },
  "/compare/instantly": { icon: RiScales3Line, accent: ACCENT.neutral },
  "/compare/apollo": { icon: RiScales3Line, accent: ACCENT.neutral },
  "/guides": { icon: RiBookOpenLine, accent: ACCENT.linkedin },
  "/guides/cold-email-google-workspace": { icon: RiFileList3Line, accent: ACCENT.email },
  "/guides/linkedin-automation-limits": { icon: RiFileList3Line, accent: ACCENT.linkedin },
  "/guides/whatsapp-b2b-outreach": { icon: RiFileList3Line, accent: ACCENT.whatsapp },
  "/changelog": { icon: RiHistoryLine, accent: ACCENT.neutral },
};

export function linkFor(path: string, overrides?: Partial<NavLink>): NavLink {
  const page = PAGES.find((p) => p.path === path) as MarketingPage;
  const look = ICONS[path] ?? { icon: RiFileList3Line, accent: ACCENT.neutral };
  return { href: page.path, label: page.label, blurb: page.blurb, ...look, ...overrides };
}

const DOCS: NavLink = { href: EXTERNAL.docs, label: "Documentation", blurb: "Set up every channel, step by step", icon: RiBookOpenLine, accent: ACCENT.linkedin, external: true };
const GITHUB: NavLink = { href: EXTERNAL.github, label: "GitHub", blurb: "Read the code, star the repo", icon: RiGithubFill, accent: "#141414", external: true };
const ISSUES: NavLink = { href: EXTERNAL.issues, label: "Issues & requests", blurb: "Report a bug or ask for a feature", icon: RiGitBranchLine, accent: ACCENT.neutral, external: true };
const SELF_HOST: NavLink = { href: `${EXTERNAL.docs}/self-hosting.md`, label: "Self-hosting", blurb: "Docker, Postgres and your env", icon: RiCodeSSlashLine, accent: ACCENT.neutral, external: true };

export const NAV: NavSection[] = [
  {
    key: "product",
    label: "Product",
    groups: [
      { title: "Channels", links: [linkFor("/product/email"), linkFor("/product/linkedin"), linkFor("/product/whatsapp")] },
      { title: "AI CRM", links: [linkFor("/product/ai-crm"), linkFor("/product/inbox")] },
      { title: "Data & insights", links: [linkFor("/product/lead-database"), linkFor("/product/tables"), linkFor("/product/analytics")] },
    ],
    feature: { href: "/open-source", eyebrow: "Open source", title: "Run the whole stack on your own server, with your own AI key" },
  },
  {
    key: "solutions",
    label: "Solutions",
    groups: [
      { title: "By team", links: [linkFor("/solutions/founders"), linkFor("/solutions/agencies"), linkFor("/solutions/sales-teams")] },
      {
        title: "Alternatives",
        links: [
          linkFor("/compare/clay", { blurb: undefined }),
          linkFor("/compare/lemlist", { blurb: undefined }),
          linkFor("/compare/heyreach", { blurb: undefined }),
          linkFor("/compare/instantly", { blurb: undefined }),
          linkFor("/compare/apollo", { blurb: undefined }),
        ],
      },
      { title: "Own it", links: [linkFor("/open-source", { label: "Open source" }), SELF_HOST] },
    ],
    feature: { href: "/compare", eyebrow: "Compare", title: "Replace five subscriptions with one open-source workspace" },
  },
  {
    key: "resources",
    label: "Resources",
    groups: [
      { title: "Learn", links: [DOCS, linkFor("/guides"), linkFor("/changelog")] },
      { title: "Guides", links: [linkFor("/guides/cold-email-google-workspace"), linkFor("/guides/linkedin-automation-limits"), linkFor("/guides/whatsapp-b2b-outreach")] },
      { title: "Developers", links: [GITHUB, SELF_HOST, ISSUES] },
    ],
    feature: { href: EXTERNAL.github, eyebrow: "GitHub", title: "Star the repo and follow along as it ships", external: true },
  },
];

/** Footer columns: every page, so each one is linked from every other. */
export const FOOTER: NavGroup[] = [
  { title: "Product", links: ["/product/email", "/product/linkedin", "/product/whatsapp", "/product/ai-crm", "/product/inbox", "/product/lead-database", "/product/tables", "/product/analytics"].map((p) => linkFor(p)) },
  { title: "Solutions", links: ["/solutions/founders", "/solutions/agencies", "/solutions/sales-teams", "/open-source"].map((p) => linkFor(p)) },
  { title: "Compare", links: ["/compare/clay", "/compare/lemlist", "/compare/heyreach", "/compare/instantly", "/compare/apollo", "/compare"].map((p) => linkFor(p)) },
  { title: "Resources", links: [DOCS, linkFor("/guides"), linkFor("/changelog"), GITHUB, ISSUES] },
];
