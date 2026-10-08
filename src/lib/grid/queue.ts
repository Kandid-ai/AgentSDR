import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getIntegrationAction } from "@/lib/integrations/catalog";
import { gridCellRuns, gridColumns, gridJobs, gridRows, gridTables, type GridColumn, type GridJob } from "./schema";
import { currentOrganizationId, inOrg } from "@/lib/tenancy/scope";
import { inOrgTables, tableInOrganization } from "./scope";
import type { CellResult, CellValues, EnrichmentConfig, PendingCellResult } from "./types";
import { allReferencedInputsEmpty, columnDelaySeconds, hasCellValue } from "./runners/guards";
import { ownCell } from "./runners/types";
import { cleanJson, cleanString } from "./sanitize";

/**
 * The work queue for cell execution — see docs/design/enrichment-plan.md §5.
 *
 * Jobs are claimed with FOR UPDATE SKIP LOCKED, which gives this the
 * distributed lock that outreach/internalScheduler.ts documents itself as
 * lacking: two workers, or two instances, cannot claim the same job. The
 * outreach tick beside it would still double-send if scaled out; this will not.
 */

/** A claim older than this is treated as a worker that died mid-run. */
const STALE_LOCK_MS = 5 * 60 * 1000;

/** `delaySeconds` holds the job back from the claimer — the column's "Delay" setting. */
export type EnqueueTarget = { rowId: string; columnKey: string; delaySeconds?: number };

/** A claimed job plus the organization of its table — what the worker scopes each run to. */
export type ClaimedJob = GridJob & { organizationId: string };

/**
 * Queues cells, skipping any already queued or running.
 *
 * The (row_id, column_key) unique constraint makes this an upsert: re-running
 * a cell moves its existing job back to queued rather than stacking a second
 * one, so a user hammering "Run" cannot flood the queue.
 */
export async function enqueue(
  tableId: string,
  targets: EnqueueTarget[],
  opts: { priority?: number } = {},
): Promise<number> {
  if (!targets.length) return 0;
  // Fail closed: a table id from another organization queues nothing.
  if (!(await tableInOrganization(tableId))) throw new Error("That table no longer exists");

  const CHUNK = 500;
  let queued = 0;

  for (let i = 0; i < targets.length; i += CHUNK) {
    const chunk = targets.slice(i, i + CHUNK);
    const inserted = await db
      .insert(gridJobs)
      .values(
        chunk.map((t) => ({
          tableId,
          rowId: t.rowId,
          columnKey: t.columnKey,
          status: "queued" as const,
          priority: opts.priority ?? 0,
          attempts: 0,
          runAfter: new Date(Date.now() + (t.delaySeconds ?? 0) * 1000),
        })),
      )
      .onConflictDoUpdate({
        target: [gridJobs.rowId, gridJobs.columnKey],
        set: {
          status: "queued",
          attempts: 0,
          error: null,
          providerState: null,
          lockedAt: null,
          runAfter: sql`excluded.run_after`,
          updatedAt: new Date(),
        },
        // Leave a job that is mid-flight alone; re-queuing it under the worker
        // would orphan the run in progress.
        where: sql`${gridJobs.status} NOT IN ('running', 'waiting')`,
      })
      .returning({ id: gridJobs.id });

    queued += inserted.length;
  }

  // Mark every queued cell immediately so the grid shows pending state without
  // waiting for a worker to pick the job up.
  await markQueued(tableId, targets);
  return queued;
}

async function markQueued(tableId: string, targets: EnqueueTarget[]): Promise<void> {
  const byColumn = new Map<string, Set<string>>();
  for (const t of targets) {
    const rowIds = byColumn.get(t.columnKey) ?? new Set<string>();
    rowIds.add(t.rowId);
    byColumn.set(t.columnKey, rowIds);
  }

  const CHUNK = 500;
  for (const [columnKey, ids] of byColumn) {
    const rowIds = [...ids];
    const patch = JSON.stringify({ [columnKey]: { status: "queued" } });
    for (let i = 0; i < rowIds.length; i += CHUNK) {
      await db
        .update(gridRows)
        .set({
          cellMeta: sql`${gridRows.cellMeta} || ${patch}::jsonb`,
          version: sql`nextval('grid_row_version_seq')`,
          updatedAt: new Date(),
        })
        .where(and(inOrgTables(gridRows.tableId), eq(gridRows.tableId, tableId), inArray(gridRows.id, rowIds.slice(i, i + CHUNK))));
    }
  }
}

