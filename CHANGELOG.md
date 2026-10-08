# Changelog

All notable changes to AgentSDR are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Each release lists the database migrations it needs; see
[docs/maintainers/releasing.md](docs/maintainers/releasing.md).

## [Unreleased]

### Added

- **Public demo.** `DEMO_MODE=true` turns a separate deployment into a
  read-only AgentSDR anyone can open without signing in, and
  `bun run db:seed:demo` now fills it with Northwind, a fictional company's
  three months of email, LinkedIn and WhatsApp outbound, calls with
  transcripts, a full CRM pipeline with AI drafts awaiting review, Tables and
  Analytics. See docs/self-hosting/demo.mdx.

### Changed

- **License: MIT** (was AGPL-3.0-only). Anyone may use, modify, self-host,
  distribute and sell AgentSDR, including in closed-source products and
  hosted services, as long as the copyright and license notice is kept.
- **The app is only the app.** The marketing website, blog theme and launch
  film moved to their own repository (agentsdr.ai). `/` now opens the
  workspace (sign-in first), and the app asks search engines not to index it.
- **Call recorder 0.15.0**: the built-in hosted address is now
  `https://app.agentsdr.ai`. Self-hosted addresses are still added on the
  extension's Options page.

## [0.1.0] - 2026-10-06

The first public release.

### Added

- **Accounts, organizations and teams** with Better Auth: email and
  password sign-up with verification, Google sign-in, password reset,
  invitations, owner / admin / member roles, an organization switcher.
  Sign-up is invite-only by default (`AUTH_SIGNUP=open` opens it); the first
  account on a fresh install can always be created.
- **Multi-tenancy**: every record belongs to an organization; an isolation
  test suite (`scripts/e2e/tenancy-isolation.ts`) proves one organization
  cannot see, change or count another's data.
- **Per-organization integrations** configured in Settings — Unipile
  (LinkedIn and WhatsApp), Google Workspace (Gmail), Cloudflare R2,
  OpenRouter — with credentials encrypted at rest.
- Lead database with custom fields, email outreach with sequences and
  mailbox rotation, LinkedIn campaigns and search, WhatsApp messaging and
  recorded calls, an AI-assisted CRM inbox with reply classification and
  drafted responses, Tables with enrichment providers.
- **Fresh installs**: `bun run db:setup` creates the schema in an empty
  database from `db/schema.sql`; `bun run db:seed:demo` adds a demo
  organization with fictional data.
- **Unipile webhooks register themselves**: saving the Unipile integration
  registers the LinkedIn and WhatsApp webhooks in your Unipile workspace,
  each carrying your organization and a generated secret.
- **Settings by channel**: Email, LinkedIn and WhatsApp each have their
  accounts, their Connection (the integration they run on) and their
  **Sending rules** — the limits that used to be hardcoded (emails a day and
  the gap between them, sending hours, LinkedIn invitations a day and per run,
  delays, search leads a day, WhatsApp warm-up, new chats a day, seconds
  between sends) — with today's values as defaults, hard ceilings and a
  warning past the safe edge. A LinkedIn account or WhatsApp number can set
  its own daily limit; the default phone country is per organization.
  `/settings/integrations` redirects to the new pages.
- **Call recorder Options page**: add your own AgentSDR address in the
  extension; a self-hosted deployment no longer needs its own build.
- Docker Compose self-hosting, CI, and the project's community documents,
  including [responsible use](docs/responsible-use.md).
- **Public website** at [agentsdr.ai](https://agentsdr.ai): product pages for
  each channel, the AI CRM and the data tools, solutions for founders,
  agencies and sales teams, comparisons, guides and this changelog, with a
  sitemap and structured data for search.

### Migrations

- Existing single-workspace installations: follow
  [docs/multi-tenancy/cutover.md](docs/multi-tenancy/cutover.md)
  (`scripts/create-auth-tables.ts`, `scripts/add-organization-scope.ts`,
  then `scripts/finalize-organization-scope.ts` after deploying).
- Sending rules: `bun run scripts/add-channel-settings.ts` (additive; run it
  before deploying). The `WHATSAPP_*` sending variables are no longer read —
  set those limits in Settings → WhatsApp → Sending rules.

[Unreleased]: https://github.com/Kandid-ai/AgentSDR/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Kandid-ai/AgentSDR/releases/tag/v0.1.0
