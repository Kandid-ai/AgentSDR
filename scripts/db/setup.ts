/**
 * Creates the AgentSDR schema in an EMPTY PostgreSQL database.
 *
 *   bun run db:setup
 *
 * Applies db/schema.sql (the complete current schema) and db/seed.sql (the
 * reference rows every install needs) in one transaction, so a failure
 * leaves the database untouched. It refuses to run against a database that
 * already has tables: an existing install moves forward with the migrations
 * in scripts/, never by re-applying the snapshot.
 *
 * `--if-empty` makes an already-initialised database a no-op success instead
 * of an error — what the Docker Compose `setup` service uses, so it can run
 * on every `docker compose up`.
 *
 * It uses Bun's built-in PostgreSQL client and no packages, so it also runs
 * inside the Docker image, where the app's own driver is bundled into the
 * server build rather than installed.
 *
 * After it: start the app, sign up, create your organization.
 */
import { SQL } from "bun";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DB_DIR = join(import.meta.dir, "..", "..", "db");

const ifEmpty = process.argv.includes("--if-empty");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — copy .env.example to .env.local and fill it in");

  // Same TLS behaviour as the app's driver: encrypted unless disabled, no
  // certificate pinning (DATABASE_SSL=disable for a local database).
  const sql = new SQL(url, {
    max: 1,
    tls: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  });
  try {
    const [{ version }] = await sql`select current_setting('server_version_num')::int as version`;
    if (Number(version) < 160000) {
      throw new Error(`PostgreSQL 16 or newer is required (this server is ${Math.floor(Number(version) / 10000)})`);
    }

    const existing: { name: string }[] = await sql`
      select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') limit 5`;
    if (existing.length && ifEmpty) {
      console.log("Database already initialised — nothing to do.");
      return;
    }
    if (existing.length) {
      throw new Error(
        `This database already has tables (${existing.map((r) => r.name).join(", ")}…). ` +
          "db:setup only initialises an empty database; an existing install is upgraded with the migrations in scripts/.",
      );
    }

    const [schema, seed] = await Promise.all([
      readFile(join(DB_DIR, "schema.sql"), "utf8"),
      readFile(join(DB_DIR, "seed.sql"), "utf8"),
    ]);
    await sql.begin(async (tx) => {
      // simple(): the files hold many statements and no parameters.
      await tx.unsafe(schema).simple();
      // The dump empties search_path for its own session; restore it for the seed.
      await tx.unsafe("set local search_path = public").simple();
      await tx.unsafe(seed).simple();
    });

    const [{ tables }] = await sql`
      select count(*)::int as tables from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')`;
    console.log(`Database ready: ${tables} tables. Next: \`bun run dev\`, then sign up at /sign-up.`);
  } finally {
    await sql.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