/**
 * Claims up to `limit` runnable jobs.
 *
 * SKIP LOCKED is what makes this safe to call concurrently: rows locked by
 * another claimer are passed over instead of blocking, so N workers drain the
 * queue in parallel without ever colliding on the same job.
 *
 * Done as a typed SELECT ... FOR UPDATE SKIP LOCKED followed by an UPDATE in
 * the same transaction, rather than one raw `UPDATE ... RETURNING *`. The raw
 * form works in SQL but bypasses drizzle's column mapping, so postgres-js
 * hands back snake_case keys and every `job.tableId` reads as undefined. The
 * locks are held until the transaction commits, so the two statements are just
 * as atomic as the single one was.
 *
 * Deliberately global: it runs in the worker loop with no organization scope,
 * claiming across every organization. Each claimed job carries the
 * organization of its table, and the worker runs it inside that scope.
 */
export async function claim(limit: number): Promise<ClaimedJob[]> {
  return db.transaction(async (tx) => {
    const locked = await tx
      .select({ id: gridJobs.id })
      .from(gridJobs)
      .where(and(inArray(gridJobs.status, ["queued", "waiting"]), lte(gridJobs.runAfter, new Date())))
      .orderBy(desc(gridJobs.priority), asc(gridJobs.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });

    if (!locked.length) return [];

    const claimed = await tx
      .update(gridJobs)
      .set({
        status: "running",
        lockedAt: new Date(),
        attempts: sql`CASE WHEN ${gridJobs.status} = 'queued' THEN ${gridJobs.attempts} + 1 ELSE ${gridJobs.attempts} END`,
        updatedAt: new Date(),
      })
      .where(
        inArray(
          gridJobs.id,
          locked.map((l) => l.id),
        ),
      )
      .returning();

    const tables = await tx
      .select({ id: gridTables.id, organizationId: gridTables.organizationId })
      .from(gridTables)
      .where(inArray(gridTables.id, [...new Set(claimed.map((job) => job.tableId))]));
    const organizationByTable = new Map(tables.map((table) => [table.id, table.organizationId]));
    // A job whose table is gone cannot be attributed to an organization; the
    // cascade makes that impossible, but never run one unscoped.
    return claimed.flatMap((job) => {
      const organizationId = organizationByTable.get(job.tableId);
      return organizationId ? [{ ...job, organizationId }] : [];
    });
  });
}

/** Returns jobs whose worker died mid-run to the queue. Global, like claim(): it touches no payload. */
export async function recoverStaleJobs(): Promise<number> {
  const recovered = await db
    .update(gridJobs)
    .set({
      status: sql`CASE WHEN ${gridJobs.providerState} IS NULL THEN 'queued' ELSE 'waiting' END`,
      lockedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(gridJobs.status, "running"),
        sql`${gridJobs.lockedAt} < now() - ${`${STALE_LOCK_MS} milliseconds`}::interval`,
      ),
    )
    .returning({ id: gridJobs.id });
  return recovered.length;
}

/** Releases an accepted asynchronous provider task until its next poll. */
export async function deferJob(job: GridJob, result: PendingCellResult): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(gridJobs)
      .set({
        status: "waiting",
        providerState: result.state,
        lockedAt: null,
        runAfter: new Date(Date.now() + Math.max(1_000, result.pollAfterMs)),
        error: null,
        updatedAt: new Date(),
      })
      .where(and(inOrgTables(gridJobs.tableId), eq(gridJobs.id, job.id)));
    await tx
      .update(gridRows)
      .set({
        cellMeta: sql`${gridRows.cellMeta} || ${JSON.stringify({ [job.columnKey]: { status: "processing" } })}::jsonb`,
        version: sql`nextval('grid_row_version_seq')`,
        updatedAt: new Date(),
      })
      .where(and(inOrgTables(gridRows.tableId), eq(gridRows.tableId, job.tableId), eq(gridRows.id, job.rowId)));
  });
}

/**
 * Records a successful run: the value, its metadata, and an audit row.
 *
 * The value and metadata are written in one statement so a reader can never
 * observe a cell whose value has landed but which still claims to be running.
 */
