"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, SecondaryButton } from "@/components/auth/fields";
import { useOAuthClient } from "@/components/oauth/useOAuthClient";
import { API_SCOPES, MCP_SCOPES, type ApiScope } from "@/lib/publicApi/scopes";

/** crm:read is what a connection is for; the others the person may withhold. */
const REQUIRED_SCOPE: ApiScope = "crm:read";

export function ConsentForm({
  clientId,
  returnsTo,
  requestedScope,
  userName,
  userEmail,
  organizationName,
}: {
  clientId: string | null;
  /** Host the browser returns to after Allow — names, unlike hosts, can be claimed by anyone. */
  returnsTo: string | null;
  /** The `scope` the client asked for, space-separated. */
  requestedScope: string;
  userName: string;
  userEmail: string;
  organizationName: string;
}) {
  const client = useOAuthClient(clientId);
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState("");
  const appName = client.name ?? "An AI assistant";
  const requested = requestedScope.split(/\s+/).filter(Boolean);
  const offered = MCP_SCOPES.filter((scope) => requested.includes(scope));
  const [granted, setGranted] = useState<Set<ApiScope>>(() => new Set(offered));
  const toggle = (scope: ApiScope) =>
    setGranted((current) => {
      const next = new Set(current);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });

  async function answer(accept: boolean) {
    setPending(accept ? "allow" : "deny");
    setError("");
    // Identity scopes (openid, offline_access, …) pass through; AgentSDR's are as ticked.
    const scope = requested.filter((value) => !(MCP_SCOPES as readonly string[]).includes(value) || granted.has(value as ApiScope)).join(" ");
    const { data, error: err } = await authClient.oauth2.consent(accept ? { accept, scope } : { accept });
    const next = data as { redirect?: boolean; url?: unknown } | null;
    if (err || !next || typeof next.url !== "string") {
      setError(err?.message || "Something went wrong. Please try again.");
      setPending(null);
      return;
    }
    window.location.href = next.url;
  }

  return (
    <AuthShell title={`${appName} wants to connect to AgentSDR`}>
      <div className="flex flex-col gap-5">
        {client.logo && (
          // eslint-disable-next-line @next/next/no-img-element -- a third party's logo, arbitrary host
          <img src={client.logo} alt="" className="mx-auto -mt-3 size-12 rounded-xl object-cover" />
        )}
        <dl className="rounded-lg border border-white/12 bg-white/[0.03] px-4 py-3 text-sm">
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-zinc-400">Signed in as</dt>
            <dd className="min-w-0 truncate text-right text-zinc-100">{userName || userEmail}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-zinc-400">Organization</dt>
            <dd className="min-w-0 truncate text-right text-zinc-100">{organizationName}</dd>
          </div>
          {returnsTo && (
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-zinc-400">Returns to</dt>
              <dd className="min-w-0 truncate text-right font-mono text-xs leading-5 text-zinc-100">{returnsTo}</dd>
            </div>
          )}
        </dl>
        <div>
          <p className="text-sm font-medium text-zinc-100">It will be able to:</p>
          {offered.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-300">Only see who you are — it did not ask for access to AgentSDR data.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {offered.map((scope) => {
                const required = scope === REQUIRED_SCOPE;
                return (
                  <li key={scope}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 px-3 py-2.5 has-[:disabled]:cursor-default">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-[#335cff]"
                        checked={required || granted.has(scope)}
                        disabled={required || pending !== null}
                        onChange={() => toggle(scope)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-zinc-100">
                          {API_SCOPES[scope].label}
                          {required && <span className="ml-1.5 text-xs text-zinc-500">required</span>}
                        </span>
                        <span className="block text-xs text-zinc-400">{API_SCOPES[scope].description}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-zinc-400">
            Only allow this if you started connecting {appName} yourself just now.{" "}
            Every action is recorded in the CRM timeline as {userName || userEmail} via AI assistant. You can disconnect it
            anytime in Settings → AI assistants.
          </p>
        </div>
        {error && <ErrorCallout>{error}</ErrorCallout>}
        <div className="flex flex-col gap-3 pt-1">
          <button
            type="button"
            onClick={() => void answer(true)}
            disabled={pending !== null}
            className="h-11 w-full rounded-lg bg-zinc-100 text-sm font-medium text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335cff]/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === "allow" ? "Connecting..." : "Allow"}
          </button>
          <SecondaryButton onClick={() => void answer(false)} disabled={pending !== null} loading={pending === "deny"}>
            Cancel
          </SecondaryButton>
        </div>
      </div>
    </AuthShell>
  );
}
