import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gridColumns, gridRows, type GridColumn } from "./schema";
import { inOrgTables } from "./scope";
import { runInOrganization } from "@/lib/tenancy/scope";
import { cascade, claim, type ClaimedJob, completeJob, deferJob, failJob, recoverStaleJobs } from "./queue";
import { setCellMeta } from "./rows";
import { getRunner, PermanentRunError, type RunSession } from "./runners";
import type { CellResult, CellValues, PendingCellResult } from "./types";
import { isMigrationControlPaused } from "@/lib/migration/controls";

/**
 * In-process worker pool draining grid_jobs.
 *
 * Deliberately the same deployment shape as outreach/internalScheduler.ts —
 * started from instrumentation.ts, no separate process, no Redis — so the
 * self-host story stays `docker run` plus DATABASE_URL. Unlike that scheduler
 * this one is safe under multiple instances, because claiming goes through
 * SKIP LOCKED (see queue.ts).
 */

const POLL_INTERVAL_MS = Number(process.env.GRID_WORKER_POLL_MS ?? 1000);
const CONCURRENCY = Number(process.env.GRID_WORKER_CONCURRENCY ?? 8);
const CELL_TIMEOUT_MS = Number(process.env.GRID_CELL_TIMEOUT_MS ?? 30_000);
const STALE_SWEEP_EVERY = 60;
const WORKER_STATE_KEY = Symbol.for("agentsdr.grid-worker-state");

type WorkerState = {
  owner: symbol;
  timer: ReturnType<typeof setInterval>;
};

type WorkerGlobal = typeof globalThis & {
  [WORKER_STATE_KEY]?: WorkerState;
};

let started = false;
let draining = false;
let inFlight = 0;
// A fresh token is created whenever this module is replaced by dev HMR. The
// new module clears the prior generation's timer before it begins polling.
const workerOwner = Symbol("grid-worker-generation");
// Sweep on the first pass as well as every minute thereafter. This recovers
// rows left in `running` when a dev server or deployment was restarted.
let ticks = STALE_SWEEP_EVERY - 1;

/**
 * Sessions live for one drain pass, keyed by column.
 *
 * This is what makes formula columns viable: booting a QuickJS isolate and
 * loading lodash/moment/FormulaJS costs ~60ms against ~10µs per evaluation, so
 * one sandbox is shared by every row in the pass and disposed at the end.
 */
type SessionCache = Map<string, RunSession>;

function isPendingResult(result: CellResult | PendingCellResult): result is PendingCellResult {
  return "pending" in result && result.pending === true;
}

async function loadColumns(tableId: string): Promise<GridColumn[]> {
  return db
    .select()
    .from(gridColumns)
    .where(and(inOrgTables(gridColumns.tableId), eq(gridColumns.tableId, tableId)));
}

async function loadRow(tableId: string, rowId: string): Promise<CellValues | null> {
  const [row] = await db
    .select({ cells: gridRows.cells })
    .from(gridRows)
    .where(and(inOrgTables(gridRows.tableId), eq(gridRows.tableId, tableId), eq(gridRows.id, rowId)))
    .limit(1);
  return row?.cells ?? null;
}

