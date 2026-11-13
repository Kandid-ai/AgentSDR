import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth/server";

/** OpenID discovery, for MCP clients that look here instead of RFC 8414 metadata. Public in proxy.ts. */
export const dynamic = "force-dynamic";

export const GET = oauthProviderOpenIdConfigMetadata(auth);
