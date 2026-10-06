import { RequiresPlatform } from "@/components/settings/RequiresPlatform";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { WhatsappAccountsClient } from "@/components/whatsapp/WhatsappAccountsClient";
import { requirePageOrgContext } from "@/lib/auth/context";
import { channelRules } from "@/lib/channels/rules.server";
import { runInOrganization } from "@/lib/tenancy/scope";

export const dynamic = "force-dynamic";

export const metadata = { title: "WhatsApp accounts" };

// The same prompt the gate renders, under the page header the client component would have supplied.
function ConnectPrompt() {
  return <RequiresPlatform platform="unipile" settingsHref="/settings/whatsapp-connection">{null}</RequiresPlatform>;
}

async function Numbers() {
  const ctx = await requirePageOrgContext();
  const rules = await runInOrganization(ctx.organizationId, () => channelRules("whatsapp"));
  return <WhatsappAccountsClient rules={{ warmupHours: rules.warmupHours, newChatsPerDay: rules.newChatsPerDay, secondsBetweenSends: rules.secondsBetweenSends }} />;
}

export default function WhatsappAccountsPage() {
  return (
    <RequiresPlatform
      platform="unipile"
      fallback={
        <SettingsPage title="WhatsApp accounts" description="The WhatsApp numbers messaging and calling run from, linked through Unipile.">
          {/* Not connected here by construction: this renders only as the gate's fallback, so it shows the Connect prompt. */}
          <ConnectPrompt />
        </SettingsPage>
      }
    >
      <Numbers />
    </RequiresPlatform>
  );
}
