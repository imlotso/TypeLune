# TypeLune

[简体中文](README.md) · **English**

TypeLune is a Chinese and English typing practice app with support for Chinese input methods. Practice public-domain long-form texts line by line, learn fingering, resume drafts, or work with your own articles.

[Practice online](https://typelune.imlotso.com/) · [Beginner courses](https://typelune.imlotso.com/lessons) · [Article library](https://typelune.imlotso.com/library) · [Leaderboards](https://typelune.imlotso.com/rankings)

[![GitHub CI](https://github.com/imlotso/TypeLune/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/imlotso/TypeLune/actions/workflows/ci.yml)

## Website features

| Feature | How it works |
| --- | --- |
| Line-by-line practice | The first committed character starts the timer. The active line is highlighted and advances automatically when complete. The input stays stable while composing Chinese text. Choose timed or full-article practice, strict correction, auto-pause, and a target pace. Timed rounds default to five minutes and can run for 1–60 minutes. |
| Article library | The bundled library has 21 Chinese and 21 English public-domain texts across beginner, intermediate, and advanced levels. Find articles by title or author, filter by mood, difficulty, and length, and save favorites. Article pages credit the author and link to the source. |
| Fingering and focused drills | Beginner Courses offers chapters with keyboard and finger guides and assessments. Focused Drills on the practice page includes numbers, punctuation, and phrases. The mistake notebook lets you select characters to practice and track mastery. |
| Custom and private articles | Paste text directly into a practice round, or create, edit, delete, and import TXT files in My Articles. Editing an article preserves the version saved in existing drafts and records. |
| Drafts and continuation | More → Drafts supports resuming, selecting, and deleting drafts in batches. The input restores both completed and partial lines, and the caret resumes where you left off. Completed rounds stay in history, and a new round scores only new input. |
| Results and progress | Results include an overview, a timeline, mistakes, and personal bests. Continue the article, try again, or export a share image. My Records offers filters and details, and More → Statistics includes trends, an activity calendar, and a daily goal. Timelines use samples recorded during practice. |
| Online leaderboards | Separate visitor and account boards filter by practice language, difficulty, and date range. Chinese ranks by correct characters per minute and English by WPM. The server recalculates eligible public-article scores. Anomalous or recovered scores and submissions covered by the review policy can be queued for moderation. |
| Appearance and reading | Appearance offers light and dark themes with separate wallpapers, previews, and transparency controls. Follow the site wallpaper or opt out to upload JPG, PNG, or WebP images or use Wallhaven. When enabled, the shared wallpaper rotates every 12 hours. Display effects can be adjusted separately. Settings also covers font size, line height, focus mode, named presets, and shortcuts. |
| Accounts and sync | Guests can practice and keep records on the device. Signed-in users can sync drafts, records, private articles, favorites, and settings. Data stays on the device while offline and sync can be retried. Users can explicitly import guest data, export JSON or CSV, manage cached data, and delete their account. |
| Public profiles and help | Change your avatar, control whether your profile is public, and view public profiles from the leaderboards. The interface supports Simplified Chinese, English, and browser-language detection. Footer links include help, feedback, privacy, terms, and contact details. Feedback accepts screenshots and shows its status. |

English practice shows both CPM and WPM. CPM counts correct characters per minute of active practice, and WPM treats five correct characters as one standard word. Spaces and punctuation are scored. Uncommitted IME candidates are excluded. Custom articles, drills, and new personal continuation rounds are kept in personal records. Eligible online drafts can resume their original round.

Sync keeps a local copy in IndexedDB, separates workspaces by account, and uses revisions and deletion markers to handle conflicts. Importing guest data requires an explicit action. Making a profile private blocks access to its profile page while previously published scores remain subject to leaderboard rules.

[Chinese article sources](docs/chinese-article-sources.md) · [English article sources](docs/english-article-sources.md) · [Sync protocol and storage limits](docs/qa/2026-11-15-workspace-protocol.md)

## Administration

Administrators sign in through the shared website login or `/admin`. Set `ADMIN_EMAIL` or follow the bootstrap instructions for the selected database to initialize the first administrator. Registered users can sign in with a username or email and password, or with an email code.

| Area | Management tools |
| --- | --- |
| Overview | Accounts, practice, article and score counts, traffic trends, and geographic summaries. Traffic is aggregated daily. Country and region breakdowns depend on the location information supplied by the hosting platform. |
| Users | Search, filter, suspend or delete ordinary accounts, revoke sessions, and manage roles. Configure a registration domain allowlist, a domain blocklist, and a blocklist for individual email addresses. |
| Content and moderation | Draft, publish, archive, and delete public articles. Review or unpublish individual or batch scores. Handle feedback screenshots, public replies, private notes, and audit logs. |
| Site settings and appearance | Registration, guest practice, leaderboards and review policy, site-wide default light/dark palette and transparency settings (with one-click reset), editable five footer buttons, Markdown page editor and extra footer links, nickname wordlists, SMTP setup and connection testing, the shared wallpaper, and the optional support entry. |
| SEO | Edit page titles and descriptions by language with a live search preview. Set the canonical site address, indexing rules, robots, sitemap, and sharing images. |

Registration, email verification codes, and password resets require working SMTP. The server keeps codes out of logs, and isolated tests use an in-memory mailbox. On PostgreSQL, follow the deployment guides to install extensions such as SEO, wallpapers, dashboard statistics, registration policy, nickname wordlists, footer/appearance settings, and support settings.

## Deployment options

The frontend uses React, Vite, and TypeScript. The Fastify API uses PostgreSQL for persistence. The public production site uses Vercel with Neon.

| Option | Service and persistence | Configuration |
| --- | --- | --- |
| Vercel + PostgreSQL / Neon | Vercel Node.js 22 Functions serve the full API with a separate PostgreSQL database. | [Vercel and Neon guide](docs/vercel-neon.md) · [Vercel config](vercel.json) |
| Docker Compose + PostgreSQL 18 | Self-host the full app with Caddy for HTTPS and a persistent PostgreSQL volume. | [Initialization, upgrades, backup, and restore](docs/docker-postgres.md) · [Compose config](compose.postgres.yaml) |
| Standalone Node server | Fastify serves the built site and API on the same origin. Connect to an initialized PostgreSQL database via `DATABASE_URL`. | [Node entry point](server/index.ts) · [Example configuration](.env.example) |
| Sites Worker / static hosting | Serves static pages, local practice, and local records. Accounts, cloud sync, online leaderboards, administration, and the shared wallpaper require a separately connected same-origin API. | [Worker entry point](worker/index.js) · [Sites packaging script](scripts/prepare-sites-build.mjs) |

### Before deploying

- Use a stable `CODE_SECRET` of at least 32 characters in production. Keep the database URL and SMTP credentials on the server. Variables beginning with `VITE_` can be exposed in the public build. `VITE_SITE_URL` supplies the default canonical and sitemap origin.
- The Vercel build checks the PostgreSQL schema and application startup. Give Preview a separate database or schema and its own secrets. Use the initialization, upgrade, and restore steps for your deployment, and store the `CODE_SECRET` associated with database backups securely.
- For standalone Node, run `npm run build`, set `NODE_ENV=production` and the database and secret variables in the service environment, then run `npm run start`. Use HTTPS at the public entry point. The API defaults to port `3001`.
- TypeLune uses ordinary HTTP requests. Browser-facing HTTP/2 and HTTP/3 are negotiated separately from the CDN's origin connection. See the deployment documentation for proxy configuration and troubleshooting.

[Deployment security checklist](docs/deployment-security-checklist.md) · [HTTP protocols and troubleshooting](docs/vercel-neon.md#http-协议与排查)

### Docker Compose quick reference (PostgreSQL)

For a new installation, copy the example configuration. Set `SITE_DOMAIN`, PostgreSQL credentials, and an independently generated `CODE_SECRET`, and configure SMTP and the administrator email as needed. Caddy can obtain HTTPS certificates when the domain points to your server and ports 80 and 443 are reachable. Follow the [PostgreSQL deployment guide](docs/docker-postgres.md) for schema initialization, extensions, administrator bootstrap, and `pg_dump` backup and restore.

```bash
cp .env.example .env
docker compose -f compose.postgres.yaml config --quiet
docker compose -f compose.postgres.yaml up -d --build
```

## Local development and tests

Use Node.js 22.13+ and npm for local development. The Docker app image uses Node.js 26. Configure `DATABASE_URL` for PostgreSQL and start the API first, then run Vite in a second terminal.

```bash
git clone https://github.com/imlotso/TypeLune.git
cd TypeLune
npm ci
npm run dev:api
```

```bash
npm run dev
```

Open the address printed by Vite, usually `http://localhost:5173`. The development frontend proxies `/api` to port `3001`. To test SMTP or PostgreSQL, set the corresponding server-side variables in the environment that starts the API.

```bash
npm run typecheck
npm test
npm run build
npm run test:sites
npm run test:vercel-esm
npx playwright install --with-deps --only-shell chromium
npm run test:e2e
```

[GitHub CI](.github/workflows/ci.yml) covers pull requests and `main`. It runs type checks, unit and integration tests, the production build, Sites packaging checks, Chromium end-to-end tests with isolated PostgreSQL, Node 22 function checks, and Docker smoke tests. PostgreSQL browser tests require a disposable loopback database. Playwright composition coverage can be supplemented by [native Linux IME verification](docs/qa/2026-11-15-system-ime.md).

## License and documentation

The code is licensed under the [GNU GPL v3](LICENSE). See the attribution documents for the bundled articles and optional nickname wordlists. Wallhaven images retain their original rights and licensing. The app links to the image source.

[Chinese article sources](docs/chinese-article-sources.md) · [English article sources](docs/english-article-sources.md) · [Nickname wordlist attribution](docs/licenses/nickname-wordlists.md) · [Security audit](docs/security-audit.md) · [Performance audit](docs/performance-audit.md)
