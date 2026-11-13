import "server-only";

import { and, desc, eq, isNull, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { oauthAccessTokens, oauthClients, oauthConsents, oauthRefreshTokens } from "@/lib/auth/schema";

/**
 * A person's AI-assistant connections (Claude, Claude Code, …) to one
 * organization: the OAuth consents they gave, with the client that holds
 * each. Revoking one deletes the consent and revokes its tokens; the MCP
 * route refuses any token whose consent is gone (callerFromAccessToken), so it
 * stops at once rather than when the last access token expires.
 */

export type McpConnection = {
  clientId: string;
  name: string;
  uri: string | null;
  icon: string | null;
  connectedAt: string | null;
  lastActiveAt: string | null;
};

export async function listMcpConnections(userId: string, organizationId: string): Promise<McpConnection[]> {
  const rows = await db
    .select({
      clientId: oauthConsents.clientId,
      name: oauthClients.name,
      uri: oauthClients.uri,
      icon: oauthClients.icon,
      connectedAt: oauthConsents.createdAt,
      lastActiveAt: max(oauthRefreshTokens.createdAt),
    })
    .from(oauthConsents)
    .innerJoin(oauthClients, eq(oauthClients.clientId, oauthConsents.clientId))
    .leftJoin(
      oauthRefreshTokens,
      and(
        eq(oauthRefreshTokens.clientId, oauthConsents.clientId),
        eq(oauthRefreshTokens.userId, userId),
        eq(oauthRefreshTokens.referenceId, organizationId),
      ),
    )
    .where(and(eq(oauthConsents.userId, userId), eq(oauthConsents.referenceId, organizationId)))
    .groupBy(oauthConsents.clientId, oauthClients.name, oauthClients.uri, oauthClients.icon, oauthConsents.createdAt)
    .orderBy(desc(oauthConsents.createdAt));
  return rows.map((row) => ({
    clientId: row.clientId,
    name: row.name?.trim() || clientNameFromId(row.clientId),
    uri: row.uri,
    icon: row.icon,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    lastActiveAt: row.lastActiveAt ? new Date(row.lastActiveAt).toISOString() : row.connectedAt?.toISOString() ?? null,
  }));
}

/** A readable name for a client that registered without one (a CIMD client id is a URL). */
function clientNameFromId(clientId: string): string {
  try {
    return new URL(clientId).hostname;
  } catch {
    return "AI assistant";
  }
}

/** Whether this person still has a live connection for `clientId` in the organization. */
export async function hasMcpConsent(userId: string, organizationId: string, clientId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: oauthConsents.id })
    .from(oauthConsents)
    .where(and(eq(oauthConsents.userId, userId), eq(oauthConsents.referenceId, organizationId), eq(oauthConsents.clientId, clientId)))
    .limit(1);
  return Boolean(row);
}

/** Disconnect one assistant: forget the consent and revoke every token it holds for this organization. */
export async function revokeMcpConnection(userId: string, organizationId: string, clientId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const deleted = await tx
      .delete(oauthConsents)
      .where(and(eq(oauthConsents.userId, userId), eq(oauthConsents.referenceId, organizationId), eq(oauthConsents.clientId, clientId)))
      .returning({ id: oauthConsents.id });
    const forThisConnection = <T extends typeof oauthRefreshTokens | typeof oauthAccessTokens>(table: T) =>
      and(eq(table.userId, userId), eq(table.referenceId, organizationId), eq(table.clientId, clientId), isNull(table.revoked));
    await tx.update(oauthRefreshTokens).set({ revoked: now }).where(forThisConnection(oauthRefreshTokens));
    await tx.update(oauthAccessTokens).set({ revoked: now }).where(forThisConnection(oauthAccessTokens));
    return deleted.length > 0;
  });
}
