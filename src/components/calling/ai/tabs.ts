/**
 * The AI campaign page's tabs. A plain module, not the "use client" detail
 * component: the server page reads this list, and a value imported from a
 * client module is only a reference on the server (calling .includes on it
 * threw, and the page failed to load — 27 Oct 2026).
 */
export type AiCampaignTab = "dialer" | "overview" | "leads" | "sequence" | "compare" | "settings";
export const AI_CAMPAIGN_TABS: readonly AiCampaignTab[] = ["dialer", "overview", "leads", "sequence", "compare", "settings"];

export function isAiCampaignTab(value: unknown): value is AiCampaignTab {
  return typeof value === "string" && (AI_CAMPAIGN_TABS as readonly string[]).includes(value);
}

/** The tab a campaign opens on: the dialer for a rep's campaign, the overview for the AI agent's. */
export function defaultAiCampaignTab(caller: "agent" | "rep"): AiCampaignTab {
  return caller === "rep" ? "dialer" : "overview";
}

/** Tabs that only one kind of campaign has (the Dialer is a rep's; Compare voices is the agent's). */
export function aiCampaignTabAvailable(tab: AiCampaignTab, caller: "agent" | "rep"): boolean {
  if (tab === "dialer") return caller === "rep";
  if (tab === "compare") return caller === "agent";
  return true;
}