async function runJob(job: ClaimedJob, sessions: SessionCache): Promise<void> {
  const columns = await loadColumns(job.tableId);
  const column = columns.find((c) => c.key === job.columnKey);

  if (!column) {
    // The column was deleted while the job sat in the queue. Not an error
    // worth surfacing on a cell that no longer exists.
    await failJob(job, "Column no longer exists", { permanent: true });
    return;
  }

  const runner = getRunner(column.type);
  if (!runner) {
    await failJob(job, `No runner for column type "${column.type}"`, { permanent: true });
    return;
  }

  const cells = await loadRow(job.tableId, job.rowId);
  if (!cells) {
    await failJob(job, "Row no longer exists", { permanent: true });
    return;
  }

  // Mark running so the grid shows progress mid-flight. Best-effort: losing
  // this update costs a spinner, whereas losing the terminal write in
  // completeJob() would strand the cell, which is why only that one is
  // transactional.
  await setCellMeta(job.rowId, job.columnKey, { status: "running" }).catch(() => {});

  try {
    let session = sessions.get(column.id);
    if (!session && runner.prepare) {
      session = await runner.prepare(column.config as never, {
        tableId: job.tableId,
        rowId: job.rowId,
        columnKey: job.columnKey,
        timeoutMs: CELL_TIMEOUT_MS,
      });
      sessions.set(column.id, session);
    }

    const result = await runner.run(
      column.config as never,
      cells,
      {
        tableId: job.tableId,
        rowId: job.rowId,
        columnKey: job.columnKey,
        timeoutMs: CELL_TIMEOUT_MS,
        providerState: job.providerState,
      },
      session,
    );

    if (isPendingResult(result)) {
      await deferJob(job, result);
      return;
    }

    await completeJob(job, result);

    // Cascade from the row as it now stands, so a dependent reading two
    // columns sees the value this job just wrote.
    const additionalOutputs = result.outputs ?? {};
    const updated = { ...cells, [job.columnKey]: result.value, ...additionalOutputs };
    for (const changedKey of [job.columnKey, ...Object.keys(additionalOutputs)]) {
      await cascade(job.tableId, job.rowId, changedKey, columns, updated);
    }
  } catch (err) {
    const permanent = err instanceof PermanentRunError;
    const message = err instanceof Error ? err.message : String(err);
    const audit = err instanceof PermanentRunError ? err.audit : undefined;
    const { willRetry } = await failJob(job, message, { permanent, ...audit });
    if (!willRetry) {
      console.warn(`[grid/worker] ${job.columnKey} on row ${job.rowId} failed: ${message}`);
    }
  }
}

/** One drain pass: claim what fits, run it, dispose the sessions. */
async function drain(): Promise<void> {
  if (draining) return;
  if (isMigrationControlPaused("gridWorker")) return;
  draining = true;

  const sessions: SessionCache = new Map();
  try {
    if (++ticks % STALE_SWEEP_EVERY === 0) {
      const n = await recoverStaleJobs();
      if (n) console.log(`[grid/worker] recovered ${n} stale job(s)`);
    }

    const capacity = CONCURRENCY - inFlight;
    if (capacity <= 0) return;

    const jobs = await claim(capacity);
    if (!jobs.length) return;

    inFlight += jobs.length;
    try {
      await Promise.all(
        jobs.map((job) =>
          // Every job runs as the organization that owns its table.
          runInOrganization(job.organizationId, () => runJob(job, sessions)).catch((err) => {
            console.error("[grid/worker] job threw outside its handler:", err);
          }),
        ),
      );
    } finally {
      inFlight -= jobs.length;
    }
  } catch (err) {
    console.error("[grid/worker] drain failed:", err);
  } finally {
    for (const s of sessions.values()) {
      try {
        await s.dispose?.();
      } catch {
        // A sandbox that fails to dispose must not stall the loop.
      }
    }
    draining = false;
  }
}

/** Starts the loop. Idempotent — Next may call register() more than once. */
export function startGridWorker(): void {
  const workerGlobal = globalThis as WorkerGlobal;
  if (started && workerGlobal[WORKER_STATE_KEY]?.owner === workerOwner) return;
  started = true;

  const previous = workerGlobal[WORKER_STATE_KEY];
  if (previous && previous.owner !== workerOwner) clearInterval(previous.timer);

  console.log(
    `[grid/worker] starting — poll ${POLL_INTERVAL_MS}ms, concurrency ${CONCURRENCY}`,
  );

  const timer = setInterval(() => {
    // A replacement module may have taken ownership between timer ticks.
    if (workerGlobal[WORKER_STATE_KEY]?.owner !== workerOwner) {
      clearInterval(timer);
      return;
    }
    void drain();
  }, POLL_INTERVAL_MS);
  workerGlobal[WORKER_STATE_KEY] = { owner: workerOwner, timer };

  void drain();
}

/** Runs one pass synchronously. Used by tests and the manual-run endpoint. */
export async function drainOnce(): Promise<void> {
  await drain();
}
