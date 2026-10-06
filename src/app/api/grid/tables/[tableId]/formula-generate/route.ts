import { NextRequest, NextResponse } from "next/server";
import { FormulaGeneratorUnavailableError, generateFormula } from "@/lib/grid/formula-generator";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ tableId: string }> }) {
  try {
    return await withOrgContext(request, async () => {
      const { tableId } = await params;
      let body: { prompt?: string; currentExpression?: string };
      try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
      const prompt = body.prompt?.trim() ?? "";
      if (!prompt) return NextResponse.json({ error: "Describe the formula you want" }, { status: 400 });
      if (prompt.length > 2_000 || (body.currentExpression?.length ?? 0) > 10_000) return NextResponse.json({ error: "Formula request is too long" }, { status: 400 });
      try {
        return NextResponse.json(await generateFormula(tableId, prompt, body.currentExpression));
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : "Could not generate formula";
        const connectionFailure = /connection error|unable to connect|fetch failed|could not resolve/i.test(rawMessage);
        const message = connectionFailure
          ? "Could not reach the AI formula service. Check the configured OpenAI/Azure endpoint."
          : rawMessage;
        return NextResponse.json(
          { error: message },
          { status: error instanceof FormulaGeneratorUnavailableError ? 503 : connectionFailure ? 502 : 422 },
        );
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
