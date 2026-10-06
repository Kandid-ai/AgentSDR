# AgentSDR documentation

This folder is also published as a docs site (Mintlify, configured in
[docs.json](docs.json)); see [Development](development.md#documentation).

## Product guides

- [Introduction](index.mdx), [Quickstart](quickstart.mdx) and [Concepts](concepts.mdx).
- [Leads](leads/overview.mdx), [Tables](tables/overview.mdx), [Email](email/campaigns.mdx), [LinkedIn](linkedin/campaigns.mdx), [WhatsApp](whatsapp/campaigns.mdx) and [calling](whatsapp/calling.mdx).
- [AI CRM](crm/overview.mdx), [Analytics](analytics.mdx), and workspace settings: [organizations](workspace/organizations.mdx), [AI provider](workspace/ai-provider.mdx), [sending rules](workspace/sending-rules.mdx).

## Using and self-hosting

- [Self-hosting](self-hosting.md): requirements, Docker Compose or from source, first sign-up, scheduled jobs, webhooks, upgrading, backups.
- [Configuration](configuration.md): every environment variable, with defaults and where it is read.
- [Responsible use](responsible-use.md): platform terms, email and privacy law, call recording consent, your data responsibilities.
- [Integrations](integrations.md): connecting Unipile, Google Workspace, Cloudflare R2, OpenRouter, enrichment providers, Resend and Google sign-in.

## Developing

- [Development](development.md): local setup, scripts, tests, database changes, code conventions.
- [Architecture](architecture.md): how the app is put together, request flow, background work, data model.
- [Multi-tenancy conventions](multi-tenancy/conventions.md): the rules every query, route, worker and webhook follows.

## Reference

- [Database](database.md): schema files, fresh-install tooling, migration history, drizzle-kit caveats, tenancy registry, connection pool.
- [Multi-tenancy plan](multi-tenancy/plan.md): how organizations and teams were designed and built.
- [Multi-tenancy cutover](multi-tenancy/cutover.md): the runbook for moving a single-workspace install onto organizations.
- [Prisma history](prisma-history/README.md): archived migrations of the LinkedIn tables, kept as a record.

## Maintainers

- [Releasing](maintainers/releasing.md): versioning, changelog, image publishing, release checklist.
- [Issue triage](maintainers/triage.md): labels, response expectations, security reports, stale policy.
- [Open-source readiness](maintainers/open-source-readiness.md): the plan and record of preparing the repository for release.

## Design history

Decision records kept for history; they may describe states the code has since
moved past. See [design/README.md](design/README.md).

- [Enrichment plan](design/enrichment-plan.md): the design of the Tables enrichment layer.
- [Unified lead database](design/unified-lead-database.md): the People and Companies ownership model.
- [Pre-migration remediation plan](design/pre-migration-remediation-plan.md): the plan for the unified-People data migration.
- [People migration runbook](design/people-migration-cutover-rollback-runbook.md): cutover, rollback and reconciliation steps for that migration.
