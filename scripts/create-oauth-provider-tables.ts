/**
 * Creates the OAuth 2.1 provider tables behind the MCP server (/api/mcp):
 * the JWT plugin's signing keys (`jwks`) and @better-auth/oauth-provider's
 * clients, resources, tokens and consents (used through @better-auth/mcp).
 *
 * Run with:  bun run scripts/create-oauth-provider-tables.ts
 *
 * Re-runnable and additive: every statement is guarded and nothing existing
 * is touched, so it is safe to run before the code that uses it deploys.
 * Keep in sync with src/lib/auth/schema.ts (JS field names there are the
 * plugins'; the column names here are ours).
 */
import postgres from "postgres";

const SQL = `
CREATE TABLE IF NOT EXISTS jwks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_key text NOT NULL,
  private_key text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz,
  alg text,
  crv text
);

CREATE TABLE IF NOT EXISTS oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  client_secret text,
  client_discovery_id text,
  disabled boolean DEFAULT false,
  skip_consent boolean,
  enable_end_session boolean,
  subject_type text,
  scopes text[],
  client_credentials_scopes text[] DEFAULT '{}',
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz,
  updated_at timestamptz,
  name text,
  uri text,
  icon text,
  contacts text[],
  tos text,
  policy text,
  software_id text,
  software_version text,
  software_statement text,
  redirect_uris text[] NOT NULL,
  post_logout_redirect_uris text[],
  backchannel_logout_uri text,
  backchannel_logout_session_required boolean,
  token_endpoint_auth_method text,
  application_type text,
  jwks text,
  jwks_uri text,
  grant_types text[],
  response_types text[],
  require_pkce boolean,
  dpop_bound_access_tokens boolean DEFAULT false,
  reference_id text,
  metadata jsonb
);
CREATE INDEX IF NOT EXISTS oauth_clients_user_id_idx ON oauth_clients (user_id);

CREATE TABLE IF NOT EXISTS oauth_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL UNIQUE,
  name text NOT NULL,
  access_token_ttl integer,
  refresh_token_ttl integer,
  signing_algorithm text,
  signing_key_id text,
  allowed_scopes text[],
  custom_claims jsonb,
  dpop_bound_access_tokens_required boolean DEFAULT false,
  disabled boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz,
  policy_version integer DEFAULT 1,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS oauth_client_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  resource_id text NOT NULL REFERENCES oauth_resources(identifier) ON DELETE CASCADE,
  metadata jsonb,
  created_at timestamptz
);
CREATE INDEX IF NOT EXISTS oauth_client_resources_client_id_idx ON oauth_client_resources (client_id);
CREATE INDEX IF NOT EXISTS oauth_client_resources_resource_id_idx ON oauth_client_resources (resource_id);

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference_id text,
  authorization_code_id text,
  resources text[],
  requested_user_info_claims text[],
  expires_at timestamptz,
  created_at timestamptz,
  revoked timestamptz,
  rotated_at timestamptz,
  rotation_replay_response text,
  rotation_replay_expires_at timestamptz,
  auth_time timestamptz,
  confirmation jsonb,
  scopes text[] NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_client_id_idx ON oauth_refresh_tokens (client_id);
CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_session_id_idx ON oauth_refresh_tokens (session_id);
CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_user_id_idx ON oauth_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_authorization_code_id_idx ON oauth_refresh_tokens (authorization_code_id);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE,
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  reference_id text,
  authorization_code_id text,
  resources text[],
  requested_user_info_claims text[],
  refresh_id uuid REFERENCES oauth_refresh_tokens(id) ON DELETE CASCADE,
  expires_at timestamptz,
  created_at timestamptz,
  revoked timestamptz,
  confirmation jsonb,
  scopes text[] NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_client_id_idx ON oauth_access_tokens (client_id);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_session_id_idx ON oauth_access_tokens (session_id);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_user_id_idx ON oauth_access_tokens (user_id);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_authorization_code_id_idx ON oauth_access_tokens (authorization_code_id);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_refresh_id_idx ON oauth_access_tokens (refresh_id);

CREATE TABLE IF NOT EXISTS oauth_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  reference_id text,
  resources text[],
  requested_user_info_claims text[],
  scopes text[] NOT NULL,
  created_at timestamptz,
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS oauth_consents_client_id_idx ON oauth_consents (client_id);
CREATE INDEX IF NOT EXISTS oauth_consents_user_id_idx ON oauth_consents (user_id);

CREATE TABLE IF NOT EXISTS oauth_client_assertions (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (bun loads .env.local)");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(SQL);
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND (table_name = 'jwks' OR table_name LIKE 'oauth\\_%')
      ORDER BY table_name`;
    console.log("OAuth provider tables present:", rows.map((r) => r.table_name).join(", "));
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
