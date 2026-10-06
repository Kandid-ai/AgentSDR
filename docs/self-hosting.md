---
title: "Self-hosting"
description: "Requirements, Docker Compose or from source, first sign-up, scheduled jobs, webhooks, upgrading and backups."
icon: "server"
---

AgentSDR is one Next.js application backed by one PostgreSQL database. There is
no queue server, no Redis and no separate worker process: background work runs
inside the app process (see [Scheduled jobs](#scheduled-jobs)).

## Requirements

- PostgreSQL 16 or newer. `db:setup` refuses older servers. The schema is
  tested on 16, 17 and 18.
- Either Docker (with Compose), or Node.js 20.9+ / Bun 1.2+ to run from source.
  The Docker image and the repository's tooling use Bun.
- A public HTTPS origin if you want webhooks to reach you (Unipile, Gmail push)
  and email links to work for other people.
- A [Resend](https://resend.com) account for sign-up, password-reset and
  invitation email (required in production, see [Email](#email)).

Third-party services (Unipile, Google Workspace, Cloudflare R2, OpenRouter,
enrichment providers) are not configured in the environment. You connect them
from inside the app, per organization. See [integrations.md](integrations.md).

## Option A: Docker Compose

The repository's `docker-compose.yml` defines four services:

| Service | What it does |
|---|---|
| `db` | PostgreSQL 18 with a persistent volume. |
| `setup` | One-shot job: runs `bun scripts/db/setup.ts --if-empty`, which creates the schema and reference rows if the database is empty and does nothing otherwise. The `app` waits for it. |
| `app` | The image built from the repository `Dockerfile`, listening on port 3000. |
| `cron` | A small `curl` sidecar that calls the scheduled-job endpoints listed under [Scheduled jobs](#scheduled-jobs). |

Steps:

1. Copy the example environment file and fill it in. The values you must set
   are listed in [configuration.md](configuration.md#minimum-production-configuration):
   `BETTER_AUTH_SECRET`, `INTEGRATION_CREDENTIALS_KEY`, `UNSUBSCRIBE_SECRET`,
   `CRON_SECRET`, `OUTREACH_TICK_SECRET`, `BETTER_AUTH_URL`, `POSTGRES_PASSWORD`, and the Resend
   settings (Resend can wait until you invite people).
2. `docker compose up -d`
3. Open the public URL and [sign up](#first-sign-up-and-the-organization).

Notes:

- The bundled `db` service does not use TLS. The app connects with TLS by
  default, so a database without it needs `DATABASE_SSL=disable`. If you point
  `DATABASE_URL` at a managed database, leave `DATABASE_SSL` unset.
- Set `POSTGRES_PASSWORD` (required by Compose, and used to build the app's
  `DATABASE_URL`) and, if port 3000 is taken on the host, `PORT` (the published
  host port). `BETTER_AUTH_URL` is read at runtime, so one image works for any
  domain.
- On a server with no Resend account yet, you can still create and verify the
  first account: the verification email is written to the app log, so run
  `docker compose logs app` and open the link. Set up Resend before inviting
  anyone (see [Email](#email)).
- The app is designed to run as a **single instance**. The outreach sender loop
  has no distributed lock; two instances would each send. Do not scale `app` to
  more than one replica. (The enrichment and CRM workers are safe to overlap;
  the outreach scheduler is not.)

### Using your own PostgreSQL

The bundled `db` service is the default. To use a PostgreSQL 16+ you already
run (a hosted one, for example) instead, add to `.env`:

```sh
COMPOSE_FILE=docker-compose.yml:docker-compose.external-db.yml
DATABASE_URL=postgres://user:password@your-host:5432/agentsdr
DATABASE_SSL=            # empty = TLS on, which hosted Postgres expects
```

and run `docker compose up -d` as usual. The `db` service is not started, and
the `setup` service creates the schema in your database on first start, so the
database must be empty then. `POSTGRES_PASSWORD` is unused in this mode; leave
the example value. This needs Docker Compose 2.24 or newer.

## Option B: from source

```sh
git clone https://github.com/Kandid-ai/AgentSDR.git
cd AgentSDR
bun install
cp .env.example .env.local        # then edit it, see configuration.md
bun run db:setup                  # creates the schema in an EMPTY database
bun run build
bun run start                     # serves on http://localhost:3000
```

`bun run db:setup` reads `DATABASE_URL` (and `DATABASE_SSL`) from the
environment. Bun loads `.env.local` automatically for it. It applies
`db/schema.sql` and `db/seed.sql` in one transaction and refuses to run if the
database already contains tables. See [database.md](database.md).

`next start` reads `.env.local` as well. Put the process behind a reverse proxy
(Caddy, nginx, a load balancer) that terminates TLS and forwards to port 3000.
Run it under a supervisor (systemd, Docker, PM2) so it restarts on failure.

## First sign-up and the organization

1. Open `/sign-up` and create an account. Email verification is required before
   password sign-in works, so the verification email must be deliverable (see
   [Email](#email)). With no `RESEND_API_KEY` the email is written to the
   server log instead (with a one-time warning in production), so you can copy
   the link from there.
2. A signed-in user with no organization is sent to `/onboarding`, which asks
   you to create one (a name and a URL slug). You become its owner.
3. Everything in AgentSDR belongs to an organization. Invite teammates from
   Settings, Members; an invitation is sent by email and expires after 7 days.
4. Connect your services in Settings, Integrations
   ([integrations.md](integrations.md)).

### Who may sign up

`AUTH_SIGNUP` controls it:

- `invite-only` (default): the instance's very first account can always be
  created. After that an account is created only for
  an email address with a pending, unexpired invitation; any other sign-up gets
  Better Auth's normal "check your email" response and no account is created
  (the sign-up page shows an invite-only notice, and the sign-in page no longer
  offers "Create one"). Only owners and admins of the first organization (or the
  first user, before any organization exists) can create organizations. This
  covers Google sign-in too.
- `open`: anyone who can reach the instance can create an account and an
  organization. Suited to a public, multi-customer deployment; set it
  explicitly.

Invitations work in both modes.

The "platform operator" is an owner or admin of the organization flagged
`initial` (installs migrated from the single-workspace version), otherwise of
the **oldest** organization. On a fresh install that is the first organization
you create. Only the operator sees system-wide job logs (Settings, LinkedIn
jobs); everything else is per organization.

## Public URL

`BETTER_AUTH_URL` is the one required public-origin setting (for example
`https://sdr.example.com`, no trailing slash). It is read at runtime and used
for sign-in and Better Auth's trusted origin, email links (including
unsubscribe links in sent campaigns), and Unipile hosted-auth redirect and
notify URLs. `NEXT_PUBLIC_APP_URL` is a legacy fallback, used only if
`BETTER_AUTH_URL` is unset; it is inlined at build time, so prefer
`BETTER_AUTH_URL`.

A `localhost` value works for development but is not reachable by Unipile or by
the recipients of your email.

## Email

Sign-up verification, password reset and invitations are sent through Resend.
Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` (an address on a domain you have
verified in Resend). Without `RESEND_API_KEY`, verification, reset and
invitation emails are written to the server log (with a one-time warning in
production) instead of sent: enough to verify the first account from the logs,
but you need Resend before inviting anyone. This is separate from the email your campaigns send,
which goes out through the Gmail accounts you connect.

Optional: set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to add "Continue
with Google" ([integrations.md](integrations.md#google-sign-in)).

## Scheduled jobs

Some work runs inside the app process; the rest must be triggered by something
calling an HTTP endpoint. In Compose the `cron` sidecar does this. Otherwise use
your platform's scheduler or the host's cron with `curl`.

### In-process (nothing to configure)

Started from `src/instrumentation.ts` when the server boots:

| Worker | What it does | Notes |
|---|---|---|
| Outreach scheduler | Sends the next queued email for each mailbox every minute (`OUTREACH_TICK_INTERVAL_MS`, default 60000). | **Production only** (`NODE_ENV=production`). Single instance only. |
| Enrichment (grid) worker | Runs queued cells of Tables. | Safe with several instances (`FOR UPDATE SKIP LOCKED`). Also runs in development. |
| CRM worker | Classifies replies and drafts responses from the durable job queue. | Safe with several instances. |

### External (you must schedule these)

Every request is `POST`. Replace `$APP` with your public origin.

| Endpoint | Auth | Suggested schedule | Purpose |
|---|---|---|---|
| `/api/outreach/build-queue` | `OUTREACH_TICK_SECRET` | Once a day at a fixed time, early morning | Rebuilds each mailbox's send queue for the day and resets daily send counters. Safe to call more than once. Without it nothing is sent. |
| `/api/outreach/mailboxes/watch` | `OUTREACH_TICK_SECRET` | Once a day | Renews Gmail push watches, which expire after about 7 days. Needed only if you use the Gmail Pub/Sub reply sync. |
| `/api/linkedin/jobs/run-outreach` | `CRON_SECRET` | Every few minutes (it checks each account's working hours and daily limits itself) | LinkedIn: syncs accounts, resolves profiles, sends invitations and follow-ups. |
| `/api/linkedin/jobs/run-search-queue` | `CRON_SECRET` | Every few minutes | LinkedIn: works queued lead searches. Skips if a previous run is still going. |
| `/api/linkedin/jobs/reset-daily-limits` | `CRON_SECRET` | Once a day, at midnight in the timezone you want | LinkedIn: resets per-account daily counters and prunes old job and webhook history. |
| `/api/linkedin/jobs/replay-webhooks` | `CRON_SECRET` | Every few minutes | LinkedIn: re-processes failed or abandoned webhook deliveries. |
| `/api/outreach/tick` | `OUTREACH_TICK_SECRET` | **Do not schedule.** | Manual or backup trigger for one send tick. The in-process scheduler already does this; scheduling it as well double-ticks. |

The schedules for the four LinkedIn jobs are suggestions, not values from the
code: the code does not state a frequency for them, only that each run
respects working hours, limits and an overlap guard.

Authentication:

- `OUTREACH_TICK_SECRET` endpoints take the secret as `?secret=...` or the
  `x-tick-secret` header. The endpoint answers 401 when the variable is unset.
- `CRON_SECRET` endpoints take `Authorization: Bearer $CRON_SECRET`. With the
  secret the call serves every organization; a signed-in member calling the
  same route only runs their own organization.

Examples:

```sh
curl -fsS -X POST -H "x-tick-secret: $OUTREACH_TICK_SECRET" "$APP/api/outreach/build-queue"
curl -fsS -X POST -H "x-tick-secret: $OUTREACH_TICK_SECRET" "$APP/api/outreach/mailboxes/watch"
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET"   "$APP/api/linkedin/jobs/run-outreach"
```

Example crontab (UTC):

```cron
0 5 * * *    curl -fsS -X POST -H "x-tick-secret: $OUTREACH_TICK_SECRET" "$APP/api/outreach/build-queue"
15 5 * * *   curl -fsS -X POST -H "x-tick-secret: $OUTREACH_TICK_SECRET" "$APP/api/outreach/mailboxes/watch"
*/10 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP/api/linkedin/jobs/run-outreach"
*/10 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP/api/linkedin/jobs/run-search-queue"
*/10 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP/api/linkedin/jobs/replay-webhooks"
0 0 * * *    curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP/api/linkedin/jobs/reset-daily-limits"
```

If you do not use LinkedIn, the `CRON_SECRET` jobs are not needed. If you do
not use email outreach, the `OUTREACH_TICK_SECRET` jobs are not needed.

## Webhooks that must be reachable

These endpoints are public (no session cookie) and need your instance to be
reachable from the internet. See [integrations.md](integrations.md) for how to
register each one.

| Endpoint | Caller | Protection |
|---|---|---|
| `/api/webhooks/connection-accepted` | Unipile (LinkedIn `new_relation`) | `?secret=` checked against the organization's stored Unipile webhook secret when present; a request with no secret is accepted and logged as a warning. |
| `/api/webhooks/message-received` | Unipile (LinkedIn `message_received`) | Same as above. |
| `/api/webhooks/whatsapp-message` | Unipile (WhatsApp messages) | `?secret=` or `x-unipile-secret` required. |
| `/api/webhooks/unipile-account` | Unipile hosted-auth `notify_url` | `?secret=` required; `?org=` names the organization. |
| `/api/outreach/webhooks/gmail-watch` | Google Cloud Pub/Sub push subscription | None; only addresses of connected mailboxes are acted on. |
| `/api/call-recorder/*` | The WhatsApp recorder browser extension | Per-call bearer token. |
| `/unsubscribe`, `/api/outreach/unsubscribe` | Recipients of your email | Signed token (`UNSUBSCRIBE_SECRET`). |

Do not expose `/api/webhooks/[id]` publicly; it is behind sign-in on purpose.

## WhatsApp call recorder extension

Calls placed from AgentSDR are recorded by the Chrome extension in
`extensions/whatsapp-recorder/`. The extension only talks to AgentSDR
addresses it knows. To use it with your own domain:

1. Build it with `bun run build:recorder` and load
   `extensions/whatsapp-recorder/dist` as an unpacked extension in Chrome
   (`chrome://extensions`, Developer mode, Load unpacked).
2. Open the extension's **Options** (`chrome://extensions`, Details, Extension
   options), add your AgentSDR address (for example
   `https://sdr.yourcompany.com`), and allow access when Chrome asks.
3. Reload any AgentSDR tab that was already open.

Each person who places calls does this once in their own Chrome; nothing is
rebuilt per domain.

Recordings are stored in your Cloudflare R2 bucket
([integrations.md](integrations.md#cloudflare-r2)).

## Upgrading

Upgrading an existing install is **not** done with `db:setup`. That script only
initialises an empty database and refuses to run otherwise.

1. Back up the database ([Backups](#backups)).
2. `git pull` (or pull the new image tag).
3. Find the migrations added since your last version: the schema history is the
   set of scripts in `scripts/`, applied in the order they were committed.
   `git log --diff-filter=A --name-only --format= <old>..<new> -- scripts/`
   lists the scripts added between two versions. The release notes in
   [CHANGELOG.md](https://github.com/Kandid-ai/AgentSDR/blob/main/CHANGELOG.md) name any migration you must run.
4. Run each new migration against your database, for example
   `bun scripts/<name>.ts` (older ones are plain JavaScript, run with
   `node scripts/<name>.js`). They load `.env.local` and connect with
   `DATABASE_URL`, are guarded with `IF NOT EXISTS` / `IF EXISTS`, and are safe
   to re-run.
5. Rebuild and restart (`bun run build && bun run start`, or
   `docker compose pull && docker compose up -d`).
6. Optionally verify: `bun run db:check` audits the database against the
   tenancy registry.

Never change `INTEGRATION_CREDENTIALS_KEY` or `BETTER_AUTH_SECRET` during an
upgrade (see [configuration.md](configuration.md#secrets)).

## Backups

Back up the PostgreSQL database; it holds everything, including the encrypted
integration credentials. Keep a copy of `INTEGRATION_CREDENTIALS_KEY`
separately: without it the stored credentials cannot be decrypted and every
integration has to be reconnected.

```sh
pg_dump --format=custom --no-owner --no-privileges --file agentsdr.dump "$DATABASE_URL"
```

`pg_dump` must be at least as new as the server. Restore into an empty database
with `pg_restore --no-owner --dbname "$DATABASE_URL" agentsdr.dump`. Call
recordings live in R2, not in the database; back that bucket up separately.

## Database connections

The app uses one connection pool of at most `DB_POOL_MAX` connections
(default 8). PostgreSQL's `max_connections` is shared by everything that points
at the server. When it is exhausted, every query fails at once with `remaining
connection slots are reserved for roles with the SUPERUSER attribute`: that
means capacity, not a bug. Before raising `DB_POOL_MAX`, check
`select count(*) from pg_stat_activity`, and allow for a rolling deploy briefly
running two containers (two pools).
