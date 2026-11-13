"use client";

import { useCallback, useEffect, useState } from "react";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import { Callout } from "@/components/settings/SettingsKit";
import { cn } from "@/utils/cn";

type Connection = {
  clientId: string;
  name: string | null;
  uri: string | null;
  icon: string | null;
  connectedAt: string | null;
  lastActiveAt: string | null;
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function relative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button.Root
      variant="neutral"
      mode="stroke"
      size="xsmall"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : label}
    </Button.Root>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-bg-weak-50 px-3 py-2 text-paragraph-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
        <code>{text}</code>
      </pre>
      <CopyButton text={text} />
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-paragraph-sm text-text-sub-600">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-bg-weak-50 text-label-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">{item}</div>
        </li>
      ))}
    </ol>
  );
}

const TABS = [
  { id: "claude", label: "Claude (web & desktop)" },
  { id: "code", label: "Claude Code" },
  { id: "other", label: "Other clients" },
] as const;

const PROMPTS = [
  "Summarise my Action required queue",
  "Draft replies for everyone who asked for pricing — show me before sending",
  "Find Priya from Acme and tell me where the deal stands",
  "Mark the leads who said 'not now' to follow up next month",
];

export function AiAssistantsSettings({ serverUrl }: { serverUrl: string }) {
  const dialogs = useDialogs();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("claude");
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/ai-assistants", { credentials: "same-origin" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not load your connections.");
      setConnections((data?.connections ?? []) as Connection[]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your connections.");
      setConnections((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function disconnect(c: Connection) {
    const name = c.name || "this assistant";
    const confirmed = await dialogs.confirm({
      title: `Disconnect ${name}?`,
      description: "It stops working at once. You can connect it again whenever you like.",
      confirmLabel: "Disconnect",
      variant: "error",
    });
    if (!confirmed) return;
    setBusy(c.clientId);
    setError("");
    try {
      const res = await fetch("/api/settings/ai-assistants", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: c.clientId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setError(data?.error || "Could not disconnect.");
      else await load();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const mcpJson = JSON.stringify(
    { mcpServers: { agentsdr: { type: "http", url: serverUrl, headers: { Authorization: "Bearer ${AGENTSDR_API_KEY}" } } } },
    null,
    2,
  );

  return (
    <div className="flex flex-col gap-6">
      <Frame>
        <FrameHeader title="Your connections" description="Assistants that can work in this organization as you." />
        <FramePanel>
          {error && <Callout tone="error" className="mb-3">{error}</Callout>}
          {connections === null ? (
            <p className="text-paragraph-sm text-text-sub-600">Loading…</p>
          ) : connections.length === 0 ? (
            <p className="text-paragraph-sm text-text-sub-600">No assistants connected yet.</p>
          ) : (
            <ul className="divide-y divide-stroke-soft-200">
              {connections.map((c) => (
                <li key={c.clientId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    {c.icon && (
                      // eslint-disable-next-line @next/next/no-img-element -- a third party's logo, arbitrary host
                      <img src={c.icon} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-label-sm text-text-strong-950">{c.name || "AI assistant"}</p>
                      <p className="text-paragraph-xs text-text-sub-600">
                        Connected {c.connectedAt ? dateFormat.format(new Date(c.connectedAt)) : "earlier"} · Last active{" "}
                        {relative(c.lastActiveAt)}
                      </p>
                    </div>
                  </div>
                  <Button.Root variant="error" mode="ghost" size="xsmall" disabled={busy === c.clientId} onClick={() => void disconnect(c)}>
                    {busy === c.clientId ? "Disconnecting…" : "Disconnect"}
                  </Button.Root>
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title="Server URL" description="Paste this into Claude, ChatGPT or any MCP client to connect." />
        <FramePanel>
          <div className="flex items-center gap-2">
            <Input.Root size="small" className="flex-1">
              <Input.Wrapper>
                <Input.Input aria-label="MCP server URL" readOnly value={serverUrl} onFocus={(e) => e.currentTarget.select()} />
              </Input.Wrapper>
            </Input.Root>
            <CopyButton text={serverUrl} />
          </div>
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title="How to connect" description="Pick the app you use. Each takes about a minute." />
        <FramePanel>
          <div role="tablist" className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-label-sm ring-1 ring-inset transition-colors",
                  tab === t.id
                    ? "bg-bg-strong-950 text-text-white-0 ring-transparent"
                    : "bg-bg-white-0 text-text-sub-600 ring-stroke-soft-200 hover:bg-bg-weak-50",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "claude" && (
            <div className="flex flex-col gap-4">
              <Steps
                items={[
                  <>Open Claude and go to <b>Customize → Connectors</b> (also reachable from Settings).</>,
                  <>Choose <b>Add → Add custom connector</b>. Name it <b>AgentSDR</b>, paste the server URL above, and choose <b>Continue</b>.</>,
                  <>Once Claude has checked the server, choose <b>Add</b>, then <b>Connect</b>.</>,
                  <>Sign in to AgentSDR if asked, check the organization, and choose <b>Allow</b>.</>,
                  <>In a chat, switch AgentSDR on from the tools menu and ask, for example, &ldquo;What&apos;s in my Action required queue?&rdquo;</>,
                ]}
              />
              <Callout tone="info">
                On Claude Team and Enterprise plans, an owner must first add the connector under organization settings
                before members can connect it.
              </Callout>
            </div>
          )}

          {tab === "code" && (
            <Steps
              items={[
                <div key="a" className="flex flex-col gap-2">
                  <span>Run this in your terminal:</span>
                  <CodeBlock text={`claude mcp add --transport http agentsdr ${serverUrl}`} />
                </div>,
                <>Start Claude Code and run <code>/mcp</code>.</>,
                <>Select <b>agentsdr</b>, choose <b>Authenticate</b>, and your browser opens.</>,
                <>Sign in to AgentSDR if asked and choose <b>Allow</b>.</>,
              ]}
            />
          )}

          {tab === "other" && (
            <div className="flex flex-col gap-4 text-paragraph-sm text-text-sub-600">
              <p>
                Any client that supports remote MCP over Streamable HTTP with OAuth works with the same server URL, including
                ChatGPT (add AgentSDR as a custom app in its settings), Cursor and other editors.
              </p>
              <p>
                For a setup with no browser, an owner or admin can create an API key under <b>Settings → API keys</b> and
                send it as <code>Authorization: Bearer asdr_…</code>. A key acts as the whole organization, not as one
                person.
              </p>
              <CodeBlock text={mcpJson} />
            </div>
          )}
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title="Things to ask" />
        <FramePanel>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-paragraph-sm text-text-sub-600">
            {PROMPTS.map((p) => (
              <li key={p}>&ldquo;{p}&rdquo;</li>
            ))}
          </ul>
        </FramePanel>
      </Frame>
    </div>
  );
}
