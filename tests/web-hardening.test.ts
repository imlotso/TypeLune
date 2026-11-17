import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync } from 'node:zlib';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
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

it('rejects cross-site mutations even when Origin is absent, while accepting same-origin calls', async () => {
  app = await createApp({ databasePath: ':memory:', secureCookies: false });
  const response = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { 'sec-fetch-site': 'cross-site' } });
  expect(response.statusCode).toBe(403);
  expect(response.headers['cache-control']).toBe('no-store');
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
  for (const origin of ['http://typing.test', 'https://user@typing.test']) {
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
