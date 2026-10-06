import { NextRequest, NextResponse } from "next/server";
import { listOpenRouterByokCatalog, listOpenRouterByokCatalogCached } from "@/lib/ai/server/openrouter";
import { getByokSettings } from "@/lib/ai/byok";
import { getAiConnection, getAiCredentials } from "@/lib/ai/connections";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

export async function GET(request: NextRequest) {
  try {
    return await withOrgContext(request, async () => {
      try {
        const settings = await getByokSettings();
        const connectionId = request.nextUrl.searchParams.get("connectionId") ?? settings.connectionId;
        if (!connectionId) return NextResponse.json({ providers: [], models: [], settings });
        const connection = await getAiConnection(connectionId);
        const credentials = connection?.verified ? await getAiCredentials(connection.id) : null;
        if (!connection || connection.providerKey !== "openrouter" || !credentials?.apiKey || !credentials.managementKey) {
          return NextResponse.json({ error: "Reconnect OpenRouter in AI Settings" }, { status: 409 });
        }
        // AI Settings (?all=1) must see a key added on OpenRouter right away;
        // the column dialog's picker can take the cached catalog.
        const providers = request.nextUrl.searchParams.has("all")
          ? await listOpenRouterByokCatalog(credentials.managementKey)
          : await listOpenRouterByokCatalogCached(credentials.managementKey);
        const enabled = providers.flatMap((provider) => {
          const selected = new Set(settings.modelsByProvider[provider.slug] ?? []);
          return provider.models
            .filter((model) => settings.providers.includes(provider.slug) && selected.has(model.id))
            .map((model) => ({ ...model, provider: provider.slug, providerName: provider.name }));
        });
        return NextResponse.json({ providers, models: enabled, settings });
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not fetch OpenRouter models" }, { status: 502 });
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
