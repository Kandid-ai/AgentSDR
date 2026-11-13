import { AiAssistantsSettings } from "@/components/settings/AiAssistantsSettings";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { requirePageOrgContext } from "@/lib/auth/context";
import { mcpResourceUrl } from "@/lib/mcp/oauth";

export const metadata = { title: "AI assistants" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageOrgContext();
  return (
    <SettingsPage
      title="AI assistants"
      description="Connect Claude to work your Action required queue: read threads, edit and send replies, change stages."
      width="narrow"
    >
      <AiAssistantsSettings serverUrl={mcpResourceUrl()} />
    </SettingsPage>
  );
}
