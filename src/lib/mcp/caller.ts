import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { members, users } from "@/lib/auth/schema";
import { organizationForApiKey } from "@/lib/publicApi/keys";
import { scopesFromClaim, type ApiScope } from "@/lib/publicApi/scopes";
import { API_KEY_PREFIX } from "@/lib/publicApi/token";
import { hasMcpConsent } from "./connections";
import { ORGANIZATION_CLAIM } from "./oauth";

/**
 * Who is calling the MCP server, resolved once per HTTP request and handed to
 * every tool through `authInfo.extra`. A caller is always inside exactly one
 * organization; the tools run in `runInOrganization(caller.organizationId)`.
 *
 * - `oauth`: a person who connected Claude (or another MCP client) through
 *   AgentSDR's sign-in. Their membership is re-read on every request.
 * - `api_key`: an organization API key (Settings → API keys), for headless
 *   setups such as a shared `.mcp.json`. It acts as the organization, not a
 *   person, so actions are attributed to the key.
 */
export type McpCaller = {
  kind: "oauth" | "api_key";
  organizationId: string;
  /** The person, for OAuth; null for an API key. */
  userId: string | null;
  /**
   * How events written by this caller name it (crm_events.actor_ref). The
   * record timeline shows it verbatim, so it is a name, not an id.
   */
  actorRef: string;
  /** For the server's greeting and logs. */
  label: string;
  /**
   * What this connection may do (src/lib/publicApi/scopes.ts): granted on the
   * consent screen for OAuth, chosen at creation for an API key. Tools it
   * lacks the scope for are not listed and refuse to run.
   */
  scopes: ApiScope[];
};

/** True when the Authorization header carries an AgentSDR API key rather than an OAuth token. */
export function isApiKeyAuthorization(header: string | null): boolean {
  return Boolean(header && /^Bearer\s+/i.test(header) && header.replace(/^Bearer\s+/i, "").trim().startsWith(API_KEY_PREFIX));
}

export async function callerFromApiKey(authorization: string | null): Promise<McpCaller | null> {
  const key = await organizationForApiKey(authorization);
  if (!key) return null;
  const label = `API key "${key.name}"`;
  return {
    kind: "api_key",
    organizationId: key.organizationId,
    userId: null,
    actorRef: `${label} via AI assistant`,
    label,
    scopes: key.scopes,
  };
}

/**
 * The caller behind a verified OAuth access token, or null when the token's
 * person is no longer a member of the organization it was issued for (removed
 * since, or a token without the organization claim), or they disconnected
 * that assistant in Settings (its consent is gone).
 */
export async function callerFromAccessToken(claims: Record<string, unknown>): Promise<McpCaller | null> {
  const userId = typeof claims.sub === "string" ? claims.sub : null;
  const organizationId = typeof claims[ORGANIZATION_CLAIM] === "string" ? (claims[ORGANIZATION_CLAIM] as string) : null;
  const clientId = typeof claims.azp === "string" ? claims.azp : null;
  if (!userId || !organizationId || !clientId) return null;
  if (!(await hasMcpConsent(userId, organizationId, clientId))) return null;
  const [membership] = await db
    .select({ name: users.name, email: users.email })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)))
    .limit(1);
  if (!membership) return null;
  const label = membership.name || membership.email;
  return {
    kind: "oauth",
    organizationId,
    userId,
    actorRef: `${label} via AI assistant`,
    label,
    scopes: scopesFromClaim(claims.scope),
  };
}
