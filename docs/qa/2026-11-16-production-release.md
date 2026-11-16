# Production release preflight — 2026-11-16

The user authorized production deployment of PR #12. This records the checks and correction prepared before publication, rather than claiming publication from a successful local build.

Target: the existing Vercel `bobos-projects-2c04df89/dazi` project serving `https://typing.imlotso.com`, through the existing GitHub production integration. Keep the current database binding, stable CODE_SECRET, SMTP settings and domains. This change needs no schema migration or data repair.

Before release, the public health endpoint returned 200 with `{ "ok": true }`. The page served `index-s9Pjs5cb.js` / `index-DCGPyDsI.css`; main's Vercel status linked to deployment `HJickc2EHfqFpSfFHj1AoNjA7Wd8` and reported success.

PR CI run `43873876455` passed the Docker smoke check, but the SQLite browser run had 145 passes and one failure when disabling daily wallpaper. Retained trace evidence shows Save was clicked around monotonic time 254962 ms; the snapshot at 254996 ms still contained the saving indicator, and reload began at 254997 ms. The test refreshed before the local IndexedDB transaction completed. It now waits for the background dialog to close after Save, retaining the reload and disabled-state assertions. The application also protects navigation during an in-flight save with a beforeunload handler, which is removed after persistence/unmount.

Local validation of the correction: background/save unit checks passed (11 tests), TypeScript and production build passed, and the complete wallpaper save/reload/disable/cross-browser scenario passed five consecutive Chromium runs (28.5 seconds). No production accounts or scores were created.

The earlier local Git author's account could not be verified by Vercel. The release correction is submitted through the already connected GitHub account, letting GitHub assign its authenticated actor and signature; no author name/email or project access policy is overridden. Recheck CI and preview status on that exact commit before merging. After publication, verify the production alias, health, new assets, aggregated ranking API and public UI using read-only requests.
