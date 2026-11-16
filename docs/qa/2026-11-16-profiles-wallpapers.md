# Adaptive practice, wallpapers, rankings and public profiles

Branch: `codex/typelune-profiles-wallpapers`, based on `b3b6609`. Target repository: `imlotso/TypeLune` (renamed from `typing`). No production changes, database maintenance, merge or deployment.

## Resulting behavior

- Desktop courses place guidance on the left and typing on the right. At 1440×800 the active input and keyboard stay in view; only practice lines scroll. The subtle divider supports mouse/touch capture, arrow keys, Home/End, double-click reset and local width persistence. Narrow screens stack the panels and retain a compact next-key hint. Original lesson IDs, saved drafts and IME handling remain intact. Exercise numbers are centered independently of completion marks.
- The new bundled lake wallpaper is generated artwork, about 32 KB WebP, with day/night presentation. It remains available without a third-party service.
- Background settings integrate anonymous Wallhaven daily images, separate theme preferences, landscape/portrait choices, existing fit/position/blur/shade controls, and source links. Custom upload disables automatic replacement for that theme. Disabling automatic updates retains the image; restoring defaults disables them. The image and preference save together in one local workspace transaction. Delayed refreshes check current preferences and image identity before writing. Errors preserve the previous image and retry on the next hourly check; background preferences/images use the existing account sync protocol.
- The Wallhaven provider pins HTTPS destinations, rejects redirects and unbounded responses, verifies raster decoding and pixel limits, and re-encodes to bounded WebP. Only SFW candidates with acceptable actual tags are selected. Short-term cache, in-flight request sharing, failed-request cooldown and a bounded request deadline protect anonymous API use. Third-party labels do not constitute guaranteed human content review. No API key is required. Standard HTTP(S) proxy configuration is supported without disabling certificate verification.
- Ranking UI uses the approved simplified table. Queries omit duration, article, practice mode and strictness; the server aggregates the best eligible published score per owner across those conditions. Member/guest isolation, period/difficulty/language filtering, moderation and deterministic tie order remain. Pagination and personal rank work independently. Explicit legacy API conditions remain backward compatible, while obsolete UI URL conditions are removed. English displays WPM plus CPM; Chinese ranks by CPM.
- Custom avatars have a local crop/preview and a second server-side decode, metadata removal and 192×192 WebP encode. Built-in icons remain available. Rankings, account menus and stable-ID public profiles use current avatar/name values.
- Public viewing defaults on. Disabling it blocks direct profile API access by other visitors, while the owner can preview. Profiles expose only an explicit allowlist: display name/avatar, join date, completed online practice aggregates and validated day/night backgrounds. Original filenames, emails, texts, drafts, recovery keys and authentication material are excluded. Statistics are labeled as online practice; local-only lessons are not misrepresented as server-verified history. Avatar/privacy metadata is stored in a versioned envelope in the existing avatar TEXT field; immutable PostgreSQL migrations remain unchanged, and existing backup/transfer paths preserve this field.

## Verification evidence

- TypeScript, production build, Sites packaging (4 tests) and Node 22 Vercel Function ESM import passed. The existing approximately 1.3 MB client bundle warning remains.
- A PostgreSQL-enabled complete unit/integration run passed 756 tests, with 4 dedicated punctuation-database tests skipped. After adding atomic wallpaper-save coverage, the clean serial run passed 757 tests in 161 files, with the same 4 dedicated tests skipped (145.55 seconds, maxWorkers=2).
- Actual loopback PostgreSQL in a disposable `postgres:18` container exercised Node HTTP and the Vercel handler's public-profile visibility plus persisted avatar/privacy. No production credentials or user data were used.
- Actual anonymous Wallhaven requests succeeded for landscapes (`8g82jo`) and portraits (`ogwgwp`); original image transfer, decode/re-encode and returned background metadata were checked. Initial Node requests needed the cloud's standard HTTPS proxy. Portrait selection initially returned no results because of a narrow monthly window and classification metadata being treated as image tags; it now uses the yearly portrait candidate list and checks actual tag names.
- First aggregate browser run: 142 passed / 3 failed. Two failures were obsolete avatar/table locators; one selected guest statistics filters before the authenticated workspace mounted. Locators and explicit account readiness were corrected while preserving the underlying assertions. The affected 19-case browser run passed, including new daily-wallpaper save/reload/disable behavior.
- A later unit run overlapping the browser suite exceeded existing timeouts in two PostgreSQL cases and one initial draft-restoration wait. The subsequent clean complete run passed 757 tests at maxWorkers=2 without a simultaneous browser workload; no assertion or timeout was relaxed.

## Screenshots

All images below are actual local browser captures using disposable accounts. The ranking UI screenshot uses an explicit test score fixture linked to a real disposable account; it does not claim production scores. The background settings screenshot uses a local image fixture to avoid making CI depend on Wallhaven uptime. Real provider checks are listed separately above.

- [Course desktop, night](screenshots/2026-11-16-profiles-wallpapers/course-desktop-dark.png)
- [Course mobile](screenshots/2026-11-16-profiles-wallpapers/course-mobile.png)
- [Account avatar and privacy](screenshots/2026-11-16-profiles-wallpapers/account-desktop.png)
- [Public profile](screenshots/2026-11-16-profiles-wallpapers/public-profile.png)
- [Ranking desktop](screenshots/2026-11-16-profiles-wallpapers/rankings-desktop.png)
- [Ranking mobile](screenshots/2026-11-16-profiles-wallpapers/rankings-mobile.png)
- [Wallpaper settings](screenshots/2026-11-16-profiles-wallpapers/wallpaper-settings.png)

## Final checks

- Complete PostgreSQL-enabled unit/integration run: **758 passed, 4 skipped**, 161 passing files / 1 skipped file, 205.13 seconds with maxWorkers=2. The 4 skipped cases require a separate explicit punctuation-repair test database and are unrelated to this change.
- Latest type check, production build, Sites tests (4/4) and Node 22 Vercel ESM import passed.
- Final full Chromium regression: **145 passed / 1 failed**. The remaining failure exposed a real delayed visual state on the daily checkbox: it changed only after the provider request resolved. Pending selection now updates immediately, while failure/cancel restores the prior choice. Added unit coverage for immediate feedback and cancellation; 12 focused wallpaper tests passed.
- After that fix, the complete new-feature browser file passed **3/3 against actual PostgreSQL** (14.5 seconds). It covers low-height resizing/mobile active-input visibility, avatar/privacy across identities, retaining ranking filters when returning from a profile, and daily wallpaper preview/save/reload/disable plus persisted restoration in a separate signed-in browser. The provider is mocked only in the deterministic browser test, not in the real external API checks above.
- Final account/API regression: **14/14 passed**, including actual PostgreSQL Node/Vercel HTTP privacy tests. An unrelated nickname/avatar edit omits untouched privacy preferences, so it cannot reopen a profile another device made private. Existing canonical avatar bytes are retained on unrelated edits rather than repeatedly applying lossy encoding.
- No production deployment, merge, real email delivery, physical mobile-device test or production database operation is claimed.
