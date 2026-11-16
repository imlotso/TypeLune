# Beginner course expansion and hand guidance

2026-11-16. Feature branch only; not deployed.

- Eight chapters each offer five short exercises (40 total). Original version-one article IDs and texts remain intact, preserving saved drafts and prior completion records. Basics badges and exercise-level counts are shown separately.
- English keyboard material is intentionally unchanged when switching UI language. Titles, instructions, controls and status are localized in Chinese and English.
- The keyboard is rendered from explicit US QWERTY keys, not an AI-generated keyboard image. Target letters/symbols identify the appropriate finger and opposite Shift key; Space and Enter are covered.
- The generated, transparent hand illustration is a visual reference. Small local fingertip motion and target-to-finger cues demonstrate suggested input; this does not track the user's real hands or simulate full 3D joint mechanics. The asset contains no keyboard lettering.
- Hand visibility, motion reduction, and system prefers-reduced-motion are supported. Existing textual key hints remain available.
- Screenshots under screenshots/2026-11-16-expanded-hands are real local Chrome captures, not concept renders. Local browser tests use disposable data and the in-memory mailer; no real email or production writes.

Verification before final integration: 674 unit/integration tests passed, 39 skipped; TypeScript and production build passed. Browser checks cover Chinese desktop, English desktop, English mobile dark mode, exercise progression, draft resume, and overflow. Final integrated verification is recorded in the handoff.

Asset: typing-hands.webp, generated for this feature, optimized to about 52 KB.

Final integrated validation (course + article CTA): 143 test files passed, 7 skipped; 684 tests passed, 39 skipped. TypeScript, production build, and four Sites packaging tests passed. OpenSSL initially failed inside the restricted Windows process (MSYS named-object permission), then passed in the approved local test process; no SMTP product change was needed. No real messages were sent.

Additional manual automation: uppercase A highlights left little finger + right Shift; system reduced-motion returns animation-name none on fingertip elements. Chinese mobile and English dark mobile screenshots were inspected for clipping and overflow.
