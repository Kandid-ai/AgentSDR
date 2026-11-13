"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";

export type OAuthClientInfo = { name: string | null; logo: string | null };

/** The connecting application's public name and logo, for display only; null fields when it cannot be read. */
export function useOAuthClient(clientId: string | null): OAuthClientInfo & { loaded: boolean } {
  const [info, setInfo] = useState<(OAuthClientInfo & { for: string | null }) | null>(null);
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    authClient.oauth2
      .publicClient({ query: { client_id: clientId } })
      .then(({ data }) => {
        const d = data as { client_name?: unknown; logo_uri?: unknown } | null;
        if (cancelled) return;
        setInfo({
          for: clientId,
          name: typeof d?.client_name === "string" && d.client_name ? d.client_name : null,
          logo: typeof d?.logo_uri === "string" && /^https:\/\//.test(d.logo_uri) ? d.logo_uri : null,
        });
      })
      .catch(() => {
        if (!cancelled) setInfo({ for: clientId, name: null, logo: null });
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);
  const ready = info !== null && info.for === clientId;
  return { name: ready ? info.name : null, logo: ready ? info.logo : null, loaded: ready || !clientId };
}
