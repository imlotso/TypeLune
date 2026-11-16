import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { createVercelHandler } from '../server/vercel';
import { migratePostgres } from '../server/postgres/migrate';
import { defaultSettings } from '../src/lib/models';

const databaseUrl = process.env.DAZI_TEST_DATABASE_URL;
for (const backend of ['SQLite', 'PostgreSQL'] as const) {
  (backend === 'PostgreSQL' && !databaseUrl ? describe.skip : describe)(`${backend} account UI locale API`, () => {
    let apps: Awaited<ReturnType<typeof createApp>>[] = [];
    let setup: pg.Client | undefined;
    let directory: string | undefined;
    let schema: string;
    let handler: ReturnType<typeof createVercelHandler> | undefined;
    let web: ReturnType<typeof createServer> | undefined;
    let vercelURL: string;
    const accounts: Record<string, Record<string, string>> = {};
    const codes = new Map<string, string>();
    beforeAll(async () => {
      let options: Parameters<typeof createApp>[0];
      if (backend === 'PostgreSQL') {
        const parsed = new URL(databaseUrl!);
        if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) throw new Error('Disposable loopback PostgreSQL only');
        schema = 'locale_test_' + randomBytes(8).toString('hex');
        setup = new pg.Client({ connectionString: databaseUrl });
        await setup.connect();
        await setup.query(`CREATE SCHEMA "${schema}"`);
        await setup.query(`SET search_path TO "${schema}"`);
        await migratePostgres(setup, { database: parsed.pathname.slice(1), schema });
        options = { databaseUrl, postgresSchema: schema };
      } else {
        directory = mkdtempSync(join(tmpdir(), 'typelune-locale-'));
        options = { databasePath: join(directory, 'test.sqlite') };
      }
      for (let i = 0; i < 2; i++) apps.push(await createApp({ ...options, secureCookies: false,
        codeSecret: 'locale-test-only-secret-at-least-32-characters',
        mailer: { async sendCode(email, code) { codes.set(email, code); } },
      }));
      for (const name of ['localeAlice', 'localeBob']) {
        const email = name.toLowerCase() + '@example.test';
        expect((await apps[0].inject({ method: 'POST', url: '/api/auth/code', payload: { email, purpose: 'register' } })).statusCode).toBe(200);
        const registered = await apps[0].inject({ method: 'POST', url: '/api/auth/register', payload: { email, username: name, password: 'isolated-password-123', code: codes.get(email) } });
        expect(registered.statusCode).toBe(200);
        accounts[name] = { cookie: registered.cookies[0].name + '=' + registered.cookies[0].value,
          'x-workspace-owner': registered.json().user.id, 'x-workspace-protocol': '2', 'x-workspace-capabilities': 'local-conflict-v1' };
      }
      if (backend === 'PostgreSQL') {
        handler = createVercelHandler({ DATABASE_URL: databaseUrl, DAZI_DATABASE_SCHEMA: schema,
          CODE_SECRET: 'locale-test-only-secret-at-least-32-characters' });
        web = createServer(handler); web.listen(0, '127.0.0.1'); await once(web, 'listening');
        vercelURL = 'http://127.0.0.1:' + (web.address() as { port: number }).port;
      }
    }, 30000);
    afterAll(async () => {
      if (web) await new Promise<void>(resolve => web!.close(() => resolve()));
      await handler?.close();
      await Promise.all(apps.map(app => app.close()));
      if (setup) { await setup.query('SET search_path TO public'); await setup.query(`DROP SCHEMA "${schema}" CASCADE`); await setup.end(); }
      if (directory) rmSync(directory, { recursive: true, force: true });
    });
    async function snapshot(name = 'localeAlice', instance = 1) {
      const response = await apps[instance].inject({ url: '/api/workspace', headers: accounts[name] });
      expect(response.statusCode).toBe(200); return response.json();
    }
    const preference = (data: any) => data.items.find((item: any) => item.kind === 'settings' && item.id === 'preferences');
    function payload(data: any, value: unknown, baseRevision = preference(data)?.serverRevision ?? 0) {
      return { generation: data.generation, items: [{ kind: 'settings', id: 'preferences', updatedAt: Date.now(), baseRevision, value }] };
    }
    async function write(value: unknown, name = 'localeAlice', baseRevision?: number) {
      const data = await snapshot(name);
      return apps[0].inject({ method: 'POST', url: '/api/workspace/sync', headers: accounts[name], payload: payload(data, value, baseRevision) });
    }
    it('persists each supported locale across independent application instances', async () => {
      for (const uiLocale of ['auto', 'zh', 'en']) {
        expect((await write({ ...defaultSettings, uiLocale })).statusCode).toBe(200);
        expect(preference(await snapshot()).value.uiLocale).toBe(uiLocale);
      }
    });
    it('accepts old settings payload without a locale field', async () => {
      const { uiLocale: _locale, ...legacy } = defaultSettings;
      expect((await write(legacy)).statusCode).toBe(200);
      expect(preference(await snapshot()).value.uiLocale).toBe('en'); // Legacy clients must not erase the account preference.
    });
    it('rejects invalid locale values without changing the persisted preference', async () => {
      expect((await write({ ...defaultSettings, uiLocale: 'zh' })).statusCode).toBe(200);
      const before = preference(await snapshot());
      for (const uiLocale of ['fr', 'EN', '', null, 1]) {
        expect((await write({ ...defaultSettings, uiLocale })).statusCode).toBe(400);
      }
      expect(preference(await snapshot())).toEqual(before);
    });
    it('isolates accounts and refuses a stale base revision without overwriting', async () => {
      expect((await write({ ...defaultSettings, uiLocale: 'en' })).statusCode).toBe(200);
      expect((await write({ ...defaultSettings, uiLocale: 'zh' }, 'localeBob')).statusCode).toBe(200);
      const before = preference(await snapshot());
      expect((await write({ ...defaultSettings, uiLocale: 'auto' }, 'localeAlice', 0)).statusCode).toBe(409);
      expect(preference(await snapshot())).toEqual(before);
      expect(preference(await snapshot('localeBob')).value.uiLocale).toBe('zh');
      expect((await apps[0].inject({ url: '/api/workspace', headers: { ...accounts.localeBob, 'x-workspace-owner': accounts.localeAlice['x-workspace-owner'] } })).statusCode).toBe(403);
    });
    if (backend === 'PostgreSQL') it('reads and writes the same field through the rewritten Vercel handler', async () => {
      const headers = { ...accounts.localeAlice, origin: vercelURL, 'content-type': 'application/json' };
      const readURL = vercelURL + '/api/handler?__dazi_path=workspace';
      const initial = await fetch(readURL, { headers }); expect(initial.status).toBe(200);
      const data = await initial.json();
      const saved = await fetch(vercelURL + '/api/handler?__dazi_path=workspace%2Fsync', { method: 'POST', headers, body: JSON.stringify(payload(data, { ...defaultSettings, uiLocale: 'auto' })) });
      expect(saved.status).toBe(200);
      expect(preference(await snapshot()).value.uiLocale).toBe('auto');
      expect((await write({ ...defaultSettings, uiLocale: 'en' })).statusCode).toBe(200);
      expect(preference(await (await fetch(readURL, { headers })).json()).value.uiLocale).toBe('en');
    });
  });
}
