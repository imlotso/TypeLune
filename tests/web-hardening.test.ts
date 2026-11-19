import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { documentContentSecurityPolicy, trustImmediateProxy } from '../server/security-headers';
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync } from 'node:zlib';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../server/app';

let app: Awaited<ReturnType<typeof createApp>>;
let directory: string | undefined;
afterEach(async () => { await app?.close(); if (directory) { rmSync(directory, { recursive: true, force: true }); directory = undefined; } });

it('protects API responses including errors from caching, framing and sniffing', async () => {
  app = await createApp({ databasePath: ':memory:', secureCookies: false });
  for (const url of ['/api/me', '/api/not-found']) {
    const response = await app.inject({ url });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
  }
});

it('correlates server failures without logging or returning error details', async () => {
  app = await createApp({ databasePath: ':memory:' });
  const sentinel = 'private-value-in-fixture';
  app.get('/api/test-unavailable', async () => {
    throw Object.assign(new Error(sentinel), { code: '42P01', detail: sentinel });
  });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const response = await app.inject({ url: '/api/test-unavailable', headers: { authorization: sentinel } });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain(sentinel);
    const id = response.headers['x-request-id'];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(log.mock.calls).toEqual([[JSON.stringify({
      event: 'unexpected_request_error', scope: 'api', category: 'database', id,
    })]]);
  } finally {
    log.mockRestore();
  }
});

it('compresses only negotiated public catalog responses and preserves pagination and no-store', async () => {
  app = await createApp({ databasePath: ':memory:' });
  const headers = { 'x-list-paged': '1' };
  const plain = await app.inject({ url: '/api/articles', headers });
  const compressed = await app.inject({ url: '/api/articles', headers: { ...headers, 'accept-encoding': 'gzip' } });
  expect(compressed.statusCode).toBe(200);
  expect(compressed.headers['content-encoding']).toBe('gzip');
  expect(compressed.headers.vary).toMatch(/accept-encoding/i);
  expect(compressed.headers['cache-control']).toBe('no-store');
  expect(gunzipSync(compressed.rawPayload).toString()).toBe(plain.body);
  expect(compressed.rawPayload.byteLength).toBeLessThan(plain.rawPayload.byteLength);

  const privateResponse = await app.inject({ url: '/api/me', headers: { 'accept-encoding': 'gzip' } });
  expect(privateResponse.headers['content-encoding']).toBeUndefined();
  expect(privateResponse.headers['cache-control']).toBe('no-store');
});

it('rejects cross-site mutations even when Origin is absent, while accepting same-origin calls', async () => {
  app = await createApp({ databasePath: ':memory:', secureCookies: false });
  for (const site of ['cross-site', 'same-site']) {
    const response = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { 'sec-fetch-site': site } });
    expect(response.statusCode).toBe(403);
    expect(response.headers['cache-control']).toBe('no-store');
  }
  const sameOrigin = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { 'sec-fetch-site': 'same-origin' } });
  expect(sameOrigin.statusCode).toBe(200);
});

