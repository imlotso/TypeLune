import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createApp } from '../server/app';
import type { SeoSnapshot } from '../src/lib/seo-settings';

let app: Awaited<ReturnType<typeof createApp>>;
let directory: string;
let databasePath: string;
let admin: Record<string, string>;
const secret = 'seo-tests-only-secret-at-least-32-characters';
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'typelune-seo-api-')); databasePath = join(directory, 'test.sqlite');
  const codes = new Map<string, string>();
  app = await createApp({ databasePath, secureCookies: false, codeSecret: secret, seoOrigin: 'https://typing.example', adminEmail: 'owner@example.test', mailer: { async sendCode(email, code) { codes.set(email, code); } } });
  await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'owner@example.test', purpose: 'register' } });
  const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'owner', email: 'owner@example.test', password: 'seo-test-password-123', code: codes.get('owner@example.test') } });
  expect(response.statusCode).toBe(200);
  admin = { cookie: `session=${response.cookies.find(cookie => cookie.name === 'session')!.value}`, 'x-workspace-owner': response.json().user.id };
});
afterEach(async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); });
const read = async (): Promise<SeoSnapshot> => (await app.inject({ url: '/api/admin/settings/seo', headers: admin })).json();
const save = (snapshot: SeoSnapshot, headers = admin) => app.inject({ method: 'POST', url: '/api/admin/settings/seo', headers, payload: { settings: snapshot.settings, revision: snapshot.revision } });

it('returns deterministic Chinese/English HTML with reciprocal hreflang and clean locale canonical URLs', async () => {
  for (const [language, title] of [['zh-CN', 'TypeLune · 中英文打字测试'], ['en', 'TypeLune · Chinese and English typing practice']]) {
    const response = await app.inject(`/?tl=${language}&tracking=ignored`);
    expect(response.statusCode).toBe(200); expect(response.headers['content-language']).toBe(language);
    expect(response.body).toContain(`<html lang="${language}">`); expect(response.body).toContain(`<title>${title}</title>`);
    expect(response.body).toContain(`rel="canonical" href="https://typing.example/?tl=${language}"`);
    expect(response.body).toContain('hreflang="zh-CN"'); expect(response.body).toContain('hreflang="en"'); expect(response.body).toContain('hreflang="x-default"');
    expect(response.body.match(/<link rel="canonical"[^>]+>/g)).toHaveLength(1);
    expect(response.body).not.toMatch(/rel="canonical"[^>]+tracking/);
    expect(response.headers['cache-control']).toBe('no-store');
  }
  expect((await app.inject('/help?tl=en')).body).toContain('<h2>Account</h2>');
  expect((await app.inject('/?tl=fr')).statusCode).toBe(400);
});

it('renders only current published article bodies, marks their source language, and keeps private locations out of discovery', async () => {
  const article = await app.inject('/articles/zh-beginner-1?tl=en');
  expect(article.statusCode).toBe(200); expect(article.body).toContain('<article lang="zh-CN">'); expect(article.body).toContain('我与父亲');
  expect(article.body).toContain('hreflang="en"');
  expect(article.body).toContain('"inLanguage":"zh-CN"');
  expect(article.body).toContain('"contentLanguage":"zh-CN"');
  expect((await app.inject('/articles/private-article?tl=en')).statusCode).toBe(404);
  expect((await app.inject('/api/site/seo/page?path=%2Farticles%2Fprivate-article&tl=en')).statusCode).toBe(404);
  const sitemap = await app.inject('/sitemap.xml');
  expect(sitemap.statusCode).toBe(200); expect(sitemap.body).toContain('xmlns:xhtml=');
  expect(sitemap.body).toContain('/articles/zh-beginner-1?tl=en'); expect(sitemap.body).toContain('<lastmod>');
  expect(sitemap.body).not.toMatch(/\/account|\/admin|\/users|\/records|private-article/);
  expect((await app.inject('/robots.txt')).body).toContain('Allow: /api/site/seo/images/');
});

