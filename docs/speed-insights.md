# Vercel Speed Insights (free only)

The React entry uses the official `@vercel/speed-insights` SDK. Collection is enabled **only** when Vite builds with Vercel's `VERCEL=1` and `VERCEL_ENV=production`. Docker, local builds, tests, and Preview deployments do not inject the collection script. Do not set those Vercel platform variables in self-hosted builds.

Sampling is 10%. `beforeSend` accepts only the public `/` URL, strips the query and fragment, and rejects credential-bearing or other paths. No account ID, email, practice text, or article content is added. This is performance monitoring, not session replay or typing analytics.

As verified 2026-11-16, the free tier shares 10,000 events in a rolling 30-day window across the team, with no project fee or event overage. At the cap, collection pauses, not the website. The free dashboard provides RES and limited route summaries; full Core Web Vitals breakdowns require paid Plus. **Do not enable Plus, start a trial, or upgrade the plan.**

Current official quickstart requires adding the SDK and deploying, not purchasing an add-on. After this PR passes CI and is deployed, inspect the production browser for the injected Speed Insights script and successful intake. Dashboard data may take time and sampled sessions may send no event. Do not claim data is flowing based only on build success. Preview remaining silent is expected.

Sources:
- https://vercel.com/docs/speed-insights/limits-and-pricing
- https://vercel.com/docs/speed-insights/quickstart
- https://vercel.com/docs/speed-insights/package
- https://vercel.com/docs/speed-insights/privacy-policy
