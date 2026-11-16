# Integrated PR verification, 2026-11-16

Branch: dot/lesson-hands-expanded. No merge or production deployment.

Includes expanded beginner lessons and natural hand guidance, article-library import/guest reminder, correct Chinese punctuation plus explicit catalog repair, resume-on-first-input timing, and portrait payment-code upload/enlargement.

## Verification
- Final TypeScript check and frontend/backend builds passed. Existing bundle-size warning remains (approximately 1.30 MB main JS before gzip).
- 149 test files passed, 7 skipped; 709 tests passed, 39 skipped. This run includes four real PostgreSQL 18.7 catalog repair tests against a disposable loopback database. The test cluster was stopped afterward.
- Four Sites packaging tests passed using Node's test runner.
- Browser regression status is recorded below after completion.

## Corrections found during integration
- Updated six browser scenarios that still expected clicking Resume to immediately start timing. Recovery, concurrency, shortcuts and site switches now make a real text edit before awaiting the resume request.
- Stabilized the punctuation test: wait for the exact article detail before clicking its scoped Practice action. Previously it could click the global navigation before data loaded and practice a different article. The corrected test passed five consecutive system-Chrome runs on the integrated branch.
- High-density portrait QR thumbnails were not reliably decodable at desktop DPR 1. Added keyboard-accessible enlargement preserving the full image/aspect ratio, bilingual instructions and focus restoration. Desktop DPR 1, mobile DPR 1, and WebKit iPhone emulation DPR 3 were verified by decoding screenshots of the rendered enlarged image. This is browser emulation, not a physical iPhone payment test.
- Persisted the browser's reduced-motion choice; clarified that the original 8/8 counter represents basic exercises, not all 40; added missing backtick/tilde text hints.

## Release boundary
Existing PostgreSQL article rows do not change merely by deploying source. The explicit repair-punctuation command must be target-verified and separately run if rollout is authorized; it uses exact source hashes and compare-and-swap, skips edits/deletions, preserves historical snapshots, is idempotent, and rolls back partial failure. See 2026-11-16-chinese-dash.md. No production repair was run.

Screenshots in screenshots/2026-11-16-expanded-hands are actual local browser renders. The natural hand asset plus local fingertip cues represent suggested fingering, not real hand tracking or full skeletal animation. No real payment codes, SMTP messages or user accounts were used in verification.

Final clean sequential system-Chrome run: **143 / 143 passed (5.4 minutes)** using a fixed rebuilt client and a unique output directory. Earlier runs exposed (and retained in logs) obsolete resume assertions, a premature article-navigation click, QR-test settings leakage, and two conflicting parallel trace artifacts. These were corrected; the final run was not parallelized with another Playwright invocation. The QR test now restores its complete original settings using its own write revision for CAS.
