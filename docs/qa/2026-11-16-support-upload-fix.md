# Payment QR upload fix, 2026-11-16

Isolated branch: `dot/support-upload-fix`; no production writes and no real payment codes.

## Cause and change
- The reported Alipay JPEG is 1517 x 2274, above the old 2048 per-edge ceiling. The entire two-channel save is atomic, so one invalid image rejected both. This does not establish that the 595 x 808 WeChat JPEG was invalid.
- Synthetic portrait JPEG fixtures at both reported dimensions reproduce the old rejection and now pass, preserving dimensions and exact QR payload after decode/normalization. Private EXIF metadata is removed.
- The edge ceiling is now 4096, while the 4,000,000 total-pixel decode bound, 1 MiB input/output limits, single-frame restriction and strict PNG/JPEG/WebP validation remain. No automatic resize, crop or lossy encoding is introduced.
- Lossless WebP conversion can be larger than the source JPEG. This is now a distinct error, not silently fixed with lossy compression. A deterministic noise JPEG regression verifies the rejection.
- Structured errors identify Alipay vs WeChat, reason, and that neither image was saved. Chinese and English guidance explains the limit and recommends verifying scanability of a re-exported original.

## Verification
- 5 focused test files / 14 tests passed; typecheck and client/server build passed.
- New coverage includes both portrait dimensions, payload decoding, EXIF removal, per-channel atomic rejection, total-pixel ceiling, lossless expansion rejection and bilingual errors.
- No evidence that every real-world QR will scan is claimed. Image scaling is not lossless; preserving the original is safer than automatic downsampling. Actual payment applications should be used by the owner to verify their code after upload, without sending a payment.
- WebKit 27.2, iPhone 13 emulation (390px viewport, DPR 3): actual isolated admin upload/save then public mobile dialog passed. Both portrait fixtures use a roughly 200-character synthetic payload; jsQR decoded each actual rendered element screenshot and no horizontal overflow was observed. This is desktop WebKit emulation, not real iOS Safari or real payment-app verification.
- The loopback server emits Secure cookies. The WebKit test re-adds only its disposable login cookie without Secure for HTTP testing, without changing any application security setting. Early runs failed on a wrong localized selector and on entering the admin account's public route without Preview; those test navigation issues were corrected. Only the final successful run is counted.
- The same portrait mobile browser test also passed on system Chrome (1/1). The focused 14 tests and typecheck passed; integrated full-suite results belong to the integrating branch.
