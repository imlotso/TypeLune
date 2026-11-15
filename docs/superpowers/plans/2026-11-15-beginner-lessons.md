# TypeLune beginner course implementation plan
## Approved scope
An independent beginner entry and stable route; posture, home row, upper/lower row, word combinations, case and punctuation; optional key-position hints; real accuracy, local progress, and next-step/review recommendations. Reuse ArticleSnapshot custom practice, not public long-form catalog or leaderboard. Keep terse bilingual copy and cloud-room visual language. No production deployment.

## Design
Fixed original English QWERTY lesson material uses versioned IDs and bilingual guidance. Progress is derived from matching current-owner records already available on this device, with no new sync schema. Full text and at least 95% final accuracy count as completed. Interrupted practice uses existing drafts. Recommendations use real recorded mistakes. Keys are static placement hints, never finger detection.

## Tasks
- [x] Add tests for stable content, snapshot matching, owner isolation, complete/partial rounds, next lesson and key hints. Observe failure, implement, rerun.
- [x] Add bilingual course catalog, live hint panel and result recommendation components with behavioral tests.
- [x] Follow the subsequently approved QR support scope: quiet footer text, sanitized administrator-uploaded images in a modal, absent configuration hidden, and SiteTalk attribution; preserve informational routes.
- [x] Integrate via /lessons, shared practice engine, existing draft-resume and result flow after i18n branch is ready.
- [x] Run typecheck, full tests and build; inspect actual desktop and phone layouts and course completion/resume.
- [x] Add approved weak-key practice and fixed-condition baseline/retest panels. Offer a phase retest after lessons 4 and 8 are completed.
## Review focus
Stale content must not award progress; another user's record must not leak; early finish is not completion; entering lessons must preserve in-flight draft; unsupported or missing QR configuration renders no active support entry. No payment URL is fabricated. Final evidence and outstanding deployment gates are in `docs/qa/2026-11-16-nightly-integration.md`.
