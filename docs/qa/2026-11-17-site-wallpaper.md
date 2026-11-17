# Site wallpaper, upload lifecycle and settings layout

Implemented on 2026-11-17. User authorized production deployment after verification.

- Practice settings uses a 960 px, responsive two-column dialog with a fixed header and independently scrolling body. Mobile retains one column.
- Administrators can enable a shared wallpaper in 12-hour UTC slots and select eight styles. Active clients refresh at the slot boundary; the first request after an idle period resolves the current slot. A PostgreSQL lease coordinates independent server instances. Provider failures retain the last working image and retry, without marking an old image fresh.
- Wallhaven retrieval fetches JSON metadata only. Workspace and rotation state hold approved HTTPS image URLs, dimensions and presentation settings. The browser loads the provider image directly, with normal HTTP caching. Existing Wallhaven data URLs migrate by their original image ID.
- Signed-in uploads use bounded requests, original-file validation and lossless WebP encoding. No resizing or lossy quality setting is used. Decoded RGBA pixels, including transparent RGB values, are preserved. Files over 10 MiB input, 40 megapixels, or 20 MiB after lossless processing are rejected explicitly. PostgreSQL stores the encoded bytes; workspace storage holds only file references. Visitor uploads retain their existing local workflow.
- Replacement and reset remove unreferenced old file rows in the same transaction that commits the new background. Current day/night references protect shared files. A deleted URL returns 404 and stale clients cannot resurrect it. Privacy and ownership checks apply to direct image access. PostgreSQL backup retention remains the operator's existing policy.
- Account saves commit on the server before publishing the replacement locally. Failed requests preserve the old background. Cancelling uncommitted uploads removes their staging data.
- Separate panel/workspace transparency, panel blur and border strength preserve text opacity. Presentation-only changes to the global wallpaper store no personal image override, so rotation continues.

Verification:

- Full existing suite: 830 assertions passed; three initial failures were repaired (updated save-confirmation mocks and optional SQLite/PostgreSQL transfer support). The affected eight-file rerun passed all 92 assertions, including the repaired cases. Additional final authentication, lossless file lifecycle and multi-instance PostgreSQL rotation tests passed all 27 assertions.
- Actual PostgreSQL browser flows: 24 earlier cases completed their functional assertions; two context-close artifact errors came from concurrent Playwright output directories. A final run with a separate directory passed all ten background, cross-device, preset and new global-wallpaper cases. It also covers a forced 503 during replacement, cancellation/reload, old-file 404 after success, and reset deletion.
- TypeScript, production build, emitted Vercel ESM import, and four Sites compatibility checks passed.
- A real Wallhaven API request returned a direct 4819 × 2711 source URL. Chromium loaded that exact external image at its native dimensions without a mock.
- Both SQLite and PostgreSQL tests cover exact decoded pixels, multichunk originals above 4.5 MiB, Node/Vercel-adapter streamed reads, stale/foreign references, privacy, cancellation, transactional deletion and SQL import/export compatibility.

Screenshots: [settings](screenshots/2026-11-17-site-wallpaper/settings-desktop.png), [background controls](screenshots/2026-11-17-site-wallpaper/background-controls.png), [mobile](screenshots/2026-11-17-site-wallpaper/background-mobile.png), [admin styles](screenshots/2026-11-17-site-wallpaper/admin-styles.png).

Deployment installs the additive wallpaper extension once through the explicitly scoped `TYPELUNE_INSTALL_WALLPAPER` build flag. Normal PostgreSQL startup performs no DDL; the feature falls back to disabled if the extension is absent. The optional `TYPELUNE_ENABLE_SITE_WALLPAPER=true` flag seeds enabled landscape rotation only if no administrator configuration exists. Clear both one-time flags after installation. No SMTP test delivery or production-account test data is required.
