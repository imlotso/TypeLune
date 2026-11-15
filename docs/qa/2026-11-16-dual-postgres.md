# Dual PostgreSQL deployment paths

Both paths are supported. This does not replace Vercel and does not remove the existing SQLite `compose.yaml` compatibility route.

## Vercel + PostgreSQL
Keep the existing `DATABASE_URL`, `DAZI_DATABASE_SCHEMA`, stable `CODE_SECRET`, routing and Vercel deployment. Before enabling support QR configuration, run the explicitly targeted PostgreSQL operator with action `support` against the selected database/schema. It only adds `support_settings`; it does not change immutable schema 1/2 checksums or legacy settings. Without it the public support entry is hidden and the administrator sees 503, while other routes continue working.

Local operator commands use `npm run db:postgres -- support`. Required target guards are unchanged: `DAZI_DATABASE_HOST`, `DAZI_DATABASE_NAME`, `DAZI_DATABASE_SCHEMA`, `DAZI_CONFIRM_TARGET=host/database/schema`, and matching `DATABASE_URL`. Never print that URL or commit credentials.

## Docker + PostgreSQL 18
`compose.postgres.yaml` is the separate self-hosted route, using official `postgres:18.7`. PostgreSQL 19 is not selected. PostgreSQL persists under `/var/lib/postgresql` as required by the official 18 image; its port is not published. No data is stored inside disposable app containers.

Prepare a private `.env.postgres` containing a random hex `POSTGRES_PASSWORD`, matching `DATABASE_URL=postgresql://typelune:<password>@postgres:5432/typelune`, stable random `CODE_SECRET`, and `SITE_DOMAIN`. Add SMTP/operator details only when wanted. Do not commit this file.

After selecting and confirming the intended empty installation:

```
docker compose --env-file .env.postgres -f compose.postgres.yaml build
docker compose --env-file .env.postgres -f compose.postgres.yaml up -d postgres
docker compose --env-file .env.postgres -f compose.postgres.yaml --profile setup run --rm db-init
docker compose --env-file .env.postgres -f compose.postgres.yaml up -d app caddy
```

`db-init` explicitly runs migration, the additive support extension and catalog seed; application startup never silently migrates PostgreSQL. The image includes `scripts/postgres-database.mjs`, which also supports targeted bootstrap/import/export operations. Admin password input for bootstrap goes through stdin, not arguments or logs. Keep `CODE_SECRET` stable across rebuilds to retain encrypted SMTP configuration.

Use `pg_dump`/`pg_restore` for PostgreSQL backup/restore so the optional QR table is included. The repository SQLite transfer operators now also recognize and hash/verify the optional support table, including its revision. Existing old code can ignore that independent table; old site-settings JSON is unchanged.

## Verification and honest limits
- Official EDB portable PostgreSQL 18.7 on Windows, loopback-only disposable cluster, no production data.
- Final complete suite with real PostgreSQL enabled: 130 files / 634 tests passed, no skips (84.08 seconds, maxWorkers=2). Type check and application build passed. A temporary uncommitted operator bundle initially matched test discovery; after renaming it, the clean final run passed.
- Actual PostgreSQL suite: 11 files / 41 tests passed, including Vercel handler rewrites and HTTP login, Node HTTP endpoints, schema upgrades, target guards, SQLite/PG transfers, rate limits, SMTP configuration, and support upload/public read/restart persistence/QR decoding.
- Vercel-specific Node 22.23.5 + PostgreSQL 18.7 rerun: 3 files / 14 tests passed; emitted Vercel Function imported successfully. No shared native dependencies were rebuilt.
- Bundled `support` operator ran twice against a unique disposable PostgreSQL schema and created exactly one table; the test schema was removed afterward.
- Import target safety also rejects an older SQLite source when the PostgreSQL target already holds optional support settings; the regression was observed failing before the guard fix and passes afterward.
- New support test proves absent extension fails closed, installation is repeatable, legacy schema verification remains valid, unauthorized writes fail, revision conflicts fail, and metadata does not leak publicly.
- `scripts/ci-docker-postgres-smoke.mjs` prepares isolated official PG18 + app containers, explicit schema/setup, bootstrap, login, QR upload, unauthorized denial and database/app restart persistence. Run with `DAZI_TEST_IMAGE` pointing to the built image and `npm run test:docker:postgres`.
- Docker execution has NOT been verified on this host: Soul has no Docker executable/service, and the Dot cloud worker also has no Docker CLI. Node+PG success is not a container pass. Compose and container build/run must be checked on a Docker-enabled isolated host before claiming Docker acceptance.
- No GitHub Actions were triggered; no production deployment, database migration, SMTP delivery or real payment code upload was performed.

Sources: https://www.postgresql.org/about/news/postgresql-187-1712-1616-1520-1425-and-19-rc-2-released-3442/ ; https://www.postgresql.org/download/windows/ ; https://productsdl.enterprisedb.com/download-postgresql-binaries
