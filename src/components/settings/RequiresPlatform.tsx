import Link from "next/link";
import type { ReactNode } from "react";
import { RiPlugLine } from "@remixicon/react";

import * as Button from "@/components/alignui/button";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { EmptyState } from "@/components/page/EmptyState";
import { getPlatformIntegration, PLATFORM_SETTINGS_HREF, type PlatformKey } from "@/lib/platform/catalog";
import { requirePageOrgContext } from "@/lib/auth/context";
import { isPlatformConnected } from "@/lib/platform/credentials";
import { runInOrganization } from "@/lib/tenancy/scope";

/**
 * Renders `children` while the platform integration is connected, otherwise a
 * "Connect X" prompt linking to the integration's Connection page in Settings
 * (`settingsHref` overrides it, e.g. WhatsApp's for Unipile). Reads the database,
 * so the page using it must be dynamic. Resolves the page's organization
 * itself, so callers need no scope.
 */
export async function RequiresPlatform({
  platform,
  children,
  fallback,
  settingsHref,
}: {
  platform: PlatformKey;
  settingsHref?: string;
  children: ReactNode;
  /** Replaces the Connect prompt — `null` to render nothing (e.g. for a header action). */
  fallback?: ReactNode;
}) {
  const ctx = await requirePageOrgContext();
  const connected = await runInOrganization(ctx.organizationId, () => isPlatformConnected(platform));
  if (connected) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;

  const integration = getPlatformIntegration(platform);
  const name = integration?.name ?? "this integration";

  return (
    <Frame className="mx-auto max-w-2xl">
      <FramePanel>
        <EmptyState
          icon={RiPlugLine}
          title={`Connect ${name} to use this`}
          description={
            integration
              ? `${name} powers ${integration.enables.join(" and ").toLowerCase()}. Add its credentials once and this unlocks.`
              : undefined
          }
          action={
            <Button.Root asChild variant="primary" mode="filled" size="small">
              <Link href={settingsHref ?? PLATFORM_SETTINGS_HREF[platform]}>Connect {name}</Link>
            </Button.Root>
          }
        />
      </FramePanel>
    </Frame>
  );
}