it('protects revisioned admin changes, escapes metadata, normalizes uploads and publishes updates without rebuilding', async () => {
  expect((await app.inject('/api/admin/settings/seo')).statusCode).toBe(403);
  const initial = await read();
  expect((await save(initial, {})).statusCode).toBe(403);
  expect((await save(initial, { ...admin, 'x-workspace-owner': 'someone-else' })).statusCode).toBe(403);
  const png = await sharp({ create: { width: 600, height: 300, channels: 4, background: '#6633ff' } }).png().toBuffer();
  const next = structuredClone(initial); next.settings.homeTitle.en = '<script>alert(1)</script> & title';
  next.settings.googleVerification = 'public-token_123'; next.settings.favicon = { dataUrl: 'data:image/png;base64,' + png.toString('base64') };
  const updated = await save(next); expect(updated.statusCode).toBe(200);
  expect((await save(next)).statusCode).toBe(409);
  const html = await app.inject('/?tl=en'); expect(html.body).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; title');
  expect(html.body).not.toContain('<title><script>'); expect(html.body).toContain('name="google-site-verification" content="public-token_123"');
  const publicSettings = (await app.inject('/api/site/seo')).json(); expect(publicSettings.faviconUrl).toMatch(/^\/api\/site\/seo\/images\/favicon\?v=/);
  expect(JSON.stringify(publicSettings)).not.toContain('data:image');
  const image = await app.inject(publicSettings.faviconUrl);
  expect(image.headers['x-robots-tag']).toBe('index, follow'); expect(image.headers['content-type']).toBe('image/webp');
  const metadata = await sharp(image.rawPayload).metadata(); expect(metadata.width).toBeLessThanOrEqual(128); expect(metadata.height).toBeLessThanOrEqual(128);
  const malicious = await read(); malicious.settings.siteUrl = 'javascript:alert(1)'; expect((await save(malicious)).statusCode).toBe(400);
  const svg = await read(); svg.settings.logo = { dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' }; expect((await save(svg)).statusCode).toBe(400);
});

it('keeps independent operational/SEO revisions and persists both across restart', async () => {
  const initial = await read(); initial.settings.homeTitle.en = 'Managed English title'; expect((await save(initial)).statusCode).toBe(200);
  const site = (await app.inject({ url: '/api/admin/settings/site', headers: admin })).json();
  expect(site.settings).not.toHaveProperty('seo'); expect(site.revision).toBe(0);
  const stale = await read();
  expect((await app.inject({ method: 'POST', url: '/api/admin/settings/site', headers: admin, payload: { settings: { ...site.settings, registrationEnabled: false }, revision: site.revision } })).statusCode).toBe(200);
  expect((await save(stale)).statusCode).toBe(200);
  expect((await save(stale)).statusCode).toBe(409);
  expect((await read()).settings.homeTitle.en).toBe('Managed English title');
  await app.close(); app = await createApp({ databasePath, secureCookies: false, codeSecret: secret, seoOrigin: 'https://typing.example' });
  expect((await app.inject('/?tl=en')).body).toContain('<title>Managed English title</title>');
  expect((await app.inject('/api/site/features')).json().registrationEnabled).toBe(false);
});

it('applies sitemap language/page/article exclusions and indexing toggles immediately', async () => {
  const next = await read(); next.settings.sitemapLanguages = ['en']; next.settings.pages['/lessons'].sitemap = false;
  next.settings.pages['/rankings'].indexable = false; next.settings.excludedArticleIds = ['zh-beginner-1'];
  expect((await save(next)).statusCode).toBe(200);
  const sitemap = (await app.inject('/sitemap.xml')).body;
  expect(sitemap).toContain('?tl=en'); expect(sitemap).not.toContain('?tl=zh-CN</loc>');
  expect(sitemap).not.toContain('/lessons?'); expect(sitemap).not.toContain('/rankings?'); expect(sitemap).not.toContain('/articles/zh-beginner-1?');
  expect((await app.inject('/rankings?tl=en')).headers['x-robots-tag']).toBe('noindex, follow');
  const disabled = await read(); disabled.settings.indexingEnabled = false; expect((await save(disabled)).statusCode).toBe(200);
  expect((await app.inject('/sitemap.xml')).statusCode).toBe(404);
  expect((await app.inject('/robots.txt')).body).toBe('User-agent: *\nDisallow: /\n');
  expect((await app.inject('/?tl=en')).headers['x-robots-tag']).toBe('noindex, follow');
});

it('never indexes preview HTML or publishes preview sitemaps even with indexing enabled', async () => {
  await app.close(); app = await createApp({ databasePath, secureCookies: false, codeSecret: secret, seoOrigin: 'https://typing.example', seoPreview: true });
  expect((await app.inject('/?tl=en')).headers['x-robots-tag']).toBe('noindex, follow');
  expect((await app.inject('/sitemap.xml')).statusCode).toBe(404);
  expect((await app.inject('/robots.txt')).body).toBe('User-agent: *\nDisallow: /\n');
});

it('lets public branding images be fetched but respects global and preview indexing controls', async () => {
  const snapshot = await read();
  const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#6633ff' } }).png().toBuffer();
  snapshot.settings.logo = { dataUrl: 'data:image/png;base64,' + png.toString('base64') };
  expect((await save(snapshot)).statusCode).toBe(200);
  expect((await app.inject('/api/site/seo/images/logo')).headers['x-robots-tag']).toBe('index, follow');
  const disabled = await read(); disabled.settings.indexingEnabled = false;
  expect((await save(disabled)).statusCode).toBe(200);
  expect((await app.inject('/api/site/seo/images/logo')).headers['x-robots-tag']).toBe('noindex, nofollow');
  const enabled = await read(); enabled.settings.indexingEnabled = true; expect((await save(enabled)).statusCode).toBe(200);
  await app.close(); app = await createApp({ databasePath, secureCookies: false, codeSecret: secret, seoPreview: true });
  expect((await app.inject('/api/site/seo/images/logo')).headers['x-robots-tag']).toBe('noindex, nofollow');
  expect((await app.inject('/api/site/seo')).headers['x-robots-tag']).toBe('noindex, nofollow');
});

it('renders persisted replacement metacharacters and angle brackets literally', async () => {
  const next = await read();
  next.settings.homeTitle.en = 'R&D $& $` <em>TypeLune</em>';
  next.settings.description.en = 'Practice $& safely';
  expect((await save(next)).statusCode).toBe(200);
  const html = (await app.inject('/?tl=en')).body;
  expect(html).toContain('<title>R&amp;D $&amp; $` &lt;em&gt;TypeLune&lt;/em&gt;</title>');
  expect(html).toContain('<p>Practice $&amp; safely</p>');
  expect(html.match(/<!doctype html>/gi)).toHaveLength(1);
  expect(html.match(/<\/head>/gi)).toHaveLength(1);
});
