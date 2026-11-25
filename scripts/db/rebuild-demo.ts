/**
 * Rebuilds a public demo's database from the current schema and seed.
 *
 *   DEMO_DATABASE_URL=postgres://…/demodb?sslmode=disable \
 *   SCRATCH_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres \
 *   DEMO_INTEGRATION_CREDENTIALS_KEY=… DEMO_BETTER_AUTH_SECRET=… \
 *   bun run db:rebuild:demo [--yes]
 *
 * Why: deploys bring the demo's code up to date, but its database keeps the
 * schema it was seeded with — no migrations run there. After a schema change
 * the newer pages answer 500 on the demo until it is rebuilt (25 Nov 2026:
 * CRM, Leads, email campaigns, AI calling and five Settings pages).
 *
 * How: seeding row by row over the internet is slow, so this builds the demo
 * in a throwaway database on a nearby Postgres (SCRATCH_DATABASE_URL, any
 * server where it may create a database), with `db:setup` + `db:seed:demo`
 * and the deployment's own keys, then dumps it and swaps it into the demo's
 * database in ONE transaction: a failure leaves the old data in place.
 *
 * Safety: it refuses a target holding any organization that is not a seeded
 * demo one, backs the target up first (demo-backup-<time>.dump in the working
 * directory), and without --yes stops after the build. The keys are passed
 * under DEMO_* names on purpose: bun loads .env.local, which on a developer
 * machine may hold production's INTEGRATION_CREDENTIALS_KEY.
 *
 * Needs pg_dump and psql (the same major version as the servers, or newer).
 */
import { SQL } from "bun";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BUILD_DB = "agentsdr_demo_build";
const ROOT = join(import.meta.dir, "..", "..");

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is not set. See the header of scripts/db/rebuild-demo.ts.`);
    process.exit(1);
  }
  return value;
}

function run(cmd: string[], env: Record<string, string> = {}): void {
  const result = Bun.spawnSync(cmd, { cwd: ROOT, env: { ...process.env, ...env }, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error(`${cmd[0]} ${cmd[1] ?? ""} failed (exit ${result.exitCode})`);
}

function withDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

function tlsFor(url: string) {
  return new URL(url).searchParams.get("sslmode") === "disable" ? false : { rejectUnauthorized: false };
}

/** Only an empty database or one whose organizations are all seeded demo ones may be replaced. */
async function assertDemoTarget(url: string): Promise<void> {
  const sql = new SQL(url, { max: 1, tls: tlsFor(url) });
  try {
    const [{ exists }] = await sql`select to_regclass('public.organizations') is not null as exists`;
    if (!exists) return;
    const orgs: { name: string; metadata: string | null }[] = await sql`select name, metadata from organizations`;
    const real = orgs.filter((o) => {
      try {
        return JSON.parse(o.metadata ?? "{}").demo !== true;
      } catch {
        return true;
      }
    });
    if (real.length) {
      throw new Error(`Refusing: the target holds organizations that are not seeded demo ones (${real.map((o) => o.name).join(", ")}).`);
    }
    console.log(`Target holds only demo data (${orgs.map((o) => o.name).join(", ") || "no organizations"}).`);
  } finally {
    await sql.close();
  }
}

async function main() {
  const target = required("DEMO_DATABASE_URL");
  const scratch = required("SCRATCH_DATABASE_URL");
  const key = required("DEMO_INTEGRATION_CREDENTIALS_KEY");
  const authSecret = required("DEMO_BETTER_AUTH_SECRET");
  const confirmed = process.argv.includes("--yes");

  console.log(`Target: ${new URL(target).host}${new URL(target).pathname}`);
  await assertDemoTarget(target);

  const admin = new SQL(scratch, { max: 1, tls: tlsFor(scratch) });
  const buildUrl = withDatabase(scratch, BUILD_DB);
  const work = await mkdtemp(join(tmpdir(), "agentsdr-demo-"));
  try {
    await admin.unsafe(`drop database if exists ${BUILD_DB} with (force)`);
    await admin.unsafe(`create database ${BUILD_DB}`);

    const seedEnv = {
      DATABASE_URL: buildUrl,
      DATABASE_SSL: tlsFor(scratch) === false ? "disable" : "require",
      DEMO_MODE: "true",
      INTEGRATION_CREDENTIALS_KEY: key,
      BETTER_AUTH_SECRET: authSecret,
    };
    run(["bun", "scripts/db/setup.ts"], seedEnv);
    run(["bun", "--conditions=react-server", "scripts/db/seed-demo.ts"], seedEnv);

    const fresh = join(work, "fresh.sql");
    run(["pg_dump", buildUrl, "--no-owner", "--no-privileges", "-f", fresh]);

    if (!confirmed) {
      console.log("\nBuilt and dumped. Re-run with --yes to back up the target and replace its data.");
      return;
    }

    const backup = join(process.cwd(), `demo-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
    run(["pg_dump", target, "-Fc", "-f", backup]);
    console.log(`Backed up the target to ${backup}`);

    const restore = join(work, "restore.sql");
    await writeFile(restore, `DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\n${await readFile(fresh, "utf8")}`);
    run(["psql", target, "-q", "-o", "/dev/null", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", restore]);
    console.log("Demo database replaced. Visitors are signed out and straight back in; the app needs no restart.");
  } finally {
    await admin.unsafe(`drop database if exists ${BUILD_DB} with (force)`).catch(() => {});
    await admin.close();
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
