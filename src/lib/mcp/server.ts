import "server-only";

import { createMcpHandler, McpServer, type McpRequestContext } from "@modelcontextprotocol/server";
import type { McpCaller } from "./caller";
import { appBaseUrl } from "./oauth";
import { registerCrmTools } from "./tools/crm";

/**
 * AgentSDR's MCP server: AI assistants (Claude, Claude Desktop, Claude Code,
 * any MCP client) work the CRM's Action required queue as a person on the
 * team would. Served statelessly at /api/mcp (src/app/api/mcp/route.ts): each
 * request gets a fresh McpServer from this factory, so nothing is held between
 * requests and any instance can answer.
 *
 * Tools live in ./tools/ by area — `crm_*` today; campaigns and the rest of
 * the app can follow as their own files registered here.
 */

export const MCP_SERVER_VERSION = "1.0.0";

/** What every connected assistant is told up front: how the CRM works and how to act in it safely. */
export const MCP_INSTRUCTIONS = `AgentSDR is a sales outreach platform. These tools work its CRM, where every lead who replied to outreach (email, LinkedIn, WhatsApp) has a record. The "Action required" queue is what the team has to do next.

Typical flow:
1. crm_list_action_required — see the queue (counts per group, newest first). Use \`search\` to find a person or company.
2. crm_get_record — read the whole thread, the lead's details and the AI's draft before deciding anything.
3. Act: review the AI's draft (crm_update_draft / crm_regenerate_draft) and send it (crm_send_draft), or write one (crm_write_draft); confirm or correct the AI's reading of a reply (crm_review_classification); move the stage when something happened (crm_move_stage); snooze, close, or mark Do Not Contact.

Rules:
- Sending is real and cannot be undone. Unless the user explicitly asked you to send without checking, show them the exact text (and who it goes to) and wait for a yes before crm_send_draft.
- Write as the sender, in the thread's language and tone. Never invent facts, prices, meetings or promises that are not in the thread, the record or what the user told you.
- Ids come only from these tools. Drafts carry a \`revision\` and records a \`contextVersion\`; if a call says the record or draft changed, read it again and retry with the new value — do not guess.
- Stage = category (customer, interested, not_interested, other) plus an optional sub-stage from crm_list_stages. Sending a reply or moving a stage starts that stage's follow-up sequence automatically.
- "Do Not Contact" stops every channel for that person; only set it when they asked to stop or the user says so.
- Each record has a \`url\` that opens it in AgentSDR; share it when the user may want to look themselves.`;

/** Each request's server lists only what its caller's scopes allow (src/lib/publicApi/scopes.ts). */
function buildServer(context: McpRequestContext): McpServer {
  const caller = context.authInfo?.extra?.caller as McpCaller | undefined;
  const server = new McpServer(
    {
      name: "agentsdr",
      title: "AgentSDR",
      version: MCP_SERVER_VERSION,
      description:
        "Work your AgentSDR CRM from chat: the Action required queue, lead threads across email, LinkedIn and WhatsApp, AI drafts, stages and follow-ups.",
      websiteUrl: "https://agentsdr.ai/mcp",
      // Clients that show an app icon (ChatGPT, Claude) read these; served by this app.
      icons: [
        { src: `${appBaseUrl()}/icon.svg`, mimeType: "image/svg+xml", sizes: ["any"] },
        { src: `${appBaseUrl()}/apple-icon.png`, mimeType: "image/png", sizes: ["180x180"] },
      ],
    },
    { instructions: MCP_INSTRUCTIONS },
  );
  registerCrmTools(server, caller?.scopes ?? []);
  return server;
}

/**
 * One handler for the process. It serves both the 2026-07-28 protocol and
 * 2025-era clients (`legacy: "stateless"`, the default), since MCP clients in
 * the wild still speak both.
 */
export const mcpHandler = createMcpHandler(buildServer, {
  onerror: (error) => console.error("[mcp] request error:", error),
});
