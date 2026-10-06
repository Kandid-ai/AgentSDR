import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobRuns, jobLogs } from "./schema";
import { serializeError } from "./serializeError";

/**
 * Wraps a job function with full DB tracking.
 * Intercepts all console.log/warn/error calls during the run and persists
 * them as JobLog rows — no changes needed in the job functions themselves.
 * Returns immediately once the JobRun row is created (caller gets the run id);
 * the actual work happens in the background.
 */
export async function withJobTracking(
  jobName: string,
  fn: (runId: string) => Promise<void>
): Promise<string> {
  const [jobRun] = await db
    .insert(jobRuns)
    .values({ job: jobName, status: "RUNNING" })
    .returning({ id: jobRuns.id });

  const runId = jobRun.id;

  // Persist a log entry fire-and-forget (errors silently ignored so they
  // don't interrupt the job itself).
  const persist = (level: string, message: string) => {
    db.insert(jobLogs).values({ jobRunId: runId, level, message }).catch(() => {});
  };

  // Capture console output during the job
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origLog(...args);
    persist("info", msg);
  };
  console.warn = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origWarn(...args);
    persist("warn", msg);
  };
  console.error = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origError(...args);
    persist("error", msg);
  };

  // Run the job in the background
  fn(runId)
    .then(async () => {
      await db
        .update(jobRuns)
        .set({ status: "SUCCESS", finishedAt: new Date() })
        .where(eq(jobRuns.id, runId));
    })
    .catch(async (err: unknown) => {
      const msg = serializeError(err);
      // Persist the unhandled error as an ERR log line so it's visible in the terminal
      await db
        .insert(jobLogs)
        .values({ jobRunId: runId, level: "error", message: msg })
        .catch(() => {});
      await db
        .update(jobRuns)
        .set({ status: "FAILED", finishedAt: new Date(), error: msg })
        .where(eq(jobRuns.id, runId));
    })
    .finally(() => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    });

  return runId;
}
