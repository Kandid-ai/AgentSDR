---
title: "Configuration reference"
description: "Every environment variable AgentSDR reads, with defaults and where it is read."
icon: "sliders-horizontal"
---

Every environment variable the code reads. Copy `.env.example` to `.env.local`
(source installs) or put the values in the environment of the container.

**Third-party service credentials are not environment variables.** Unipile,
Google Workspace (Gmail), Cloudflare R2, OpenRouter and the enrichment
providers are connected per organization from Settings in the running app and
stored encrypted in the database. There is no environment fallback. See
[integrations.md](integrations.md). The environment only holds what is needed
before the database can be read, public URLs, cron secrets and tuning knobs.

"Read in" lists the file that reads the variable.

## Minimum production configuration

| Variable | Why |
|---|---|
| `DATABASE_URL` | The database. |
| `BETTER_AUTH_SECRET` | Signs sessions. |
| `BETTER_AUTH_URL` | The public origin, read at runtime. |
| `RESEND_API_KEY` and `AUTH_EMAIL_FROM` | Sign-up verification, password reset, invitations. Needed before inviting anyone in production; without them these emails go to the server log. |
| `INTEGRATION_CREDENTIALS_KEY` | Encrypts saved integration credentials. |
| `UNSUBSCRIBE_SECRET` | Signs unsubscribe links in sent email; sending fails without it. |
| `OUTREACH_TICK_SECRET` | Authenticates the email cron endpoints. |
| `CRON_SECRET` | Authenticates the LinkedIn cron endpoints (only if you use LinkedIn). |

Generate each secret with `openssl rand -hex 32`.

## Core

| Variable | Required | Default | Purpose | Read in |
|---|---|---|---|---|
| `DATABASE_URL` | yes | none | PostgreSQL connection string. The app throws at start if it is missing. Also used by drizzle-kit and every script. | `src/lib/db.ts`, `drizzle.config.ts`, `scripts/db/*.ts`, `scripts/lib/organization.ts` |
| `DATABASE_SSL` | no | TLS required | Set to `disable` to connect without TLS (a local or Compose database). Any other value, or unset, requires TLS. | `src/lib/db.ts`, `scripts/db/setup.ts`, `scripts/db/dump-schema.ts`, `scripts/lib/organization.ts`, `scripts/check-organization-scope.ts` |
| `DB_POOL_MAX` | no | `8` | Maximum connections in the app's single pool. Keep it well under the server's `max_connections` across all running instances (a rolling deploy runs two). | `src/lib/db.ts` |

## Auth

