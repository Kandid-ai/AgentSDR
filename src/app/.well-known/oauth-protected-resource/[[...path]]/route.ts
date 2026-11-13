import { auth } from "@/lib/auth/server";

/**
 * RFC 9728 protected resource metadata for the MCP server (/api/mcp): which
 * authorization server issues its tokens. MCP clients read it at
 * /.well-known/oauth-protected-resource/api/mcp (and the bare path). The
 * @better-auth/mcp plugin answers it; Better Auth lives under /api/auth, so
 * this root path is handed to it here. Public in proxy.ts.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return auth.handler(request);
}
