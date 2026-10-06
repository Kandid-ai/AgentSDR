import ByokSettingsClient from "@/components/ai/ByokSettingsClient";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const metadata = { title: "AI provider" };
export const dynamic = "force-dynamic";

export default function AiSettingsPage() {
  return (
    <SettingsPage title="AI provider" description="The OpenRouter connection and models every AI feature uses.">
      <ByokSettingsClient />
    </SettingsPage>
  );
}
