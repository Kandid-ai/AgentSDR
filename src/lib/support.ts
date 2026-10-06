/**
 * Where people go for help, in one client-safe place so the app's Help menu,
 * the docs and the landing page all point at the same URLs. No imports.
 */

const REPO = "https://github.com/Kandid-ai/AgentSDR";

export const SUPPORT_LINKS = {
  docs: "https://docs.agentsdr.ai",
  featureRequest: `${REPO}/issues/new?template=feature_request.yml`,
  community: `${REPO}/discussions`,
  security: `${REPO}/security/advisories/new`,
} as const;

/**
 * The bug form, with its `version` field prefilled (GitHub issue forms read a
 * query param named after the field id). Only the app version goes in the
 * link: never the page, the person or their organization.
 */
export function bugReportUrl(version: string | undefined): string {
  const url = new URL(`${REPO}/issues/new`);
  url.searchParams.set("template", "bug_report.yml");
  if (version) url.searchParams.set("version", version);
  return url.toString();
}

/** package.json's version, inlined at build time by next.config.ts (env.NEXT_PUBLIC_APP_VERSION). */
export const APP_VERSION: string | undefined = process.env.NEXT_PUBLIC_APP_VERSION;
