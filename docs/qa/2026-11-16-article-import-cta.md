# Article library import CTA — 2026-11-16

Base: main b6eec8d752cb9b934871812f47207f39fa41da93. Branch: dot/article-import-cta. No production changes, no push or merge.

## Behavior
- Rounded card at the end of the scrollable article collection; also remains available for empty results.
- Import your article opens the existing private article editor (paste/TXT) for guests and accounts. Existing top New article entry remains unchanged.
- Guest copy explicitly says articles stay in this browser. A separate Sign in to sync opens the existing sign-in/register dialog. It does not imply guest data automatically syncs on login: existing Import guest data workflow still requires selection/confirmation.
- Chinese/English UI, responsive 390 px layout, light/dark themes. Native buttons preserve keyboard access and focus style; no nested interactive controls.
- Only frontend changes; no storage, API, database, or deployment changes.

## Verification
- New tests watched fail before implementation. Final targeted tests: article-import-cta, private-editor, collection-i18n: 3 files / 10 tests passed.
- TypeScript no-emit passed. Vite build passed; existing large-chunk warning remains.
- Real headless Chrome, isolated local SQLite/in-memory mail: guest sign-in opens actual auth dialog; account imports TXT, saves, refreshes and sees persisted article; mobile has no horizontal overflow. No real email sent. Captures include desktop Chinese light, mobile English light and dark (actual theme control).
- Full final unit run: 137 files passed, 2 failed, 7 skipped; 666 tests passed, 3 failed, 39 skipped. Not a green full suite.
  - smtp-transport.test.ts: both TLS cases blocked because Git OpenSSL cannot initialize its MSYS named object in this Windows process (NtCreateDirectoryObject access denied). Initial run also lacked OpenSSL on PATH; adding PATH exposed the Windows restriction. Did not change system security or weaken TLS.
  - admin-navigation-guard.test.tsx: blocks logout while SMTP connection verification is in flight, then releases saved edits: full-run beforeunload assertion failed; separate two-test file rerun passed. No admin files changed. Requires follow-up before treating whole suite green.
- An intermediate serial run was cancelled after requirements changed; it is not final evidence.
- Full PostgreSQL/browser matrix and Docker were not rerun for this small frontend branch. Existing release results are not presented as this branch's validation.

## Deliverables
Screenshots under docs/qa/screenshots/2026-11-16-article-cta. Local reproduction: node scripts/verify-article-cta-preview.mjs after vite build (Node 22, system Chrome, dependencies installed). Script uses disposable local test database and port 4213.

## Release gate
Preview only. User review and explicit merge/deployment authorization are still needed. Resolve/triage the suite failures and rerun final relevant CI before release.
