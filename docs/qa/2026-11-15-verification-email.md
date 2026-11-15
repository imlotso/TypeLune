# TypeLune verification email

- Base: main `686505de85877603b9b0919669a3e3f9cf103f11`.
- Display name is now TypeLune; configured sender mailbox, SMTP credentials, transport, TLS, DNS and delivery policy are unchanged. Existing formatted sender names are replaced without changing the mailbox. Ambiguous/multiple senders are rejected.
- Shared HTML and plain-text template covers registration, login, password reset and email change. Shows purpose, six-digit code, existing ten-minute expiry, non-sharing warning and ignore-if-unrequested notice. No external images, tracking or links. The header is a live-text serif brand, not a replacement logo file.
- Local tests: verification-email, smtp-wire, smtp-transport and admin-smtp: 4 files / 18 tests passed. SMTP tests use local fake servers only; no real emails sent. First TLS test attempt could not find OpenSSL; rerun with the existing Git OpenSSL on the process PATH passed. Typecheck and production build passed (existing bundle-size warning).
- Chromium rendered the actual generated HTML at desktop 640px and mobile 390px; inspected both screenshots, no horizontal overflow. These are template previews, not screenshots from Outlook/Gmail; client-specific rendering remains unverified.
- Reproduce: `npx tsx scripts/preview-verification-email.ts`; optional `CHROMIUM_EXECUTABLE_PATH` selects an installed Chromium. Uses fictional code 123456 and example.test sender only, no SMTP or application database connection.
- Artifacts: [desktop](email-preview/typelune-email-desktop.png), [mobile](email-preview/typelune-email-mobile.png), [HTML](email-preview/typelune-verification.html).
- Not merged or deployed. No production configuration changed.
