import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { expect, it } from 'vitest';
import { createApp, type AppOptions } from '../server/app';
import { dashboardVisitsSchema } from '../server/dashboard-visits';
import { AsyncPostgres } from '../server/database/postgres';
import { PostgresDatabase } from '../server/postgres/database';
import { migratePostgres } from '../server/postgres/migrate';
import { seedPostgresCatalog } from '../server/postgres/seed';

const url = process.env.DAZI_TEST_DATABASE_URL;
const oldDay = Date.UTC(2026, 10, 10);
const currentDay = Date.UTC(2026, 10, 19);
const trustedGeo = { 'x-vercel-ip-country': 'US', 'x-vercel-ip-country-region': 'CA' };

async function verifyOverview(database: AppOptions, installDashboard?: () => Promise<unknown>) {
  let time = oldDay;
  let challengeCode = '';
  const create = (visitGeoSource?: 'vercel') => createApp({ ...database, visitGeoSource,
    adminEmail: 'dashboard@example.test', secureCookies: false, now: () => time,
    mailer: { async sendCode(_email, code) { challengeCode = code; } },
  });
  let app = await create('vercel');
  const visit = (page: string, headers: Record<string, string> = {}) => app.inject({
    method: 'POST', url: '/api/site/visit', payload: { page }, headers,
  });
  try {
    await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'dashboard@example.test', purpose: 'register' } });
    const account = await app.inject({ method: 'POST', url: '/api/auth/register', payload: {
      email: 'dashboard@example.test', username: 'dashboard', password: 'test-only-dashboard-password', code: challengeCode,
    } });
    expect(account.statusCode).toBe(200);
    const headers = { cookie: `session=${account.cookies[0].value}` };
    const overview = (days?: string) => app.inject({ url: '/api/admin/overview' + (days ? `?days=${days}` : ''), headers });
    expect((await app.inject('/api/admin/overview')).statusCode).toBe(403);
    expect((await overview('60')).statusCode).toBe(400);
    if (installDashboard) {
      expect((await overview()).json().activity.traffic.available).toBe(false);
      expect((await visit('practice', trustedGeo)).statusCode).toBe(204);
      await installDashboard();
    }
    expect((await visit('library', trustedGeo)).statusCode).toBe(204);
    const start = await app.inject({ method: 'POST', url: '/api/tests/start', headers, payload: { articleId: 'zh-beginner-1', duration: 60 } });
    expect(start.statusCode).toBe(200);
    time += 60_000;
    expect((await app.inject({ method: 'POST', url: `/api/tests/${start.json().id}/finish`, headers, payload: { typed: '一' } })).statusCode).toBe(200);

    time = currentDay;
    for (const [page, privacyOrGeo] of [
      ['practice', trustedGeo], ['practice', trustedGeo], ['library', {}], ['rankings', { 'x-vercel-ip-country': 'SG' }],
      ['help', { ...trustedGeo, dnt: '1' }], ['about', { ...trustedGeo, 'sec-gpc': '1' }],
    ] as const) expect((await visit(page, privacyOrGeo)).statusCode).toBe(204);
    expect((await visit('feedback', trustedGeo)).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/site/visit', headers: trustedGeo, payload: { page: 'practice', path: '/private' } })).statusCode).toBe(400);

    await app.close();
    app = await create();
    expect((await visit('practice', trustedGeo)).statusCode).toBe(204);
    const week = await overview();
    expect(week.headers['cache-control']).toBe('no-store');
    const { activity } = week.json();
    expect(activity.days).toHaveLength(7);
    expect(activity.days.at(-1)).toEqual({ date: '2026-11-19', pageViews: 5, registrations: 0, practices: 0 });
    expect(activity.traffic).toEqual({
      available: true, locatedViews: 3,
      countries: [{ country: 'US', views: 2 }, { country: 'SG', views: 1 }],
      regions: [{ country: 'US', region: 'CA', views: 2 }],
      pages: [{ page: 'practice', views: 3 }, { page: 'library', views: 1 }, { page: 'rankings', views: 1 }],
    });
    const month = (await overview('30')).json().activity;
    expect(month.days).toHaveLength(30);
    expect(month.days.find((entry: { date: string }) => entry.date === '2026-11-10')).toEqual({
      date: '2026-11-10', pageViews: 1, registrations: 1, practices: 1,
    });
    expect(month).toMatchObject({ registeredPractices: 1, guestPractices: 0, activeAccounts: 1, openFeedback: 0 });
  } finally {
    await app.close();
  }
}

it('persists bounded anonymous visits and derives real account and practice trends in SQLite', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'typelune-overview-'));
  try { await verifyOverview({ databasePath: join(directory, 'overview.sqlite') }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
});

it.skipIf(!url)('supports the same dashboard in PostgreSQL after explicitly installing its extension', async () => {
  const parsed = new URL(url!);
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) throw new Error('Loopback test database required');
  const client = new pg.Client({ connectionString: url });
  const schema = 'typelune_overview_' + randomBytes(8).toString('hex');
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await migratePostgres(client, { database: parsed.pathname.slice(1), schema });
    const db = new AsyncPostgres(new PostgresDatabase(url!, schema));
    try { await seedPostgresCatalog(db); } finally { await db.close(); }
    await verifyOverview({ databaseUrl: url, postgresSchema: schema, codeSecret: 'dashboard-integration-test-key-value' }, async () => {
      await client.query(dashboardVisitsSchema);
      await client.query(dashboardVisitsSchema);
    });
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
}, 15_000);
