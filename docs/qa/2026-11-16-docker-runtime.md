# TypeLune Docker runtime QA (2026-11-16)

Tested commit: 256d03cce5ca378ab2e9cfe5c6784dab9c71b168. Source reproduced from main bfc139a0208ea1b85e87aee6570d82131050e77e plus binary git diff; QA screenshot binaries excluded. No source changes made.

Environment: new ephemeral Vercel Sandbox microVM; Docker 29.1.3, Compose 2.40.3, PostgreSQL 18.7. Hobby free plan verified before creation. No public routes, no production credentials/data, fictitious administrator and QR explicitly labelled NOT PAYMENT. Existing computers were not changed by these isolated tests.

## Passed
- Actual project Dockerfile built image dazi-ci:local (fcf678983166), not a host Node substitute.
- Actual compose.postgres.yaml with image-only override, isolated project typeluneqa3.
- Explicit setup profile: schema migration, support schema, 42 built-in articles, fictitious admin bootstrap.
- Caddy HTTP routing, homepage and health endpoint, password login.
- Admin support QR save, public read, unauthenticated write rejected with 403.
- Force-recreate PostgreSQL and app containers: all 27 public table row counts and support contents persisted in named volume.
- Stop app/Caddy before backup; pg_dump custom-format restored to independent PostgreSQL 18.7 container and fresh volume. Every public table row count AND sorted row-content digest matched.
- Final complete harness exited 0, duration 72.994 seconds.
- Backup: 268833 bytes; SHA256 94364cad5ff389fcaf0d599be71559282d47d2588490ec36f4baa49cc0fc2727.

## Limitations and corrected test-harness faults
- Initial harness incorrectly passed --no-build to compose run and used articles instead of public_articles; fixed in harness only.
- Comparing a live database after backup saw changed rate_limit_entries; stopped app before consistent comparison, then all tables matched.
- pg_isready over local socket can see the temporary initialization server before target DB exists; final harness waits for TCP readiness before restore.
- This verifies local HTTP Caddy and container persistence, not public DNS/TLS issuance, physical-host reboot or real mail/payment delivery.
- UI screenshots and Chrome regression belong to [account-language/browser report](2026-11-16-account-language.md). This commit excludes later account-language preference increment until separately verified.
- npm audit --omit=dev: 0 vulnerabilities. Full audit: 2 high development-dependency findings through @vercel/routing-utils/path-to-regexp GHSA-9wv6-86v2-598j; no automatic major dependency changes made.
- Docker image Node 26.13.1 passes build/runtime but package.json engines still targets Node 22; align declared support separately.

Raw harnesses, logs and audits are retained separately as private QA artifacts. The harness contains synthetic credentials and QR content only and is specific to the disposable environment, not a production operator. Use the [deployment guide](../docker-postgres.md) for reviewed operational steps.

## Final candidate increment verified
Commit 788982a2ae1e594184ebc0d43d2b1a3034a0bdf1, actual rebuilt image f9e5fc80e440.
The build and test command completed exit 0 in 116.433 seconds (build plus complete Compose test).
New Compose PostgreSQL TCP healthcheck passed. Account preferences auto/en/zh saved and read through container API; invalid values rejected without modifying stored preference. Chinese preference survived PostgreSQL and app container replacement. All original login/QR/access control/persistence/backup-restore checks repeated and passed on this candidate.
Restored all 27 public table counts and sorted content digests, 42 articles included. Backup 269133 bytes, SHA256 43442e61dce47c33e2601c092b6abf8327b1e03f45ac492bf4b3cfe1d3519888.
Evidence: typelune-compose-locale.log. This is an API/container persistence verification, not a substitute for the browser locale interaction tests.

## SQLite compatibility supplement
Same final image/candidate: existing scripts/ci-docker-smoke.mjs passed homepage, API, ownership, pause/resume, feedback attachments, statistics settings, legacy deletion markers, volume replacement and backup restore. The test command exited 0 (21.514 seconds including host test dependency install). Only temporary harness sharp import path adapted to isolated qa-deps; source test assertions unchanged. Earlier attempts lacked host sharp/tsx/@noble dependencies, resolved by installing test dependencies; these were not application failures. Actual application always ran in Docker, not host Node. Evidence: typelune-sqlite-verified.log.
