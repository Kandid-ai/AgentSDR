import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { currentOrganizationId, inOrg } from "@/lib/tenancy/scope";
import {
  defaultViewConfigs,
  normalizeViewConfig,
  normalizeViewName,
  type BoardView,
} from "./boardViews";
import { listSubcategories } from "./categories";
import { CrmConfigurationValidationError } from "./categories";
import { CrmNotFoundError } from "./repository";
import { crmBoardViews } from "./schema";

type Row = typeof crmBoardViews.$inferSelect;

function toView(row: Row): BoardView {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    config: normalizeViewConfig(row.config),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseId(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new CrmNotFoundError("Board view", id);
  return id;
}

function requireName(value: unknown): string {
  const name = normalizeViewName(value);
  if (!name) throw new CrmConfigurationValidationError("name is required");
  return name;
}

/**
 * The organization's saved views, in order. An organization with none yet
 * gets the defaults first (built from its own sub-stages); two first loads at
 * once seed once (advisory lock on the organization, then a recount).
 */
export async function listBoardViews(): Promise<BoardView[]> {
  const organizationId = currentOrganizationId();
  const read = () => db.select().from(crmBoardViews).where(inOrg(crmBoardViews))
    .orderBy(asc(crmBoardViews.position), asc(crmBoardViews.createdAt));
  const rows = await read();
  if (rows.length) return rows.map(toView);

  const { subcategories } = await listSubcategories({});
  const idsByKey = new Map(subcategories.map((subcategory) => [subcategory.key, subcategory.id]));
  const defaults = defaultViewConfigs(idsByKey);
  if (defaults.length) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`crm_board_views:${organizationId}`}))`);
      const [existing] = await tx.select({ id: crmBoardViews.id }).from(crmBoardViews).where(inOrg(crmBoardViews)).limit(1);
      if (existing) return;
      await tx.insert(crmBoardViews).values(defaults.map((view, position) => ({
        organizationId,
        name: view.name,
        position,
        config: view.config,
      })));
    });
  }
  return (await read()).map(toView);
}

export async function createBoardView(input: {
  name: unknown;
  config?: unknown;
  position?: number;
  createdByUserId?: string | null;
}): Promise<BoardView> {
  const organizationId = currentOrganizationId();
  const name = requireName(input.name);
  const config = normalizeViewConfig(input.config);
  const [row] = await db.transaction(async (tx) => {
    let position = input.position;
    if (position === undefined || !Number.isInteger(position)) {
      const [max] = await tx.select({ value: sql<number | null>`max(${crmBoardViews.position})` })
        .from(crmBoardViews).where(inOrg(crmBoardViews));
      position = max?.value === null || max?.value === undefined ? 0 : Number(max.value) + 1;
    }
    return tx.insert(crmBoardViews).values({
      organizationId,
      name,
      position,
      config,
      createdByUserId: input.createdByUserId ?? null,
    }).returning();
  });
  return toView(row);
}

export async function updateBoardView(
  id: string,
  patch: { name?: unknown; config?: unknown; position?: unknown },
): Promise<BoardView> {
  parseId(id);
  const set: Partial<typeof crmBoardViews.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = requireName(patch.name);
  if (patch.config !== undefined) set.config = normalizeViewConfig(patch.config);
  if (patch.position !== undefined) {
    if (typeof patch.position !== "number" || !Number.isSafeInteger(patch.position)) {
      throw new CrmConfigurationValidationError("position must be an integer");
    }
    set.position = patch.position;
  }
  const [row] = await db.update(crmBoardViews).set(set)
    .where(and(inOrg(crmBoardViews), eq(crmBoardViews.id, id))).returning();
  if (!row) throw new CrmNotFoundError("Board view", id);
  return toView(row);
}

export async function deleteBoardView(id: string): Promise<void> {
  parseId(id);
  const rows = await db.delete(crmBoardViews)
    .where(and(inOrg(crmBoardViews), eq(crmBoardViews.id, id))).returning({ id: crmBoardViews.id });
  if (!rows.length) throw new CrmNotFoundError("Board view", id);
}
