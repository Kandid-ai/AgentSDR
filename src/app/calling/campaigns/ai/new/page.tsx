import { requirePageOrgContext } from "@/lib/auth/context";
import { AiCampaignWizard } from "@/components/calling/ai/AiCampaignWizard";

export const dynamic = "force-dynamic";

export const metadata = { title: "New calling campaign" };

export default async function NewAiCallCampaignPage({ searchParams }: { searchParams: Promise<{ caller?: string | string[] }> }) {
  await requirePageOrgContext();
  const { caller } = await searchParams;
  return <AiCampaignWizard initialCaller={caller === "rep" ? "rep" : "agent"} />;
}
