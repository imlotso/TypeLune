# TypeLune overnight integration, 2026-11-16

Isolated branch: `dot/typelune-lessons`, based on `bfc139a`. No production deployment, remote push, main-branch merge, GitHub Actions run, production database change, real email, or real payment QR was performed.

## Integrated behavior

- Chinese/English browser detection and explicit interface toggle remain independent of practice language. Existing input survives a UI-language switch.
- `/lessons` contains eight original, versioned English QWERTY lessons, optional static key/finger placement hints, actual accuracy, draft resume, and progress from matching records loaded for the current identity. These hints are not finger detection.
- Full text with at least 95% final accuracy completes a lesson. Real recorded errors drive the existing round-review exercise; otherwise the next lesson is offered. Lessons 4 and 8 also offer the same fixed-text phase retest.
- Weak-key exercises use verified error positions from up to 20 recent English records, at most five keys. They do not claim per-key timing or use another identity's records.
- Baseline/retest compares the first and latest complete same-version, non-strict full-article, offset-zero assessment. Scores are recomputed from actual typed text and elapsed time. Course/training rounds force these practice conditions without changing the user's global timed/strict preferences. All training snapshots are private/custom and unranked.
- Footer Help, Feedback, Privacy, Terms, About and Support have equal text-link weight. SiteTalk links to `https://www.sitetalk.net`. Support is hidden when disabled/unconfigured; opening the modal rereads current QR configuration rather than displaying stale images.
- Administrator QR settings use the common unsaved/busy guard. See donation and dual-PostgreSQL QA records for authorization, normalization, revision, migration and rollback details.
- Administration columns use `/admin?tab=...`. Direct login, reload, back/forward and cancellation preserve the selected column and unsaved input.

## Verification

- Final integrated PostgreSQL 18.7 + SQLite Vitest run: **142 files, 680 tests passed, no skipped tests, exit 0** (114.51 seconds). PostgreSQL was a disposable loopback instance, not a production connection. A final copy-only change from “this account” to “current identity” was additionally checked with the two assessment-panel tests.
- TypeScript passed. Vite, Sites preparation and Node server bundling passed. Sites worker/package tests: **4 passed**. The existing large-client-chunk warning remains (about 1.28 MB before gzip).
- Focused real Chrome suite: **9 passed**, exit 0. It covers course completion/resume, mobile layout, UI-language preservation, baseline/retest, saved rule preservation, account isolation, fresh-session administrator login/deep links/history guard, QR publication/removal/disable, unauthorized write denial, dialog Escape/focus restoration, and actual mobile-rendered QR decoding.
- The first broad Chrome run executed all 130 tests: 119 passed, 11 failed on obsolete exact expectations introduced by the approved navigation/locale changes. The affected expectations were updated, not removed: `/admin` now resolves to `/admin?tab=overview`; background editing has explicit day/night buttons; practice-language buttons are scoped separately from the new interface-language switch. Original input, history, permission, publishing, layout and persistence assertions remain.
- The second broad run passed 129/130. The remaining assessment setup used Playwright `check()` against a controlled checkbox whose value is updated after IndexedDB commits. Its immediate post-click check failed, while the captured failure snapshot already showed the checkbox checked. Source inspection confirmed durable async settings updates. The test now asserts the initial unchecked state, clicks once, awaits the actual checked state, and still verifies persistence after reload and fixed assessment conditions. This scenario then passed **10 consecutive runs**, with no increased timeout, skipped assertion or repeated click.
- Final broad Chrome rerun: **130/130 passed in 4.9 minutes, command exit 0**, including clean disposable-server shutdown. No test was skipped or weakened to hide a behavioral failure.
- Independent read-only integration reviews found no blocking issue in administration routing/guard wiring, ownership separation, assessment condition matching or score recomputation.

### Reproduction

The normal Playwright configuration remains unchanged. On Windows, use `scripts/verify-browser-local.mjs` with `PLAYWRIGHT_USE_SYSTEM_CHROME=1`; optional `E2E_PORT` selects a free loopback port. The runner starts the actual app with a temporary SQLite database, runs all normal Playwright tests, then requests IPC cleanup. It fails if the disposable server cannot shut down cleanly. CLI file/test filters can be passed for focused checks.

The test-only server also supports the existing explicitly loopback-guarded PostgreSQL E2E option. The normal PostgreSQL Vitest environment is `DAZI_TEST_DATABASE_URL`; keep its disposable credentials private. The temporary PG instance used here was stopped with `pg_ctl` after validation.

## Screenshots

Actual Chrome captures are under `docs/qa/screenshots/2026-11-16-lessons/` in the isolated workspace, not committed as release assets. Desktop is 1440 px wide; mobile is 390 px wide. Ten selected captures were saved to the owner's Library: course, key hints, result, mobile English/night views, weak-key practice, support modal desktop/mobile, support administration and mail-column administration.

QR fixtures visibly say **TEST ONLY - NOT A PAYMENT** and decode to a non-payment test string. They are not the owner's collection codes. No account credentials or production payment material appear. Mobile image pixels were independently decoded with jsQR after actual rendering, in addition to decoding normalized server output. Screenshot data are test data, not the user's typing scores.

Wallhaven background testing remains isolated, as recorded in the i18n QA report. No Wallhaven image was installed as a default, committed, or cleared for publication. Existing day/night backgrounds and all five real background-upload regression tests remain covered.

## Deployment routes and remaining gate

- **Vercel + PostgreSQL remains supported.** Actual PG18.7 HTTP/handler/schema/transfer tests passed; an additional Node 22.23.5 Vercel-specific run passed 14 tests and ESM import verification. No Vercel deployment was made.
- **Docker + PostgreSQL 18 is a separate additive route.** `compose.postgres.yaml`, explicit migration/support/seed operator and disposable container smoke runner are included. The official PG18 image uses a persistent volume, and its database port is not published.
- **Docker container acceptance is NOT complete.** Neither available host had a Docker executable/engine; the actual smoke attempt returned `docker ENOENT`. Node+PG success is not represented as a container pass. Build, compose startup and restart persistence still require a Docker-enabled isolated host.
- **SQLite compatibility is retained.** The original SQLite compose route remains, and support-table transfer/empty-target guards are tested, including legacy sources with no support table.
- PostgreSQL support storage installation is explicit and additive. Before deployment, confirm target, backup/restore and rollback procedure; do not blindly apply schema operations to production.
- The owner must review screenshots and explicitly approve before any production deployment. This branch is not a deployment approval.
