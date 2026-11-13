"use client";

import { useState, type FormEvent } from "react";
import * as Button from "@/components/alignui/button";
import * as Checkbox from "@/components/alignui/checkbox";
import * as Input from "@/components/alignui/input";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import { Callout } from "@/components/settings/SettingsKit";
import type { ApiKeySummary } from "@/lib/publicApi/keys";
import { ALL_API_SCOPES, API_SCOPES, type ApiScope } from "@/lib/publicApi/scopes";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function when(iso: string | null): string {
  return iso ? dateFormat.format(new Date(iso)) : "Never";
}

/**
 * Settings → API keys: create, copy once, revoke. The key itself is only in
 * the create response, so it is shown until the person dismisses it and
 * never again (src/lib/publicApi/keys.ts).
 */
export function ApiKeysSettings({ initialKeys }: { initialKeys: ApiKeySummary[] }) {
  const dialogs = useDialogs();
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<ApiScope>>(() => new Set(ALL_API_SCOPES));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy("create");
    setError("");
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes: ALL_API_SCOPES.filter((scope) => scopes.has(scope)) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error || "Could not create the key.");
      setKeys((current) => [data.apiKey as ApiKeySummary, ...current]);
      setCreated({ key: data.key as string, name: (data.apiKey as ApiKeySummary).name });
      setCopied(false);
      setName("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(key: ApiKeySummary) {
    const confirmed = await dialogs.confirm({
      title: `Revoke ${key.name}?`,
      description: "Anything using this key stops working at once. This cannot be undone.",
      confirmLabel: "Revoke key",
      variant: "error",
    });
    if (!confirmed) return;
    setBusy(`revoke-${key.id}`);
    setError("");
    try {
      const res = await fetch(`/api/settings/api-keys/${key.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error || "Could not revoke the key.");
      const now = new Date().toISOString();
      setKeys((current) => current.map((k) => (k.id === key.id ? { ...k, revokedAt: k.revokedAt ?? now } : k)));
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
    } catch {
      setError("Could not copy. Select the key and copy it by hand.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Callout tone="info">
        A key acts for the whole organization, limited to what you tick when you create it. Send it as{" "}
        <code>Authorization: Bearer &lt;key&gt;</code> to <code>/api/v1/</code>, or use it to connect an AI assistant
        to <code>/api/mcp</code> without signing in (Settings → AI assistants).
      </Callout>
      {error && <Callout tone="error">{error}</Callout>}

      {created && (
        <Callout
          tone="success"
          title={`Copy the key for ${created.name} now`}
          action={
            <Button.Root variant="neutral" mode="ghost" size="xsmall" onClick={() => setCreated(null)}>
              Done
            </Button.Root>
          }
        >
          <p>It is shown only once. Store it in the other application&apos;s settings.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-bg-white-0 px-2.5 py-1.5 text-paragraph-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
              {created.key}
            </code>
            <Button.Root variant="primary" mode="filled" size="xsmall" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy"}
            </Button.Root>
          </div>
        </Callout>
      )}

      <Frame>
        <FrameHeader title="Create a key" description="Name it after what will use it, for example the app's name." />
        <FramePanel>
          <form onSubmit={create} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
            <Input.Root size="small" className="flex-1">
              <Input.Wrapper>
                <Input.Input
                  aria-label="Key name"
                  placeholder="Key name"
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Input.Wrapper>
            </Input.Root>
            <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={busy === "create" || !name.trim() || scopes.size === 0}>
              {busy === "create" ? "Creating…" : "Create key"}
            </Button.Root>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-label-xs text-text-sub-600">What the key may do</legend>
              {ALL_API_SCOPES.map((scope) => (
                <label key={scope} className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox.Root
                    className="mt-0.5"
                    checked={scopes.has(scope)}
                    onCheckedChange={(checked) => setScopes((current) => {
                      const next = new Set(current);
                      if (checked === true) next.add(scope);
                      else next.delete(scope);
                      return next;
                    })}
                  />
                  <span className="min-w-0">
                    <span className="block text-label-sm text-text-strong-950">
                      {API_SCOPES[scope].label} <code className="text-paragraph-xs text-text-soft-400">{scope}</code>
                    </span>
                    <span className="block text-paragraph-xs text-text-sub-600">{API_SCOPES[scope].description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </form>
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title="Keys" description={`${keys.filter((k) => !k.revokedAt).length} active`} />
        <FramePanel>
          {keys.length === 0 ? (
            <p className="text-paragraph-sm text-text-sub-600">No keys yet.</p>
          ) : (
            <ul className="divide-y divide-stroke-soft-200">
              {keys.map((key) => (
                <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-label-sm text-text-strong-950">
                      {key.name}
                      {key.revokedAt && <span className="ml-2 text-paragraph-xs text-text-soft-400">Revoked</span>}
                    </p>
                    <p className="text-paragraph-xs text-text-sub-600">
                      <code>{key.keyPrefix}…</code> · Created {when(key.createdAt)} · Last used {when(key.lastUsedAt)}
                    </p>
                    <p className="text-paragraph-xs text-text-soft-400">
                      {key.scopes.length === ALL_API_SCOPES.length
                        ? "Full access"
                        : key.scopes.map((scope) => API_SCOPES[scope].label).join(" · ") || "No access"}
                    </p>
                  </div>
                  {!key.revokedAt && (
                    <Button.Root
                      variant="error"
                      mode="ghost"
                      size="xsmall"
                      disabled={busy === `revoke-${key.id}`}
                      onClick={() => void revoke(key)}
                    >
                      Revoke
                    </Button.Root>
                  )}
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>
    </div>
  );
}
