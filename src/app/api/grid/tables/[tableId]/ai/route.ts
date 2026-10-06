import { NextRequest, NextResponse } from "next/server";
import { createAiColumns, updateAiColumns, type AiColumnInput } from "@/lib/grid/ai-columns";
import { getTable } from "@/lib/grid/tables";
import type { AiExample, AiOutputField, AiUseCase } from "@/lib/grid/types";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";

type Body = Partial<AiColumnInput> & { columnId?: string };

function read(body: Body): Omit<AiColumnInput, "tableId"> | string {
  if (!body.useCase) return "A use case is required";
  if (!body.providerKey || !body.modelKey) return "Select an AI model";
  if (!body.connectionId) return "Connect a provider account";
  if (typeof body.prompt !== "string" || !body.prompt.trim()) return "A prompt is required";

  const outputFormat = body.outputFormat === "json_schema" ? "json_schema" : "fields";
  if (outputFormat === "fields" && !Array.isArray(body.outputs)) {
    return "outputs must be an array";
  }

  return {
    useCase: body.useCase as AiUseCase,
    providerKey: body.providerKey,
    modelKey: body.modelKey,
    upstreamProvider: body.upstreamProvider,
    connectionId: body.connectionId,
    prompt: body.prompt,
    outputFormat,
    outputs: (body.outputs ?? []) as AiOutputField[],
    jsonSchema: body.jsonSchema,
    examples: (body.examples ?? []) as AiExample[],
    autoRun: body.autoRun ?? true,
    runCondition: body.runCondition,
    delaySeconds: body.delaySeconds,
    afterColumnId: body.afterColumnId,
    beforeColumnId: body.beforeColumnId,
  };
}

// POST /api/grid/tables/[tableId]/ai — creates a Use AI column and its outputs.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(request, async () => {
      const { tableId } = await params;
      if (!(await getTable(tableId))) {
        return NextResponse.json({ error: "table not found" }, { status: 404 });
      }

      let body: Body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }

      const parsed = read(body);
      if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

      try {
        const columns = await createAiColumns({ tableId, ...parsed });
        return NextResponse.json({ columns, primaryColumnKey: columns[0]?.key }, { status: 201 });
      } catch (cause) {
        return NextResponse.json(
          { error: cause instanceof Error ? cause.message : "Could not add that AI column" },
          { status: 400 },
        );
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// PATCH /api/grid/tables/[tableId]/ai — { columnId, ...same fields }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(request, async () => {
      const { tableId } = await params;
      if (!(await getTable(tableId))) {
        return NextResponse.json({ error: "table not found" }, { status: 404 });
      }

      let body: Body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
      }
      if (!body.columnId) return NextResponse.json({ error: "columnId is required" }, { status: 400 });

      const parsed = read(body);
      if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

      try {
        const columns = await updateAiColumns({ tableId, columnId: body.columnId, ...parsed });
        const primary = columns.find((column) => column.id === body.columnId);
        return NextResponse.json({ columns, primaryColumnKey: primary?.key });
      } catch (cause) {
        return NextResponse.json(
          { error: cause instanceof Error ? cause.message : "Could not update that AI column" },
          { status: 400 },
        );
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