it('serves distinct public entry pages, revalidates HTML, caches only hashed assets and marks unknown routes 404', async () => {
  directory = mkdtempSync(join(tmpdir(), 'typelune-http-'));
  mkdirSync(join(directory, 'seo')); mkdirSync(join(directory, 'assets'));
  writeFileSync(join(directory, 'index.html'), '<h1>Home</h1>');
  writeFileSync(join(directory, 'app.html'), '<!doctype html><html><head><title>Fixture</title><meta name="robots" content="noindex, follow"></head><body><div id="root"></div></body></html>');
  writeFileSync(join(directory, 'seo/lessons.html'), '<h1>Lessons</h1>');
  const script = 'export {};';
  writeFileSync(join(directory, 'assets/app-12345678.js'), script);
  writeFileSync(join(directory, 'assets/app-12345678.js.br'), brotliCompressSync(script));
  writeFileSync(join(directory, 'assets/app-12345678.js.gz'), gzipSync(script));
  writeFileSync(join(directory, 'assets/wallpaper.webp'), 'fixture');
  app = await createApp({ databasePath: ':memory:', secureCookies: false, staticRoot: directory });
  const lessons = await app.inject({ url: '/lessons?test=1' });
  expect(lessons.statusCode).toBe(200); expect(lessons.body).toContain('指法课程');
  expect(lessons.headers['cache-control']).toBe('no-store');
  const account = await app.inject({ url: '/account' });
  expect(account.statusCode).toBe(200); expect(account.headers['x-robots-tag']).toBe('noindex, follow');
  const unknown = await app.inject({ url: '/not-a-page' });
  expect(unknown.statusCode).toBe(404); expect(unknown.headers['x-robots-tag']).toBe('noindex, follow');
  expect((await app.inject({ url: '/assets/app-12345678.js' })).headers['cache-control']).toBe('public, max-age=31536000, immutable');
  expect((await app.inject({ url: '/assets/wallpaper.webp' })).headers['cache-control']).toBe('no-cache');
  for (const encoding of ['br', 'gzip']) {
    const compressed = await app.inject({ url: '/assets/app-12345678.js', headers: { 'accept-encoding': encoding } });
    expect(compressed.headers['content-encoding']).toBe(encoding);
    expect(String(compressed.headers.vary).toLowerCase()).toContain('accept-encoding');
    expect(compressed.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect((encoding === 'br' ? brotliDecompressSync(compressed.rawPayload) : gunzipSync(compressed.rawPayload)).toString()).toBe(script);
  }
});

it('requires the same origin scheme behind a trusted HTTPS proxy and rejects credential-bearing Origins', async () => {
  app = await createApp({ databasePath: ':memory:', secureCookies: true, trustProxy: true });
  for (const origin of ['http://typing.test', 'https://user@typing.test', 'https://typing.test/path']) {
    const response = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: {
      host: 'typing.test', 'x-forwarded-proto': 'https', origin,
    } });
    expect(response.statusCode).toBe(403);
  }
  const sameOrigin = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: {
    host: 'typing.test', 'x-forwarded-proto': 'https', origin: 'https://typing.test',
  } });
  expect(sameOrigin.statusCode).toBe(200);
});

it('applies cache and browser protections to rate-limit failures too', async () => {
  app = await createApp({ databasePath: ':memory:', secureCookies: false });
  for (let index = 0; index < 180; index++) await app.inject({ url: '/api/health' });
  const limited = await app.inject({ url: '/api/health' });
  expect(limited.statusCode).toBe(429);
  expect(limited.headers['cache-control']).toBe('no-store');
  expect(limited.headers['x-content-type-options']).toBe('nosniff');
  expect(limited.headers['x-frame-options']).toBe('DENY');
});

it('rejects malformed code purposes before consuming the mailbox budget', async () => {
  const sent: string[] = [];
  app = await createApp({ databasePath: ':memory:', mailer: { async sendCode(_email, _code, purpose) { sent.push(purpose); } } });
  const send = (purpose: unknown) => app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'fixture@example.test', purpose } });
  for (const purpose of [null, ['register'], { label: 'register' }, 1, 'other']) expect((await send(purpose)).statusCode).toBe(400);
  expect(sent).toEqual([]);
  expect((await send('register')).statusCode).toBe(200);
  expect(sent).toEqual(['register']);
});

it('pins document script execution to same-origin scripts and the theme hash at both entry points', () => {
  const html = readFileSync('index.html', 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
  const hash = createHash('sha256').update(script).digest('base64');
  const edge = JSON.parse(readFileSync('vercel.json', 'utf8')) as { routes: Array<{ headers: Record<string, string> }> };
  expect(edge.routes[0].headers['Content-Security-Policy']).toBe(documentContentSecurityPolicy);
  expect(documentContentSecurityPolicy).toContain(`script-src 'self' 'sha256-${hash}'`);
  expect(documentContentSecurityPolicy).toContain("connect-src 'self'");
});

it('uses the connecting ingress and its nearest forwarded address for rate limits', async () => {
  app = await createApp({ databasePath: ':memory:', trustProxy: trustImmediateProxy, mailer: { async sendCode() {} } });
  const send = (prefix: string, email: string) => app.inject({ method: 'POST', url: '/api/auth/code',
    headers: { 'x-forwarded-for': `${prefix}, 198.51.100.10` }, payload: { email, purpose: 'login' } });
  for (let index = 0; index < 8; index++) expect((await send('203.0.113.1', `fixture-${index}@example.test`)).statusCode).toBe(200);
  const limited = await send('203.0.113.2', 'another@example.test');
  expect(limited.statusCode).toBe(429);
  expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
});
