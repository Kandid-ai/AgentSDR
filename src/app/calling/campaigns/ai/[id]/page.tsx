import { AI_CAMPAIGN_TABS, AiCampaignDetailClient, type AiCampaignTab } from "@/components/calling/ai/AiCampaignDetailClient";

export const metadata = { title: "AI calling campaign" };

export default async function AiCallCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const initialTab = (AI_CAMPAIGN_TABS as readonly string[]).includes(String(tab)) ? (tab as AiCampaignTab) : "overview";
  return <AiCampaignDetailClient campaignId={id} initialTab={initialTab} />;
}