| Variable | Required | Default | Purpose | Read in |
|---|---|---|---|---|
| `BETTER_AUTH_SECRET` | yes | none | Signs sessions. 32+ random characters. Keep it stable: changing it signs everyone out. | `src/lib/auth/server.ts` |
| `BETTER_AUTH_URL` | yes | `NEXT_PUBLIC_APP_URL` | The app's public origin, no trailing slash. Read at **runtime** (`src/lib/http/publicAppUrl.ts`) for Better Auth's links and trusted origin, unsubscribe links in sent email, and Unipile hosted-auth redirect and notify URLs. | `src/lib/auth/server.ts`, `src/lib/http/publicAppUrl.ts`, `src/lib/outreach/render.ts`, `src/lib/linkedin/hostedAuthUrls.ts` |
| `AUTH_SIGNUP` | no | `invite-only` | `invite-only`: the first account can always be created; after that only an email with a pending, unexpired invitation gets an account (others get the normal "check your email" response and nothing is created), and only owners and admins of the first organization (or the first user, before any organization exists) can create organizations. Covers Google sign-in; the sign-in page stops offering "Create one". `open`: anyone can sign up and create organizations. | `src/lib/auth/signup.ts` |
| `RESEND_API_KEY` | needed before inviting anyone in production | none | Resend API key for auth email. If unset, verification, reset and invitation emails are written to the server log (with a one-time warning in production) instead of sent, so the first account can be verified from `docker compose logs app`. | `src/lib/auth/email.ts` |
| `AUTH_EMAIL_FROM` | when `RESEND_API_KEY` is set | none | Sender, for example `AgentSDR <auth@yourdomain.com>`, on a domain verified in Resend. | `src/lib/auth/email.ts` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | none | Enables "Continue with Google" sign-in. Both must be set. Redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`. | `src/lib/auth/server.ts` |

## Secrets

| Variable | Required | Default | Purpose | Read in |
|---|---|---|---|---|
| `INTEGRATION_CREDENTIALS_KEY` | yes | none | Key for AES-256-GCM encryption of every saved integration credential. Use the same value on every instance sharing the database. Changing it makes stored credentials unreadable: re-encrypt with `bun run rotate:integration-credentials` (new key in `INTEGRATION_CREDENTIALS_KEY`, old one in `LEGACY_INTEGRATION_CREDENTIALS_KEYS`) or reconnect the integrations. Store a copy outside the database. | `src/lib/integrations/credential-crypto.ts` |
| `UNSUBSCRIBE_SECRET` | yes, to send email | none | HMAC key for unsubscribe tokens in outreach email. Changing it breaks links already sent. | `src/lib/outreach/unsubscribeToken.ts` |
| `OUTREACH_TICK_SECRET` | yes, to use the email cron endpoints | none | Shared secret for `/api/outreach/build-queue`, `/api/outreach/mailboxes/watch` and `/api/outreach/tick`, sent as `?secret=` or the `x-tick-secret` header. The endpoints answer 401 while it is unset. | `src/app/api/outreach/{tick,build-queue,mailboxes/watch}/route.ts` |
| `CRON_SECRET` | yes, to use the LinkedIn cron endpoints | none | Bearer secret for `/api/linkedin/jobs/*`. | `src/proxy.ts`, `src/lib/linkedin/organizations.server.ts` |

## URLs

| Variable | Required | Default | Purpose | Read in |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | no | none | Legacy fallback for `BETTER_AUTH_URL`, used only when that is unset. Inlined at build time by Next.js, so prefer `BETTER_AUTH_URL`. | `src/lib/http/publicAppUrl.ts` |
| `OPENROUTER_SITE_URL` | no | `http://localhost:3000` | Sent to OpenRouter as the `HTTP-Referer` for request attribution. | `src/lib/ai/server/openrouter.ts` |
| `DEFAULT_PHONE_COUNTRY` | no | none | Two-letter country code used to parse phone numbers typed without a leading `+`, for organizations that have not set one in Settings → Organization → Defaults. Without either, such numbers are treated as invalid. Read at runtime; `NEXT_PUBLIC_DEFAULT_PHONE_COUNTRY` is the older, build-time name and still works as a fallback when set at build. | `src/lib/calls/phone.ts` |

## Docker Compose and demo

| Variable | Required | Default | Purpose | Read in |
|---|---|---|---|---|
| `POSTGRES_PASSWORD` | yes, with Compose | none | Password of the bundled PostgreSQL; Compose also builds the app's `DATABASE_URL` from it. | `docker-compose.yml` |
| `PORT` | no | `3000` | Host port Compose publishes the app on (`${PORT:-3000}:3000`). | `docker-compose.yml` |
| `DEMO_PASSWORD` | no | `demo-password-123` | Password of the demo user created by `bun run db:seed:demo`. | `scripts/db/seed-demo.ts` |
| `PG_DUMP` | no | `pg_dump` on `PATH` | Path to a `pg_dump` at least as new as the server, for `bun run db:schema:dump`. | `scripts/db/dump-schema.ts` |

## Workers and tuning

| Variable | Required | Default | Purpose | Read in |
|---|---|---|---|---|
| `OUTREACH_TICK_INTERVAL_MS` | no | `60000` | How often the in-process outreach scheduler runs a send tick. | `src/lib/outreach/internalScheduler.ts` |
| `GRID_WORKER_POLL_MS` | no | `1000` | Enrichment worker poll interval. | `src/lib/grid/worker.ts` |
| `GRID_WORKER_CONCURRENCY` | no | `8` | Enrichment cells processed at once. | `src/lib/grid/worker.ts` |
| `GRID_CELL_TIMEOUT_MS` | no | `30000` | Per-cell timeout. | `src/lib/grid/worker.ts` |
| `CRM_WORKER_POLL_MS` | no | `1000` (minimum 100) | CRM job poll interval. | `src/lib/crm/worker.ts` |
| `CRM_WORKER_CONCURRENCY` | no | `4` (minimum 1) | CRM jobs processed at once. | `src/lib/crm/worker.ts` |
| `CRM_WORKER_STALE_LOCK_MS` | no | `300000` (minimum 1000) | Age after which a claimed CRM job is considered abandoned and re-queued. | `src/lib/crm/worker.ts` |
Sending limits are not environment variables. Emails a day per mailbox, the
gap between emails, LinkedIn invitations a day and per run, WhatsApp warm-up,
new chats a day and the gap between sends are set per organization in
**Settings → Email / LinkedIn / WhatsApp → Sending rules**, with hard ceilings
and a warning past the safe edge. A LinkedIn account, WhatsApp number or
mailbox can override its daily limit. The rules, their defaults and bounds are
listed in `src/lib/channels/rules.ts`. The `WHATSAPP_NEW_CHAT_WARMUP_HOURS`,
`WHATSAPP_NEW_CHATS_PER_DAY` and `WHATSAPP_MIN_SECONDS_BETWEEN_SENDS` variables
of earlier versions are no longer read.

## Kill switches

Operational switches written for the unified-People data migration. They are
off by default and normally stay off. A value of `1`, `true`, `yes` or `on`
(case-insensitive) turns a switch on. They are re-read on every call, so they
take effect without a restart on platforms that refresh the environment. All
are read in `src/lib/migration/controls.ts`.

| Variable | Effect when on |
|---|---|
| `PEOPLE_MIGRATION_MODE` | Master switch. Pauses every background writer below, and answers 503 to campaign, import and manual-send mutations (`POST/PUT/PATCH/DELETE` under `/api/grid/tables/`, `/api/linkedin/{campaigns,jobs,leads,messages/send,search}`, `/api/outreach/{campaigns,inbox/,mailboxes/}`). Inbound webhooks and reads keep working. |
| `PAUSE_CAMPAIGN_MUTATIONS` | Only the 503 on those mutation routes. |
| `PAUSE_EMAIL_OUTBOUND` | Stops outgoing email sends. |
| `PAUSE_LINKEDIN_OUTBOUND` | Stops LinkedIn invitations and messages. |
| `PAUSE_LINKEDIN_RESOLUTION` | Stops LinkedIn profile resolution. |
| `PAUSE_LINKEDIN_SEARCH` | Stops the LinkedIn search queue. |
| `PAUSE_GRID_WORKER` | Stops the enrichment worker. |

These are also a handy emergency brake: setting `PAUSE_EMAIL_OUTBOUND=true` and
restarting stops sending without touching data.

## Prospecting (domain qualification)

Used only by the Domains / qualification feature, which is slated for removal.
Apollo for Tables is a separate per-organization connection.

| Variable | Required | Default | Purpose | Read in |
|---|---|---|---|---|
| `APOLLO_API_KEY` | for qualification | empty | A **master** Apollo API key (needed for `mixed_people/api_search`; others get 403). | `src/lib/qualification/config.ts` |
| `APOLLO_BASE_URL` | no | `https://api.apollo.io/api/v1` | Apollo API base. | `src/lib/qualification/config.ts` |
| `APOLLO_THROTTLE_MS` | no | `0` | Minimum milliseconds between Apollo search calls. The endpoint allows roughly 600 an hour; use about `6000` in production. | `src/lib/qualification/config.ts` |
| `ADS_PROVIDER` | no | `mock` | Ads-check provider. The stage is deferred; leave unset. | `src/lib/qualification/config.ts` |
| `ADS_API_KEY`, `ADS_BASE_URL` | no | empty | Credentials for the deferred ads stage. | `src/lib/qualification/config.ts` |

## User-named variables (Tables HTTP column)

The HTTP column in Tables can authenticate with a bearer token read from an
environment variable whose **name the user types** in the column settings
(`authEnvVar`). The secret therefore comes from the server's environment, never
from the database. Set whatever variable names your users reference. Read in
`src/lib/grid/runners/http.ts`.

## Runtime variables set by the platform

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` under `next start` / the Docker image. Turns on the outreach scheduler, and makes a missing `RESEND_API_KEY` log a one-time warning. |
| `NEXT_RUNTIME` | Set by Next.js. `instrumentation.ts` only starts workers when it is `nodejs`. |
| `PORT`, `HOSTNAME` | The Docker image sets `PORT=3000`, `HOSTNAME=0.0.0.0` for the standalone server inside the container. Not the same as the Compose `PORT` below. |

## Script-only variables

Read by tooling in `scripts/`, never by the running app.

| Variable | Script | Purpose |
|---|---|---|
| `ORGANIZATION_ID` | `scripts/lib/organization.ts` (used by one-shot scripts) | Organization the script runs as; defaults to the initial organization. |
| `BASE_URL`, `INITIAL_OWNER_EMAIL`, `INITIAL_OWNER_PASSWORD`, `ISOLATION_SKIP_WRITES` | `scripts/e2e/tenancy-isolation.ts` | See [development.md](development.md#tenancy-isolation-test). |
| `INITIAL_ORG_NAME`, `INITIAL_ORG_SLUG`, `INITIAL_OWNER_NAME`, `INITIAL_OWNER_EMAIL`, `INITIAL_OWNER_PASSWORD` | `scripts/add-organization-scope.ts` | One-time migration that introduced organizations. |
| `AUTH_SECRET`, `LEGACY_INTEGRATION_CREDENTIALS_KEYS` | `scripts/rotate-integration-credentials.ts` | Old keys to re-encrypt credentials from. |
| `LIVE_TEST_PERSON` | `scripts/test-integrations-live.ts` | Path to a JSON file describing a test person. |
| `PEOPLE_BACKFILL_CONCURRENCY` | `scripts/backfill-campaign-people.ts` | Backfill concurrency (default 8). |
| `LINKEDIN_PARITY_DATABASE_URL`, `LINKEDIN_PARITY_EXPECTED_DATABASE` | `scripts/audit-linkedin-migration-parity.ts` | Explicit target for a parity audit. |
| `APP_GIT_SHA` (or `VERCEL_GIT_COMMIT_SHA`, `RAILWAY_GIT_COMMIT_SHA`, `GIT_SHA`) | `scripts/export-people-migration-reconciliation.ts`, `scripts/rollback-people-migration.ts` | Recorded in migration reports. |

## Removed variables

`AUTH_PASSWORD` and `AUTH_SECRET` belonged to the old single shared password
and are no longer read by the app (`AUTH_SECRET` survives only as a legacy
key in the rotation script). `OPENROUTER_API_KEY`, `UNIPILE_*`, `GOOGLE_*`
service-account keys and `R2_*` are not read either: those services are
connected in Settings.
