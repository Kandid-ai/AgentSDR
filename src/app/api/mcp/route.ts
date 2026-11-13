import { requireMcpAuth } from "@better-auth/mcp";
import { auth } from "@/lib/auth/server";
import { callerFromAccessToken, callerFromApiKey, isApiKeyAuthorization, type McpCaller } from "@/lib/mcp/caller";
import { mcpResourceUrl } from "@/lib/mcp/oauth";
import { MCP_SCOPES } from "@/lib/publicApi/scopes";
import { mcpHandler } from "@/lib/mcp/server";

/**
 * The MCP endpoint (Streamable HTTP, stateless). Public in proxy.ts: it never
 * reads the site cookie. Two ways in, both resolving to ONE organization:
 *
 * - An OAuth access token from AgentSDR's own sign-in (Claude, Claude Desktop,
 *   Claude Code: "Connect" opens the browser). Verified by @better-auth/mcp —
 *   signature, issuer, audience = this URL, expiry — then the person's
 *   membership of the token's organization is re-checked on every request.
 *   Unauthenticated requests get the RFC 9728 challenge that starts the flow.
 * - An organization API key (`Bearer asdr_…`, Settings → API keys) for
 *   headless setups.
 *
 * Either way the caller carries scopes (crm:read, crm:write, crm:send); the
 * server lists and runs only the tools those allow.
 *
 * The resolved caller rides to the tools on `authInfo.extra.caller`; each
 * tool runs inside runInOrganization for it (src/lib/mcp/tools/).
 */

export const dynamic = "force-dynamic";

function jsonRpcError(status: number, message: string, headers?: HeadersInit): Response {
  return Response.json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }, { status, headers });
}

function serve(request: Request, caller: McpCaller, token: string, clientId: string): Promise<Response> {
  return mcpHandler.fetch(request, { authInfo: { token, clientId, scopes: caller.scopes, extra: { caller } } });
}

const withOAuth = requireMcpAuth(
  auth,
  async (request, claims) => {
    const caller = await callerFromAccessToken(claims);
    if (!caller) {
      // 401 + invalid_token makes the client sign in again (RFC 6750).
      return jsonRpcError(401, "This AgentSDR connection was disconnected, or its account left the organization. Reconnect AgentSDR.", {
        "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${new URL("/.well-known/oauth-protected-resource/api/mcp", mcpResourceUrl())}"`,
      });
    }
    const token = request.headers.get("authorization")?.replace(/^(Bearer|DPoP)\s+/i, "") ?? "";
    const clientId = typeof claims.azp === "string" ? claims.azp : typeof claims.client_id === "string" ? claims.client_id : "unknown";
    return serve(request, caller, token, clientId);
  },
  {
    resource: mcpResourceUrl(),
    // Every tool needs at least read access; a token without it gets a 403
    // insufficient_scope challenge, so the client can ask again.
    requiredScopes: ["crm:read"],
    // What clients should request: everything, plus a refresh token. The
    // person narrows it on the consent screen (crm:write, crm:send optional).
    challengeScopes: [...MCP_SCOPES, "offline_access"],
  },
);

export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization");
  if (isApiKeyAuthorization(authorization)) {
    const caller = await callerFromApiKey(authorization);
    if (!caller) return jsonRpcError(401, "Invalid or revoked API key.", { "WWW-Authenticate": 'Bearer error="invalid_token"' });
    return serve(request, caller, authorization!.replace(/^Bearer\s+/i, "").trim(), "api-key");
  }
  return withOAuth(request);
}

/** Stateless server: no standalone SSE stream and no sessions to end. */
function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
