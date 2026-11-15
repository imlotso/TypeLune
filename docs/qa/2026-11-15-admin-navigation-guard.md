# Admin navigation safety (2026-11-15)

Baseline: main bfc139a. Independent branch: dot/admin-unsaved-guard. No production changes.

## Reproduced

The new regression test edits the SMTP hostname and switches to Overview while declining the leave prompt. Before the fix, the SMTP form is unmounted and the input disappears. The test fails at the retained-input assertion.

## Change

A management-shell guard collects dirty/busy state from SMTP, site settings, feedback handling and article editing. Switching sections, opening the public-site preview or logging out now asks before discarding unsaved edits, and does not navigate while one of those forms is submitting. Refresh/close uses the browser-native beforeunload warning. Cancel keeps the form and input. Successful save clears the dirty state. Browser or OS forced termination still cannot be guaranteed to show a warning.

## Scope notes

Background upload/editing already exists in Settings > Appearance; the audit did not identify it as a missing feature. UI locale must remain independent of the practice article language. G01-G04 remain deferred under the existing tracker. Current audit is code/test evidence, not a claim of full production admin visual acceptance.

## Verification

- Regression first failed on the lost SMTP field before implementation.
- Targeted administration suite: 5 files / 21 tests passed, followed by the expanded guard suite (2 cases).
- TypeScript check passed. Frontend Vite build, Sites preparation and server esbuild passed; existing >500 kB bundle warning remains.
- Full Vitest command: 119 files passed, 1 failed, 6 skipped; 591 tests passed, 2 failed, 32 skipped. Both failures are tests/smtp-transport.test.ts (local STARTTLS/TLS): Windows OpenSSL certificate generation fails. Initial attempt lacked openssl in PATH; adding Git OpenSSL resolved discovery but certificate command still failed. No real email was sent. This is not an all-green full-suite claim.
- Visible logout text was added to the existing username/logout button to make its action explicit. Locale translation and LanguageToggle integration belong to the combined i18n candidate.
