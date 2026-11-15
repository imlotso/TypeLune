# Administration column links (2026-11-16)

Independent branch: dot/admin-deep-links, based on integrated candidate bd0cc6b. No production changes.

- Columns use `/admin?tab=overview|users|articles|scores|feedback|settings|support|mail|audit`. Unknown values fall back to overview. Existing admin authentication/role checks remain unchanged.
- Reload/remount restores the selected column. Shared login preserves a requested admin column; successful login no longer runs the cancel path that replaced the URL with `/`.
- Column clicks create history entries. Back/forward use the same unsaved/busy guard. Canceling a known history move restores the original entry and input; an unmarked legacy entry is not overwritten, and the retained editor is appended because its direction is unknown.
- Feedback-to-article navigation uses the parent guard once rather than asking twice. The local Feedback back button retains its own protection.
- Scope is selected column, not persisted filters, record details or unsaved field contents after a forced process kill.
- Only frontend routing/state changed. No database/schema/SQL, Vercel routing, Node service, or Docker configuration changed; existing PostgreSQL and SQLite backend adapters are untouched. Current requested self-host target is Docker + PostgreSQL.

Verification: new tests failed before implementation (bookmarked SMTP unavailable, invalid column not normalized). Targeted deep-link/guard/admin-entry tests: 18 passed; feedback/admin-UI tests: 8 passed. TypeScript check passed after copying already-installed qrcode/jsqr test dependencies from the integration checkout. Full suite results are recorded separately by integration; these checks do not claim production deployment or all-platform browser acceptance.

Final full command (`node node_modules/vitest/vitest.mjs run --exclude tests/sites-worker.test.mjs`): 133 files passed / 6 skipped; 634 tests passed / 32 skipped. Initial full attempt lacked the copied qrcode dependency dijkstrajs; after copying existing installed dijkstrajs/pngjs from the integration checkout, the suite passed. Git mingw64 OpenSSL was added to this process PATH for local certificate tests. No real email was sent. Vite production build passed with the pre-existing large-chunk warning. The new authentication test starts logged out and clears local storage; real incognito browser acceptance remains with the integrator.
