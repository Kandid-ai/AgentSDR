"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, Spinner } from "@/components/auth/fields";
import { useOAuthClient } from "@/components/oauth/useOAuthClient";

export function OrganizationPicker({ clientId }: { clientId: string | null }) {
  const client = useOAuthClient(clientId);
  const { data: orgs, isPending } = authClient.useListOrganizations();
  const { data: active } = authClient.useActiveOrganization();
  const [choosing, setChoosing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const assistant = client.name ?? "your AI assistant";

  async function choose(organizationId: string) {
    setChoosing(organizationId);
    setError("");
    const set = await authClient.organization.setActive({ organizationId });
    if (set.error) {
      setError(set.error.message || "Could not switch organization.");
      setChoosing(null);
      return;
    }
    const { data, error: err } = await authClient.oauth2.continue({ postLogin: true });
    const next = data as { redirect?: boolean; url?: unknown } | null;
    if (err || !next || typeof next.url !== "string") {
      setError(err?.message || "Something went wrong. Please try again.");
      setChoosing(null);
      return;
    }
    window.location.assign(next.url);
  }

  return (
    <AuthShell title={`Which organization should ${assistant} work in?`} subtitle="You can connect another one later.">
      <div className="flex flex-col gap-3">
        {isPending && (
          <div className="flex justify-center py-4 text-zinc-400">
            <Spinner />
          </div>
        )}
        {!isPending && (orgs ?? []).length === 0 && <ErrorCallout>You are not a member of any organization yet.</ErrorCallout>}
        {(orgs ?? []).map((org) => (
          <button
            key={org.id}
            type="button"
            disabled={choosing !== null}
            onClick={() => void choose(org.id)}
            className="flex h-12 w-full items-center justify-between gap-3 rounded-lg border border-white/12 bg-white/[0.03] px-4 text-left text-sm font-medium text-zinc-100 transition-colors hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335cff]/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="min-w-0 truncate">{org.name}</span>
            {choosing === org.id ? (
              <Spinner />
            ) : (
              active?.id === org.id && <span className="shrink-0 text-xs font-normal text-zinc-400">Current</span>
            )}
          </button>
        ))}
        {error && <ErrorCallout>{error}</ErrorCallout>}
      </div>
    </AuthShell>
  );
}