export async function completeJob(
  job: GridJob,
  result: CellResult,
): Promise<void> {
  const meta = {
    status: "success" as const,
    provider: result.provider,
    costCents: result.costCents,
    runAt: new Date().toISOString(),
  };
  const produced = cleanJson({ [job.columnKey]: result.value ?? null, ...(result.outputs ?? {}) });

  await db.transaction(async (tx) => {
    // Only keys that are still columns: an output column deleted while the job
    // ran would otherwise keep receiving values no one can see.
    const current = await tx
      .select({ key: gridColumns.key })
      .from(gridColumns)
      .where(and(inOrgTables(gridColumns.tableId), eq(gridColumns.tableId, job.tableId)));
    const live = new Set(current.map((column) => column.key));
    const values = Object.fromEntries(Object.entries(produced).filter(([key]) => live.has(key)));
    const metadata = Object.fromEntries(Object.keys(values).map((key) => [key, meta]));

    if (Object.keys(values).length) {
      await tx
        .update(gridRows)
        .set({
          cells: sql`${gridRows.cells} || ${JSON.stringify(values)}::jsonb`,
          cellMeta: sql`${gridRows.cellMeta} || ${JSON.stringify(metadata)}::jsonb`,
          version: sql`nextval('grid_row_version_seq')`,
          updatedAt: new Date(),
        })
        .where(and(inOrgTables(gridRows.tableId), eq(gridRows.tableId, job.tableId), eq(gridRows.id, job.rowId)));
    }

    await recordRun(tx, {
      tableId: job.tableId,
      rowId: job.rowId,
      columnKey: job.columnKey,
      provider: result.provider ?? null,
      outcome: result.outcome,
      costCents: String(result.costCents ?? 0),
      latencyMs: result.latencyMs ?? null,
      request: result.request ?? null,
      response: result.response ?? null,
    });

    await tx.delete(gridJobs).where(and(inOrgTables(gridJobs.tableId), eq(gridJobs.id, job.id)));
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Appends the audit row inside a savepoint. The row may have been deleted
 * while the job ran, which makes the foreign key reject the insert; losing an
 * audit line must not abort the completion or failure it describes.
 */
async function recordRun(
  tx: Tx,
  run: Omit<typeof gridCellRuns.$inferInsert, "request" | "response"> & { request: unknown; response: unknown },
): Promise<void> {
  try {
    await tx.transaction(async (savepoint) => {
      await savepoint.insert(gridCellRuns).values({
        ...run,
        request: cleanJson(run.request) as never,
        response: cleanJson(run.response) as never,
      });
    });
  } catch (err) {
    console.warn("[grid/queue] could not record the run:", err instanceof Error ? err.message : err);
  }
}

/**
 * Drops a job without running it and returns its cell to idle — used when the
 * column's "Only run if" is false or every input went blank after queuing.
 */
export async function skipJob(job: GridJob): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(gridJobs).where(and(inOrgTables(gridJobs.tableId), eq(gridJobs.id, job.id)));
    await tx
      .update(gridRows)
      .set({
        cellMeta: sql`${gridRows.cellMeta} - ${job.columnKey}::text`,
        version: sql`nextval('grid_row_version_seq')`,
        updatedAt: new Date(),
      })
      .where(and(inOrgTables(gridRows.tableId), eq(gridRows.tableId, job.tableId), eq(gridRows.id, job.rowId)));
  });
}

/**
 * Records a failure.
 *
 * `permanent` failures — a broken formula, a 4xx, a missing env var — are not
 * retried: they will fail identically next time, and retrying them three times
 * only delays the queue and triples the spend on anything that did charge.
 */
export async function failJob(
  job: GridJob,
  error: string,
  opts: { permanent?: boolean; costCents?: number; provider?: string; request?: unknown; response?: unknown } = {},
): Promise<{ willRetry: boolean }> {
  error = cleanString(error);
  const providerState = job.providerState ?? null;
  const pollErrors = providerState ? Number(providerState.pollErrors ?? 0) + 1 : 0;
  const exhausted = providerState ? pollErrors >= job.maxAttempts : job.attempts >= job.maxAttempts;
  const willRetry = !opts.permanent && !exhausted;

  // Exponential backoff: 2s, 8s, 32s.
  const failureCount = providerState ? pollErrors : job.attempts;
  const delayMs = 2000 * Math.pow(4, Math.max(0, failureCount - 1));

  await db.transaction(async (tx) => {
    if (willRetry) {
      await tx
        .update(gridJobs)
        .set({
          status: job.providerState ? "waiting" : "queued",
          providerState: providerState ? { ...providerState, pollErrors } : null,
          lockedAt: null,
          error,
          runAfter: new Date(Date.now() + delayMs),
          updatedAt: new Date(),
        })
        .where(and(inOrgTables(gridJobs.tableId), eq(gridJobs.id, job.id)));
      if (providerState) {
        await tx
          .update(gridRows)
          .set({
            cellMeta: sql`${gridRows.cellMeta} || ${JSON.stringify({ [job.columnKey]: { status: "processing" } })}::jsonb`,
            version: sql`nextval('grid_row_version_seq')`,
            updatedAt: new Date(),
          })
          .where(and(inOrgTables(gridRows.tableId), eq(gridRows.tableId, job.tableId), eq(gridRows.id, job.rowId)));
      }
    } else {
      await tx.delete(gridJobs).where(and(inOrgTables(gridJobs.tableId), eq(gridJobs.id, job.id)));
    }

    // Only surface the error on the cell once it is final; a cell blinking to
    // "error" between retries reads as a failure that has not happened yet.
    if (!willRetry) {
      const meta = { status: "error" as const, error, runAt: new Date().toISOString() };
      await tx
        .update(gridRows)
        .set({
          cellMeta: sql`${gridRows.cellMeta} || ${JSON.stringify({ [job.columnKey]: meta })}::jsonb`,
          version: sql`nextval('grid_row_version_seq')`,
          updatedAt: new Date(),
        })
        .where(and(inOrgTables(gridRows.tableId), eq(gridRows.tableId, job.tableId), eq(gridRows.id, job.rowId)));
    }

    await recordRun(tx, {
      tableId: job.tableId,
      rowId: job.rowId,
      columnKey: job.columnKey,
      provider: opts.provider ?? null,
      outcome: "error",
      costCents: String(opts.costCents ?? 0),
      request: opts.request ?? null,
      response: opts.response ?? { error },
    });
  });

  return { willRetry };
}

