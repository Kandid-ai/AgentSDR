import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth/server";

/**
 * RFC 8414 authorization server metadata (endpoints, PKCE, registration) for
 * MCP clients. The issuer is <app>/api/auth, so clients ask for
 * /.well-known/oauth-authorization-server/api/auth; Better Auth can only serve
 * it under its own base path, so it is exposed at the root here. Public in
 * proxy.ts.
 */
export const dynamic = "force-dynamic";

export const GET = oauthProviderAuthServerMetadata(auth);
