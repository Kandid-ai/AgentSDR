"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth/client";

/**
 * Keeps the signed-in frame honest in the browser: a visitor whose session
 * has ended goes to /sign-in, and a signed-in user with no active
 * organization goes to /onboarding. Navigation is a full load, so no
 * client-side cache from another session or organization survives it.
 *
 * This is convenience, not security — every API route and server page
 * checks the session and organization itself (src/lib/auth/context.ts).
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession();

  useEffect(() => {
    if (isPending) return;
    if (!data) {
      const from = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/sign-in?from=${encodeURIComponent(from)}`);
    } else if (!data.session.activeOrganizationId) {
      window.location.replace("/onboarding");
    }
  }, [data, isPending]);

  return <>{children}</>;
}
