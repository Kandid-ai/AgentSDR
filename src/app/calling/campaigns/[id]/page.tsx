import CampaignClient from "@/components/calling/CampaignClient";
import { isContactTab } from "@/components/calling/contactTabs";

export default async function CallCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return <CampaignClient campaignId={id} initialTab={isContactTab(tab) ? tab : "all"} />;
}
