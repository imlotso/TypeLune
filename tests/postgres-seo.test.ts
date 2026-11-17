import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migratePostgres } from '../server/postgres/migrate';
import { seedPostgresCatalog } from '../server/postgres/seed';
import { bootstrapPostgresAdmin } from '../server/postgres/bootstrap';
import { PostgresDatabase } from '../server/postgres/database';
import { AsyncPostgres } from '../server/database/postgres';
import { createApp } from '../server/app';
import { createVercelHandler } from '../server/vercel';
import type { SeoSnapshot } from '../src/lib/seo-settings';
const url = process.env.DAZI_TEST_DATABASE_URL;
(url ? describe : describe.skip)('managed bilingual SEO on actual PostgreSQL through Node and Vercel HTTP', () => {
  let client: pg.Client, database: PostgresDatabase, node: Awaited<ReturnType<typeof createApp>>, handler: ReturnType<typeof createVercelHandler>, server: ReturnType<typeof createServer>;
  let schema: string, owner: string, nodeUrl: string, vercelUrl: string;
  const secret = 'postgres-seo-test-only-secret-at-least-32-characters';
  beforeAll(async () => {
    const parsed = new URL(url!); if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) || !/test/u.test(parsed.pathname)) throw new Error('Disposable loopback test database required');
    schema = 'seo_test_' + randomBytes(6).toString('hex'); client = new pg.Client({ connectionString: url }); await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`); await client.query(`SET search_path TO "${schema}"`);
    await migratePostgres(client, { database: parsed.pathname.slice(1), schema });
    database = new PostgresDatabase(url!, schema); const db = new AsyncPostgres(database); await seedPostgresCatalog(db);
    owner = await bootstrapPostgresAdmin(db, 'SeoAdmin', 'seo@example.test', 'seo-test-password-123');
    node = await createApp({ databaseUrl: url, postgresSchema: schema, codeSecret: secret, secureCookies: false, seoOrigin: 'https://typing.example' });
    nodeUrl = await node.listen({ port: 0, host: '127.0.0.1' });
    handler = createVercelHandler({ DATABASE_URL: url, DAZI_DATABASE_SCHEMA: schema, CODE_SECRET: secret, VITE_SITE_URL: 'https://typing.example' });
    server = createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening'); vercelUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }, 30_000);
  afterAll(async () => {
    await node?.close(); if (server) await new Promise<void>(resolve => server.close(() => resolve())); await handler?.close(); await database?.close();
    if (client) { await client.query('SET search_path TO public'); if (schema) await client.query(`DROP SCHEMA "${schema}" CASCADE`); await client.end(); }
  });
  async function login(base: string) {
    const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ identifier: 'SeoAdmin', password: 'seo-test-password-123' }) });
    expect(response.status).toBe(200); return { cookie: response.headers.get('set-cookie')!.split(';')[0], 'x-workspace-owner': owner };
  }
  const post = (base: string, path: string, headers: Record<string, string>, body: unknown) => fetch(base + path, { method: 'POST', headers: { ...headers, 'content-type': 'application/json', origin: base }, body: JSON.stringify(body) });
  it('boots without installing optional storage and installs SEO explicitly without altering old schema/settings', async () => {
    const before = (await client.query('SELECT version,checksum FROM dazi_schema_migrations ORDER BY version')).rows;
    for (const base of [nodeUrl, vercelUrl]) {
      const headers = await login(base);
      const current = await (await fetch(base + '/api/admin/settings/seo', { headers })).json();
      expect(current.available).toBe(false); expect(current.revision).toBe(0);
      expect((await fetch(base + '/?tl=en')).status).toBe(200);
      const response = await post(base, '/api/admin/settings/seo', headers, { settings: current.settings, revision: 0 });
      expect(response.status).toBe(503); expect((await response.json()).code).toBe('SEO_STORAGE_NOT_READY');
    }
    expect((await client.query("SELECT to_regclass('seo_settings') AS name")).rows[0].name).toBeNull();
    const parsed = new URL(url!); const databaseName = parsed.pathname.slice(1);
    const env = { ...process.env, DATABASE_URL: url, DAZI_DATABASE_HOST: parsed.hostname, DAZI_DATABASE_NAME: databaseName, DAZI_DATABASE_SCHEMA: schema, DAZI_CONFIRM_TARGET: `${parsed.hostname}/${databaseName}/${schema}` };
    for (let index = 0; index < 2; index++) expect(execFileSync(process.execPath, ['--import', 'tsx', 'scripts/postgres-database.ts', 'seo'], { env, encoding: 'utf8' })).toContain('SEO settings extension is ready.');
    expect((await client.query('SELECT version,checksum FROM dazi_schema_migrations ORDER BY version')).rows).toEqual(before);
    expect((await client.query('SELECT settings FROM site_settings')).rows).toEqual([]);
    await expect(database.verifySchema()).resolves.toBeUndefined();
    for (const base of [nodeUrl, vercelUrl]) {
      const current = await (await fetch(base + '/api/admin/settings/seo', { headers: await login(base) })).json();
      expect(current.available).not.toBe(false);
    }
  }, 30_000);
  it('persists settings across adapters/restarts with independent SEO/site revisions and bilingual HTML/sitemaps', async () => {
    const nodeHeaders = await login(nodeUrl), vercelHeaders = await login(vercelUrl);
    const initial: SeoSnapshot = await (await fetch(nodeUrl + '/api/admin/settings/seo', { headers: nodeHeaders })).json();
    initial.settings.homeTitle.en = 'Managed English title'; initial.settings.sitemapLanguages = ['zh-CN', 'en'];
    expect((await post(nodeUrl, '/api/admin/settings/seo', nodeHeaders, { settings: initial.settings, revision: initial.revision })).status).toBe(200);
    const site = await (await fetch(vercelUrl + '/api/admin/settings/site', { headers: vercelHeaders })).json();
    expect(site.revision).toBe(0); expect(site.settings).not.toHaveProperty('seo');
    expect((await post(vercelUrl, '/api/admin/settings/site', vercelHeaders, { settings: { ...site.settings, registrationEnabled: false }, revision: 0 })).status).toBe(200);
    expect((await post(nodeUrl, '/api/admin/settings/seo', nodeHeaders, { settings: initial.settings, revision: 0 })).status).toBe(409);
    const seo: SeoSnapshot = await (await fetch(vercelUrl + '/api/admin/settings/seo', { headers: vercelHeaders })).json(); expect(seo.revision).toBe(1); expect(seo.settings.homeTitle.en).toBe('Managed English title');
    seo.settings.description.en = 'Updated without rebuilding'; expect((await post(vercelUrl, '/api/admin/settings/seo', vercelHeaders, { settings: seo.settings, revision: seo.revision })).status).toBe(200);
    expect((await (await fetch(nodeUrl + '/api/site/features')).json()).registrationEnabled).toBe(false);
    const siteRow = JSON.parse((await client.query('SELECT settings FROM site_settings WHERE id=1')).rows[0].settings); expect(siteRow).not.toHaveProperty('seo');
    expect((await client.query('SELECT revision FROM seo_settings WHERE id=1')).rows[0].revision).toBe('2');
    const html = await fetch(vercelUrl + '/api/handler?__dazi_page=%2F&tl=en&tracking=drop');
    expect(html.status).toBe(200); const body = await html.text(); expect(body).toContain('<html lang="en">'); expect(body).toContain('<title>Managed English title</title>'); expect(body).toContain('hreflang="zh-CN"'); expect(body).toContain('href="https://typing.example/?tl=en"');
    const article = await fetch(vercelUrl + '/api/handler?__dazi_page=%2Farticles%2Fzh-beginner-1&tl=en'); expect(article.status).toBe(200); expect(await article.text()).toContain('<article lang="zh-CN">');
    const sitemap = await fetch(vercelUrl + '/api/handler?__dazi_page=%2Fsitemap.xml'); expect(sitemap.status).toBe(200); const xml = await sitemap.text(); expect(xml).toContain('/articles/zh-beginner-1?tl=en'); expect(xml).not.toMatch(/\/users|\/account|\/records|\/admin/);
    expect((await fetch(vercelUrl + '/api/handler?__dazi_page=%2Faccount')).status).toBe(400);
    expect((await fetch(vercelUrl + '/api/admin/settings/seo')).status).toBe(403);
    await node.close(); node = await createApp({ databaseUrl: url, postgresSchema: schema, codeSecret: secret, secureCookies: false });
    expect((await node.inject('/?tl=en')).body).toContain('<title>Managed English title</title>');
  }, 30_000);
});
