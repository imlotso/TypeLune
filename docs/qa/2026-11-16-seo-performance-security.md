# SEO, performance and security verification

This change is developed in the cloud workspace and tested locally. It does not require GitHub Actions minutes. The baseline is `cee51fd`.

## Scope

- Bilingual public HTML and metadata using `?tl=zh-CN` / `?tl=en`, canonical and reciprocal hreflang links, and persisted administration of website SEO and sitemap settings.
- Public-article discovery follows the published catalog; account content, private articles, drafts, records, authentication details and private profiles must never enter SEO HTML or sitemaps.
- Browser response protections, API cache isolation, cross-site write protection and reduced password-login timing disclosure.
- Precompressed static assets, safe route splitting, lossless background conversion and elimination of ranking-avatar N+1 queries.

## Measured asset changes

The background conversions decode to byte-identical RGBA pixels. Original PNG URLs remain available for existing references.

| Asset | Original PNG | Lossless WebP |
| --- | ---: | ---: |
| Day cloud room | 1,494,030 bytes | 885,616 bytes |
| Night cloud room | 1,619,592 bytes | 1,094,424 bytes |

The original initial JavaScript totals 1,315,892 bytes. The final entry plus its eager shared preload total 1,246,822 bytes (about 5.2% smaller), including the new SEO features. Standalone Node serves those files as 390,746 bytes of prebuilt Brotli data when accepted; the original standalone build had no precompressed variants. Vercel/Caddy already provide compression, so this standalone transfer comparison is not a production-CDN speed claim. Route splitting deliberately keeps offline-capable article/library/history/draft/mistake/statistics pages in the initial application. Only online-dependent administration, rankings and profiles load separately; chunk errors keep the practice navigation available.

## Verification record

The initial original-scope PostgreSQL browser suite passed all 146 tests. The SQLite suite passed 143 initially; the three affected scenarios passed in a fresh 14-test run after isolating artifact output and correcting an existing sync-control race in the test. One initial failure was caused by two Playwright processes sharing their artifact directory; subsequent suites use separate output paths.

Two component recovery checks missed their short waits under concurrent test load. Both complete affected test files subsequently passed serially (24 tests). No product recovery behavior was changed to satisfy those tests.

The original-scope PostgreSQL integration suite passed 41 tests, covering Node and Vercel HTTP paths. Production dependencies reported zero known advisories in `npm audit --omit=dev`. This dependency result is not a claim that the application has no security weaknesses.

Expanded SEO checks pass for managed bilingual server HTML, public-article visibility, admin authentication, uploads, revisions, sitemap controls and preview noindex. Actual PostgreSQL Node/Vercel integration and SQLite↔PostgreSQL SEO transfer checks pass. Three new browser flows and two offline/chunk-failure flows pass. Final all-suite unit/integration rerun: **169 test files passed, 792 tests passed, 4 optional tests skipped** with the disposable PostgreSQL database enabled. Type checking, production build, Sites packaging (4 tests), and emitted Vercel NodeNext module loading pass. Full final browser reruns are recorded below when complete.

Five English UI checks initially failed because earlier cases left `?tl=zh-CN` in browser history after switching languages. Fresh-visit URL isolation fixes preserve every English assertion. All 48 related locale checks pass, including actual PostgreSQL locale API checks.

Actual rollback was verified by starting the original `cee51fd` compiled Node application against both SQLite and PostgreSQL after saving new SEO settings and changing an operational control. The old binary starts, logs in and reads operational settings correctly.

## Screenshots

Real browser screenshots from the cloud production-mode preview:

- [Practice](screenshots/2026-11-16-seo-performance-security/practice.png)
- [Rankings](screenshots/2026-11-16-seo-performance-security/rankings.png)
- [Lessons](screenshots/2026-11-16-seo-performance-security/lessons.png)
- [SEO administration](screenshots/2026-11-16-seo-performance-security/admin-seo-desktop.png)
- [English public page](screenshots/2026-11-16-seo-performance-security/english-public.png)

The admin screenshot uses a synthetic uploaded logo to verify replacement; the selected TypeLune wordmark remains the default.

## Deployment notes

The verified existing Vercel project is `dazi`, connected to `imlotso/TypeLune`, with production domain `typing.imlotso.com`. The public `VITE_SITE_URL=https://typing.imlotso.com` value is configured for production and preview. Runtime administration may override the canonical origin; it must remain the intended production origin. Preview pages must remain noindex.

SEO settings use an independent optional `seo_settings` table with revision checks, audit records and PostgreSQL transaction locking. PostgreSQL requires the explicit `seo` operator action documented in the deployment guides; normal application startup performs no PostgreSQL DDL. Without the extension, public pages use defaults and admin writes explicitly return 503. Immutable schema migrations and operational settings are unchanged, allowing an old binary to roll back safely. No production database or production deployment has been changed during local verification.

Lighthouse must be rerun without concurrent browser/unit workloads before quoting a performance comparison. Earlier concurrent local runs are retained only in the workspace and are not valid evidence of speed improvement. Production field Core Web Vitals cannot be inferred from a local lab run.

### Final browser and image verification

The final complete SQLite browser suite passed 150/151 initially and found a genuine identity-boundary issue: a guest-generated language URL could affect a later account. Generated language URLs now carry an owner marker in existing history state, while real incoming language links remain explicit overrides. The original failure plus all account-language/navigation/SEO/offline cases passed in a fresh 24-case browser run; 54 related unit/API cases also passed. No original browser assertion was weakened.

Docker production image checks passed for both SQLite and PostgreSQL 18.7, including explicit extension installation, authentication, image sanitization, persistence, volume replacement and backup restoration. The build used the workspace's trusted CA as a temporary BuildKit secret for dependency downloads; TLS verification was not disabled and the CA is not added to the product image. The PostgreSQL smoke runner now refreshes Docker's dynamically assigned host port after restart (verified that Docker reassigns it), and waits for TCP readiness.

An isolated, sequential Lighthouse run measured performance 68→75, SEO 92→100, LCP 11.3s→6.1s, TBT 250ms→180ms, and CLS 0 for both versions. These are direct Node lab measurements, not CDN or field Core Web Vitals results.

Remote verification caught Vercel's static-file priority serving Chinese `index.html` for `?tl=en`. Explicit public SSR routes now run before the filesystem handler; static assets and the private SPA fallback remain available. A build-time runtime/schema check prevents publishing a function whose selected database schema cannot start the application. Preview configuration and final remote results are recorded after verification.

### Final remote preview

The isolated Vercel preview is `https://dazi-k49ory2vl-bobos-projects-2c04df89.vercel.app`. Direct server responses return `lang=en` / `lang=zh-CN`, matching titles and Content-Language, reciprocal hreflang and canonical URLs, and full currently published article text. API health returns 200. Preview HTML is noindex; robots disallows crawling and sitemap returns 404. The dedicated preview schema contains only the 42 reusable public articles; production accounts and private data were not copied. The one-time preview initialization switch was disabled after successful verification.

Final actual PostgreSQL browser retest passed all 24 language/navigation/SEO/offline cases. Final complete unit/API run passed 169 files / 792 tests, with 4 optional tests skipped.
