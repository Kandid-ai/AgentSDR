import "server-only";

import { asc, eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";
import { members } from "@/lib/auth/schema";

/**
 * How an OAuth connection (Claude, Claude Code, …) is tied to ONE
 * organization: the person picks it at sign-in (/oauth/organization, when
 * they belong to several), it becomes the consent's `referenceId`, and every
 * access token carries it as {@link ORGANIZATION_CLAIM}. The MCP route then
 * re-checks the membership on every request, so removing someone from an
 * organization cuts their connection at once, whatever the token says.
 */

/** Access-token claim holding the organization id the connection works in. */
export const ORGANIZATION_CLAIM = "organization_id";

/** Where the sign-in flow asks which organization to connect. */
export const ORGANIZATION_PICKER_PAGE = "/oauth/organization";

/** The canonical public URL of this app (no trailing slash). */
export function appBaseUrl(): string {
  const raw = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** The MCP resource identifier: tokens are audience-bound to exactly this URL. */
export function mcpResourceUrl(): string {
  return `${appBaseUrl()}/api/mcp`;
}

async function organizationIdsOf(userId: string): Promise<string[]> {
  const rows = await db
    .select({ organizationId: members.organizationId })
    .from(members)
    .where(eq(members.userId, userId))
    .orderBy(asc(members.createdAt));
  return rows.map((row) => row.organizationId);
}

type FlowContext = {
  user: { id: string };
  session: { activeOrganizationId?: string | null } & Record<string, unknown>;
  isContinuation?: boolean;
};

/**
 * `postLogin.shouldRedirect`: whether to show the organization picker before
 * consent. Someone in one organization never sees it; someone in several
 * always does (the active one in their browser tab is not necessarily the one
 * they want Claude in). On return, the session's active organization must be
 * one of theirs.
 */
export async function needsOrganizationChoice({ user, session, isContinuation }: FlowContext): Promise<boolean> {
  const organizationIds = await organizationIdsOf(user.id);
  if (isContinuation) {
    const chosen = session.activeOrganizationId ?? null;
    return !(chosen && organizationIds.includes(chosen));
  }
  return organizationIds.length !== 1;
}

/** `postLogin.consentReferenceId`: the organization the connection is for. Fails closed. */
export async function connectionOrganizationId({ user, session }: FlowContext): Promise<string> {
  const organizationIds = await organizationIdsOf(user.id);
  const active = session.activeOrganizationId ?? null;
  if (active && organizationIds.includes(active)) return active;
  if (organizationIds.length === 1) return organizationIds[0];
  throw new APIError("FORBIDDEN", {
    message:
      organizationIds.length === 0
        ? "Your account does not belong to any organization yet."
        : "Choose the organization to connect first.",
  });
}