/**
 * Queues the columns that read `columnKey`, for this row only.
 *
 * This cascade is what the table's "Auto-run" toggle controls. A dependent is
 * only queued once its runnable inputs have values, so a column reading two
 * required inputs does not run twice. Addable filter groups are ready as soon
 * as their minimum number of mapped filters has a value.
 */
export async function cascade(
  tableId: string,
  rowId: string,
  columnKey: string,
  columns: GridColumn[],
  cells: CellValues,
): Promise<number> {
  const dependents = columns.filter((c) => c.autoRun && c.dependsOn.includes(columnKey));
  if (!dependents.length) return 0;

  // The table-level Auto-run switch sits above each column's own.
  const [table] = await db
    .select({ autoRun: gridTables.autoRun })
    .from(gridTables)
    .where(and(inOrg(gridTables), eq(gridTables.id, tableId)))
    .limit(1);
  if (!table?.autoRun) return 0;

  const ready = dependents.filter((column) => {
    if (column.type === "enrichment") {
      const config = column.config as EnrichmentConfig;
      const action = getIntegrationAction(config.integrationKey, config.actionKey);
      if (action?.filterBuilder) {
        const requiredInputsReady = action.inputs.every((input) => {
          if (!input.required) return true;
          const binding = config.inputs[input.key];
          return binding ? hasCellValue(ownCell(cells, binding.columnKey)) : false;
        });
        if (!requiredInputsReady) return false;
        const populatedFilters = action.inputs.filter((input) => {
          if (input.group !== "filter") return false;
          const binding = config.inputs[input.key];
          return binding ? hasCellValue(ownCell(cells, binding.columnKey)) : false;
        }).length;
        return populatedFilters >= action.filterBuilder.minFilters;
      }
    }
    return column.dependsOn.every((dep) => hasCellValue(ownCell(cells, dep)))
      && !allReferencedInputsEmpty(column, cells);
  });
  if (!ready.length) return 0;

  return enqueue(
    tableId,
    ready.map((c) => ({ rowId, columnKey: c.key, delaySeconds: columnDelaySeconds(c) })),
  );
}

/** Queued + running jobs for a table, for the toolbar counter. */
export async function activeJobCount(tableId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(gridJobs)
    .where(and(inOrgTables(gridJobs.tableId), eq(gridJobs.tableId, tableId), inArray(gridJobs.status, ["queued", "running", "waiting"])));
  return row?.n ?? 0;
}

/**
 * Drops every pending job for a table — the "Stop" button.
 *
 * The cells those jobs had marked queued or processing go back to idle in the
 * same transaction; otherwise the grid would spin on them forever.
 */
export async function cancelTableJobs(tableId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(gridJobs)
      .where(and(inOrgTables(gridJobs.tableId), eq(gridJobs.tableId, tableId), inArray(gridJobs.status, ["queued", "waiting"])))
      .returning({ rowId: gridJobs.rowId, columnKey: gridJobs.columnKey });

    const keysByRow = new Map<string, string[]>();
    for (const { rowId, columnKey } of deleted) {
      keysByRow.set(rowId, [...(keysByRow.get(rowId) ?? []), columnKey]);
    }

    const CHUNK = 250;
    const rows = [...keysByRow.entries()];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const values = sql.join(
        rows
          .slice(i, i + CHUNK)
          .map(([rowId, keys]) => sql`(${rowId}::uuid, ARRAY[${sql.join(keys.map((key) => sql`${key}`), sql`, `)}]::text[])`),
        sql`, `,
      );
      await tx.execute(sql`
        UPDATE ${gridRows}
        SET cell_meta = ${gridRows.cellMeta} - source.keys,
            version = nextval('grid_row_version_seq'),
            updated_at = now()
        FROM (VALUES ${values}) AS source(id, keys)
        WHERE ${gridRows.id} = source.id
          AND ${gridRows.tableId} = ${tableId}::uuid
          AND ${gridRows.tableId} IN (SELECT id FROM ${gridTables} WHERE organization_id = ${currentOrganizationId()})
      `);
    }
    return deleted.length;
  });
}
