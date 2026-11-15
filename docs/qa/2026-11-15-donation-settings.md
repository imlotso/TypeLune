# Donation QR configuration (isolated development)

Branch: dot/typelune-donation. No production changes, no real payment codes, no real mail.

## Integration
- Dependencies: i18n core 3a631b0 and admin navigation guard 026a4df (already cherry-picked locally).
- Import `SupportSettingsPanel` into the integration branch's AdminConsole and render with `ownerId`; it registers its dirty/busy state with `useAdminEdits`.
- GET `/api/site/support`: `{ enabled:false }` when disabled/unconfigured, otherwise `{enabled:true,alipay?:{dataUrl},wechat?:{dataUrl}}`.
- Admin GET/POST `/api/admin/support`: `{settings:{enabled:boolean,alipay:null|{dataUrl:string},wechat:null|{dataUrl:string}},revision:number}`.
- Admin route inherits session, role, owner and CSRF checks; audit rechecks authorization inside the write transaction. Conflicts return 409. Public endpoint has no write operation and returns no revision/admin metadata.
- Stored in an independent `support_settings` singleton table and revision. Legacy site settings code/data is untouched. SQLite creates the table locally. PostgreSQL needs the explicit additive `server/postgres/support-settings.sql` extension in the selected schema; until installed, public support stays disabled and admin returns 503. Existing schema 1/2 checksums and migration records remain unchanged.

## Images
- PNG/JPEG/WebP only, canonical base64, 1 MiB per input and normalized image, max 2048 per side / 4 million pixels, single frame.
- Sharp decodes the actual pixels, checks MIME versus decoded format, rotates EXIF orientation and produces lossless WebP without resizing/cropping or metadata.
- No remote image URLs, SVG, filename persistence, arbitrary HTML or external payment link.
- Enabling requires a configured image; no fallback/fake QR is served.
- Admin UI warns images are public, allows preview/replace/remove, blocks repeated requests, preserves dirty drafts on errors, requires confirmation before reload on revision conflict.

## Verification
- Synthetic non-payment QR generated using qrcode, submitted through admin API, persisted, fetched from public endpoint, decoded using jsQR: exact text and 384x384 dimensions preserved.
- Targeted tests include unauthenticated/normal-user denial, revoked-admin rollback, revision conflict, malformed/oversized/mislabeled image rejection, public metadata exclusion, hidden disabled QR, settings preservation, UI upload/save/remove/type rejection.
- Full-suite initial parallel run had three 5-second account tests time out under shared-machine contention. Bounded-concurrency rerun: 600 passed, 32 skipped. After independent-table refactor, targeted 16 tests and typecheck passed. Final full suite: 123 files passed, 6 skipped; 600 tests passed, 32 skipped (78.53 seconds, maxWorkers=2). Final npm run build passed.
- Local type check and client/server build passed; existing >500 kB bundle warning remains.
- PostgreSQL-specific runtime and integrated browser screenshots still need the integration owner; no claim of production verification.

## Rollback compatibility
Legacy site-settings implementation is unchanged. Test verifies support writes leave legacy settings bytes/revision untouched, and legacy settings writes leave support revision unchanged. The additive table does not change schema 1/2 version checks, so older builds ignore it. No PostgreSQL extension has been installed on production or cloud databases. PostgreSQL extension runtime validation and exporting this optional table in database transfer tooling remain integration checks before deployment.
