import { describe, expect, test } from "bun:test";
import { isApiKeyAuthorization } from "./caller";
import { mcpHandler } from "./server";

/**
 * The MCP surface as a client sees it, without a database: the tool list and
 * its safety annotations, and how a call with no authenticated caller fails.
 * Tool behaviour against data is exercised through the lib functions' own
 * tests, which these tools call unchanged.
 */

let nextId = 0;
async function rpc(method: string, params: unknown, extra?: Record<string, unknown>) {
  const response = await mcpHandler.fetch(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++nextId, method, params }),
    }),
    extra ? { authInfo: { token: "t", clientId: "test", scopes: [], extra } } : undefined,
  );
  const text = await response.text();
  const body = text.trim().startsWith("{") ? text : text.split("\n").find((line) => line.startsWith("data:"))!.slice(5);
  return JSON.parse(body) as { result?: Record<string, unknown>; error?: { message: string } };
}

const FULL = { kind: "oauth", organizationId: "00000000-0000-4000-8000-000000000000", userId: null, actorRef: "test", label: "test", scopes: ["crm:read", "crm:write", "crm:send"] };
const READ_ONLY = { ...FULL, scopes: ["crm:read"] };

type Tool = { name: string; description: string; annotations: Record<string, boolean>; inputSchema: { properties?: Record<string, unknown> } };

describe("AgentSDR MCP server", () => {
  test("introduces itself with instructions", async () => {
    const { result } = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    expect((result!.serverInfo as { name: string }).name).toBe("agentsdr");
    expect(result!.instructions).toContain("crm_list_records");
    expect(result!.instructions).toContain("crm_get_writing_guide");
    expect(result!.instructions).toContain("cannot be undone");
  });

  test("lists the CRM tools, each annotated", async () => {
    const { result } = await rpc("tools/list", {}, { caller: FULL });
    const tools = result!.tools as Tool[];
    const names = tools.map((tool) => tool.name).sort();
    expect(names).toEqual([
      "crm_close_record",
      "crm_discard_draft",
      "crm_get_call",
      "crm_get_knowledge",
      "crm_get_record",
      "crm_get_writing_guide",
      "crm_list_records",
      "crm_list_stages",
      "crm_move_stage",
      "crm_regenerate_draft",
      "crm_review_classification",
      "crm_send_draft",
      "crm_set_do_not_contact",
      "crm_snooze",
      "crm_update_draft",
      "crm_write_draft",
    ]);
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(40);
      expect(typeof tool.annotations.readOnlyHint).toBe("boolean");
      expect(typeof tool.annotations.destructiveHint).toBe("boolean");
    }
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    const readOnly = tools.filter((tool) => tool.annotations.readOnlyHint).map((tool) => tool.name).sort();
    expect(readOnly).toEqual([
      "crm_get_call",
      "crm_get_knowledge",
      "crm_get_record",
      "crm_get_writing_guide",
      "crm_list_records",
      "crm_list_stages",
    ]);
    // Sending reaches outside AgentSDR and cannot be taken back.
    expect(byName.get("crm_send_draft")!.annotations).toMatchObject({ destructiveHint: true, openWorldHint: true });
    expect(Object.keys(byName.get("crm_send_draft")!.inputSchema.properties ?? {})).toContain("revision");
  });

  test("a read-only connection sees and runs only the read tools", async () => {
    const { result } = await rpc("tools/list", {}, { caller: READ_ONLY });
    expect((result!.tools as Tool[]).map((tool) => tool.name).sort()).toEqual([
      "crm_get_call",
      "crm_get_knowledge",
      "crm_get_record",
      "crm_get_writing_guide",
      "crm_list_records",
      "crm_list_stages",
    ]);
    const send = await rpc(
      "tools/call",
      { name: "crm_send_draft", arguments: { draftId: "00000000-0000-4000-8000-000000000000", revision: 1 } },
      { caller: READ_ONLY },
    );
    expect(send.error ?? send.result?.isError).toBeTruthy();
  });

  test("without a caller no tool is listed or runs", async () => {
    const { result } = await rpc("tools/list", {});
    expect(result!.tools).toEqual([]);
  });

  test("a call that reaches a tool without a caller is refused", async () => {
    const { result, error } = await rpc("tools/call", { name: "crm_list_stages", arguments: {} });
    expect(error ?? result?.isError).toBeTruthy();
  });

  test("list filters that belong to another view are refused before any query", async () => {
    const { result } = await rpc("tools/call", { name: "crm_list_records", arguments: { view: "open", group: "reply" } }, { caller: FULL });
    expect(result!.isError).toBe(true);
    expect(JSON.stringify(result!.content)).toContain("only applies to view action_required");
  });

  test("bad arguments come back as a readable tool error", async () => {
    const { result } = await rpc("tools/call", { name: "crm_get_record", arguments: { recordId: "not-a-uuid" } }, { caller: FULL });
    expect(result!.isError).toBe(true);
    expect(JSON.stringify(result!.content)).toContain("recordId must be a UUID");
  });
});

describe("isApiKeyAuthorization", () => {
  test("tells API keys from OAuth tokens", () => {
    expect(isApiKeyAuthorization("Bearer asdr_abc")).toBe(true);
    expect(isApiKeyAuthorization("bearer   asdr_abc")).toBe(true);
    expect(isApiKeyAuthorization("Bearer eyJhbGciOi.jwt")).toBe(false);
    expect(isApiKeyAuthorization(null)).toBe(false);
  });
});
