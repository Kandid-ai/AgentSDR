import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  assertExactKeys,
  assertObject,
  CrmConfigurationValidationError,
  parseUuid,
  resolvePipelineId,
} from "./categories";
import {
  MAX_AI_INSTRUCTION_BLOCKS,
  MAX_AI_INSTRUCTION_CONTENT_LENGTH,
  MAX_AI_INSTRUCTION_TITLE_LENGTH,
  MAX_AI_INSTRUCTIONS_TOTAL_LENGTH,
  renderAiInstructions,
  type AiInstructionBlock,
} from "./ai/instructions";
import { crmSettings } from "./schema";

export type CrmAiInstructions = {
  pipelineId: string;
  draftInstructions: AiInstructionBlock[];
  classificationInstructions: AiInstructionBlock[];
};

export type CrmAiInstructionsPatch = {
  pipelineId?: string;
  draftInstructions?: AiInstructionBlock[] | null;
  classificationInstructions?: AiInstructionBlock[] | null;
};

const BLOCK_ID = /^[A-Za-z0-9_-]{1,64}$/;

function parseInstructionBlocks(value: unknown, label: string): AiInstructionBlock[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) {
    throw new CrmConfigurationValidationError(`${label} must be a list of instruction blocks or null`);
  }
  if (value.length > MAX_AI_INSTRUCTION_BLOCKS) {
    throw new CrmConfigurationValidationError(`${label} can hold at most ${MAX_AI_INSTRUCTION_BLOCKS} blocks`);
  }
  const ids = new Set<string>();
  const blocks = value.map((item, index): AiInstructionBlock => {
    const where = `${label}[${index}]`;
    assertObject(item);
    assertExactKeys(item, ["id", "title", "content"]);
    if (typeof item.id !== "string" || !BLOCK_ID.test(item.id)) {
      throw new CrmConfigurationValidationError(`${where}.id must be 1–64 letters, digits, - or _`);
    }
    if (ids.has(item.id)) throw new CrmConfigurationValidationError(`${where}.id is duplicated`);
    ids.add(item.id);
    if (typeof item.title !== "string" || typeof item.content !== "string") {
      throw new CrmConfigurationValidationError(`${where} needs a string title and content`);
    }
    const title = item.title.trim();
    const content = item.content.trim();
    if (title.length > MAX_AI_INSTRUCTION_TITLE_LENGTH) {
      throw new CrmConfigurationValidationError(
        `${where}.title must be at most ${MAX_AI_INSTRUCTION_TITLE_LENGTH} characters`,
      );
    }
    if (content.length > MAX_AI_INSTRUCTION_CONTENT_LENGTH) {
      throw new CrmConfigurationValidationError(
        `"${title || "Untitled"}" must be at most ${MAX_AI_INSTRUCTION_CONTENT_LENGTH} characters`,
      );
    }
    return { id: item.id, title, content };
  });
  // Checked on what the prompt will actually receive.
  if ((renderAiInstructions(blocks)?.length ?? 0) > MAX_AI_INSTRUCTIONS_TOTAL_LENGTH) {
    throw new CrmConfigurationValidationError(
      `${label} are too long in total — keep them under ${MAX_AI_INSTRUCTIONS_TOTAL_LENGTH} characters`,
    );
  }
  return blocks.length ? blocks : null;
}

/** Validates a PUT body; only the fields present are returned. Pure. */
export function parseAiInstructionsPatch(body: unknown): CrmAiInstructionsPatch {
  assertObject(body);
  assertExactKeys(body, ["pipelineId", "draftInstructions", "classificationInstructions"]);
  const patch: CrmAiInstructionsPatch = {};
  if (body.pipelineId !== undefined) patch.pipelineId = parseUuid(body.pipelineId, "pipelineId");
  if (body.draftInstructions !== undefined) {
    patch.draftInstructions = parseInstructionBlocks(body.draftInstructions, "Drafting instructions");
  }
  if (body.classificationInstructions !== undefined) {
    patch.classificationInstructions = parseInstructionBlocks(body.classificationInstructions, "Classification instructions");
  }
  return patch;
}

export async function getCrmAiInstructions(pipelineId?: string): Promise<CrmAiInstructions> {
  const resolved = await resolvePipelineId(pipelineId);
  const [row] = await db
    .select({
      draftInstructions: crmSettings.draftInstructions,
      classificationInstructions: crmSettings.classificationInstructions,
    })
    .from(crmSettings)
    .where(eq(crmSettings.pipelineId, resolved))
    .limit(1);
  return {
    pipelineId: resolved,
    draftInstructions: row?.draftInstructions ?? [],
    classificationInstructions: row?.classificationInstructions ?? [],
  };
}

export async function updateCrmAiInstructions(input: unknown): Promise<CrmAiInstructions> {
  const patch = parseAiInstructionsPatch(input);
  const resolved = await resolvePipelineId(patch.pipelineId);
  const changes: {
    draftInstructions?: AiInstructionBlock[] | null;
    classificationInstructions?: AiInstructionBlock[] | null;
  } = {};
  if (patch.draftInstructions !== undefined) changes.draftInstructions = patch.draftInstructions;
  if (patch.classificationInstructions !== undefined) {
    changes.classificationInstructions = patch.classificationInstructions;
  }
  if (Object.keys(changes).length > 0) {
    await db
      .insert(crmSettings)
      .values({ pipelineId: resolved, ...changes })
      .onConflictDoUpdate({
        target: crmSettings.pipelineId,
        set: { ...changes, updatedAt: new Date() },
      });
  }
  return getCrmAiInstructions(resolved);
}
