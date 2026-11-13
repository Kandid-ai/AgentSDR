import { withOrgContext, authContextErrorResponse } from "@/lib/auth/context";
import { listMcpConnections, revokeMcpConnection } from "@/lib/mcp/connections";

/**
 * The signed-in person's own AI-assistant connections to the active
 * organization (Settings → AI assistants). Any member manages their own;
 * nobody sees or revokes another person's.
 *
 * GET → { connections: McpConnection[] }
 * DELETE { clientId } → { revoked: boolean }
 */

export async function GET(request: Request) {
  try {
    return await withOrgContext(request, async (ctx) =>
      Response.json({ connections: await listMcpConnections(ctx.userId, ctx.organizationId) }),
    );
  } catch (error) {
    return authContextErrorResponse(error) ?? Response.json({ error: "Could not load connections" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    return await withOrgContext(request, async (ctx) => {
      const body = (await request.json().catch(() => null)) as { clientId?: unknown } | null;
      const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
      if (!clientId || clientId.length > 2048) return Response.json({ error: "clientId is required" }, { status: 400 });
      return Response.json({ revoked: await revokeMcpConnection(ctx.userId, ctx.organizationId, clientId) });
    });
  } catch (error) {
    return authContextErrorResponse(error) ?? Response.json({ error: "Could not disconnect" }, { status: 500 });
  }
}
