/**
 * Adds `api_keys.scopes` (text[]): what a key may do, from
 * src/lib/publicApi/scopes.ts. NULL means every scope, so keys created
 * before this column keep working exactly as before.
 *
 * Run with:  bun run scripts/add-api-key-scopes.ts
 *
 * Re-runnable and additive. Keep in sync with src/lib/publicApi/schema.ts.
 */
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (bun loads .env.local)");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes text[]`);
    const [row] = await sql<{ data_type: string }[]>`
      SELECT data_type FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'scopes'`;
    console.log("api_keys.scopes:", row?.data_type ?? "missing");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
