import type { ComponentType, CSSProperties } from "react";
import {
  RiArticleLine,
  RiBarChart2Line,
  RiBookOpenLine,
  RiBookletLine,
  RiBuilding2Line,
  RiCodeSSlashLine,
  RiContactsBook3Line,
  RiFlowChart,
  RiGitBranchLine,
  RiGithubFill,
  RiHistoryLine,
  RiInbox2Line,
  RiLinkedinBoxFill,
  RiScales3Line,
  RiServerLine,
  RiTableLine,
  RiTeamLine,
  RiUserStarLine,
  RiWhatsappFill,
} from "@remixicon/react";
import { BLOG_PATH, EXTERNAL, PAGES, type MarketingPage } from "@/lib/marketing/site";

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

/**
 * `logo` (an image) wins over `icon`; `color` tints the icon (brand marks
 * only — everything else stays a dark glyph). A link with neither is a plain
 * text row in the menu. `accent` colours the page's own visuals, not its icon.
 */
export type NavLink = {
  href: string;
  label: string;
  blurb?: string;
  icon?: Icon;
  logo?: string;
  /** How a logo sits in its tile: "bleed" fills it (marks with their own square), a number is its share of the tile. */
  logoFit?: "bleed" | number;
  color?: string;
  accent: string;
  external?: boolean;
};
export type NavGroup = { title: string; links: NavLink[] };
export type NavFeature = { href: string; eyebrow: string; title: string; external?: boolean };
export type NavSection = { key: string; label: string; groups: NavGroup[]; feature: NavFeature };

/** Real brand marks for the channels; brand colours exactly, so they read as the services themselves. */
const BRAND = {
  google: "/Integrations - Icon/google.svg",
  linkedin: "#0a66c2",
  whatsapp: "#25d366",
} as const;

type Look = Pick<NavLink, "icon" | "logo" | "logoFit" | "color" | "accent">;

const LOOKS: Record<string, Look> = {
  "/product/email": { logo: BRAND.google, accent: ACCENT.email },
  "/product/linkedin": { icon: RiLinkedinBoxFill, color: BRAND.linkedin, accent: ACCENT.linkedin },
  "/product/whatsapp": { icon: RiWhatsappFill, color: BRAND.whatsapp, accent: ACCENT.whatsapp },
  "/product/ai-crm": { icon: RiFlowChart, accent: ACCENT.ai },
  "/product/inbox": { icon: RiInbox2Line, accent: ACCENT.ai },
  "/product/lead-database": { icon: RiContactsBook3Line, accent: ACCENT.data },
  "/product/tables": { icon: RiTableLine, accent: ACCENT.data },
  "/product/analytics": { icon: RiBarChart2Line, accent: ACCENT.linkedin },
  "/solutions/founders": { icon: RiUserStarLine, accent: ACCENT.email },
  "/solutions/agencies": { icon: RiBuilding2Line, accent: ACCENT.ai },
  "/solutions/sales-teams": { icon: RiTeamLine, accent: ACCENT.linkedin },
  "/open-source": { icon: RiServerLine, accent: ACCENT.neutral },
  "/compare": { icon: RiScales3Line, accent: ACCENT.neutral },
  // Each alternative wears the company's own unaltered mark (public/landing/tools,
  // the same files and fits the landing hero uses: src/components/landing/data/tools.ts).
  "/compare/clay": { logo: "/landing/tools/clay.png", logoFit: 0.74, accent: ACCENT.neutral },
  "/compare/lemlist": { logo: "/landing/tools/lemlist.svg", logoFit: "bleed", accent: ACCENT.neutral },
  "/compare/heyreach": { logo: "/landing/tools/heyreach.png", logoFit: "bleed", accent: ACCENT.neutral },
  "/compare/instantly": { logo: "/landing/tools/instantly.png", logoFit: 0.66, accent: ACCENT.neutral },
  "/compare/apollo": { logo: "/landing/tools/apollo.png", logoFit: "bleed", accent: ACCENT.neutral },
  "/guides": { icon: RiBookletLine, accent: ACCENT.linkedin },
  // Each guide wears its channel's mark.
  "/guides/cold-email-google-workspace": { logo: BRAND.google, accent: ACCENT.email },
  "/guides/linkedin-automation-limits": { icon: RiLinkedinBoxFill, color: BRAND.linkedin, accent: ACCENT.linkedin },
  "/guides/whatsapp-b2b-outreach": { icon: RiWhatsappFill, color: BRAND.whatsapp, accent: ACCENT.whatsapp },
  "/changelog": { icon: RiHistoryLine, accent: ACCENT.neutral },
};

export function linkFor(path: string, overrides?: Partial<NavLink>): NavLink {
  const page = PAGES.find((p) => p.path === path) as MarketingPage;
  const look = LOOKS[path] ?? { icon: RiScales3Line, accent: ACCENT.neutral };
  return { href: page.path, label: page.label, blurb: page.blurb, ...look, ...overrides };
}

/** The Ghost blog under /blog (see BLOG_PATH); a trailing slash because Ghost's pages end in one. */
const BLOG: NavLink = { href: `${BLOG_PATH}/`, label: "Blog", blurb: "Notes on outbound, AI and building in the open", icon: RiArticleLine, accent: ACCENT.linkedin };
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
      { title: "Learn", links: [BLOG, DOCS, linkFor("/guides"), linkFor("/changelog")] },
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
  { title: "Resources", links: [BLOG, DOCS, linkFor("/guides"), linkFor("/changelog"), GITHUB, ISSUES] },
];
