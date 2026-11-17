import sharp from 'sharp';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AsyncDatabase } from './database/types.js';
import type { AdminActor, createAdminAudit } from './admin.js';
import { prepareSupportImage } from './support-settings.js';
import { defaultSeoSettings, seoPaths, type SeoSettings, type SeoSnapshot, type PublicSeoSettings } from '../src/lib/seo-settings.js';

const text = (max: number, min = 0) => z.string().trim().min(min).max(max).regex(/^[^\p{Cc}\p{Cf}\p{Cs}]*$/u);
const localized = (max: number, min = 0) => z.strictObject({ 'zh-CN': text(max, min), en: text(max, min) });
const image = z.strictObject({ dataUrl: z.string().max(1_400_000) }).nullable();
const language = z.enum(['zh-CN', 'en']);
const origin = text(2048).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash; } catch { return false; }
});
const page = z.strictObject({ title: localized(200, 1), description: localized(500, 1), indexable: z.boolean(), sitemap: z.boolean(),
  changefreq: z.enum(['daily', 'weekly', 'monthly', 'yearly']), priority: z.number().min(0).max(1) });
const schema = z.strictObject({
  siteUrl: origin, siteName: text(100, 1), homeTitle: localized(200, 1), description: localized(500, 1), keywords: localized(500),
  indexingEnabled: z.boolean(), defaultLanguage: language, logo: image, favicon: image, socialImage: image,
  twitterCard: z.enum(['summary', 'summary_large_image']), googleVerification: text(200).regex(/^[A-Za-z0-9_-]*$/), bingVerification: text(200).regex(/^[A-Za-z0-9_-]*$/),
  sitemapEnabled: z.boolean(), sitemapLanguages: z.array(language).min(1).max(2).refine(values => new Set(values).size === values.length), sitemapArticles: z.boolean(),
  excludedArticleIds: z.array(text(200, 1)).max(500), robotsDisallow: z.array(text(200, 1).regex(/^\/(?!\/)[^\s?#]*$/u)).max(100),
  pages: z.record(z.string(), page).refine(pages => Object.keys(pages).length === seoPaths.length && seoPaths.every(path => Object.hasOwn(pages, path))),
});
const input = z.strictObject({ settings: schema, revision: z.number().int().nonnegative() });
export async function createSeoSettings(db: AsyncDatabase, audit: ReturnType<typeof createAdminAudit>, origin = '') {
  if (db.dialect === 'sqlite') await db.exec(`CREATE TABLE IF NOT EXISTS seo_settings (
    id INTEGER PRIMARY KEY CHECK(id=1), settings TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0)
  )`);
  let installed = db.dialect === 'sqlite';
  async function available(): Promise<boolean> {
    if (installed) return true;
    const row = await db.prepare("SELECT to_regclass('seo_settings') AS table_name").get();
    installed = !!row?.table_name;
    return installed;
  }
  const select = db.prepare('SELECT settings, revision FROM seo_settings WHERE id=1');
  async function read(): Promise<SeoSnapshot> {
    if (!await available()) return { settings: defaultSeoSettings(origin), revision: 0, available: false };
    const row = await select.get();
    return { settings: row ? schema.parse(JSON.parse(row.settings)) : defaultSeoSettings(origin), revision: row?.revision ?? 0 };
  }
  const update = db.transaction(async (actor: AdminActor, settings: SeoSettings, revision: number) => {
    if (!await available()) throw new Error('SEO storage is not installed');
    const previous = await select.get();
    if ((previous?.revision ?? 0) !== revision) return null;
    await db.prepare(`INSERT INTO seo_settings(id,settings,revision) VALUES(1,?,?)
      ON CONFLICT(id) DO UPDATE SET settings=excluded.settings,revision=excluded.revision`).run(JSON.stringify(settings), revision + 1);
    await audit(actor, 'settings.seo.update', 'setting', 'seo', 'SEO', 'Updated SEO metadata, images, indexing or sitemap settings');
    return { settings, revision: revision + 1 };
  });
  async function publicSettings(snapshot?: SeoSnapshot): Promise<PublicSeoSettings> {
    const { settings, revision } = snapshot ?? await read();
    const { logo, favicon, socialImage, excludedArticleIds: _excluded, robotsDisallow: _robots, ...publicValue } = settings;
    const url = (name: string, present: unknown) => present ? `/api/site/seo/images/${name}?v=${revision}` : null;
    return { ...publicValue, logoUrl: url('logo', logo), faviconUrl: url('favicon', favicon), socialImageUrl: url('social', socialImage) };
  }
  return { read, publicSettings, available, update: update.immediate };
}
export type SeoStore = Awaited<ReturnType<typeof createSeoSettings>>;
export function registerSeoAdminRoutes(app: FastifyInstance, store: SeoStore) {
  app.get('/settings/seo', async () => store.read());
  app.post('/settings/seo', { bodyLimit: 5 * 1024 * 1024 }, async (request, reply) => {
    if (!await store.available()) return reply.code(503).send({ error: 'SEO 配置存储尚未安装 / SEO configuration storage is not installed', code: 'SEO_STORAGE_NOT_READY' });
    const parsed = input.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'SEO 设置无效 / Invalid SEO settings' });
    const { settings, revision } = parsed.data;
    for (const name of ['logo', 'favicon', 'socialImage'] as const) {
      if (!settings[name]) continue;
      try {
        const validated = await prepareSupportImage(settings[name].dataUrl);
        const bounds = name === 'favicon' ? { width: 128, height: 128 } : name === 'logo' ? { width: 768, height: 256 } : { width: 1200, height: 630 };
        const bytes = await sharp(Buffer.from(validated.dataUrl.split(',')[1], 'base64')).resize({ ...bounds, fit: 'inside', withoutEnlargement: true }).webp(name === 'socialImage' ? { quality: 85 } : { lossless: true }).toBuffer();
        settings[name] = { dataUrl: 'data:image/webp;base64,' + bytes.toString('base64') };
      }
      catch { return reply.code(400).send({ error: '图片须为有效的单帧 PNG、JPEG 或 WebP，且不超过 1 MB / Use a valid single-frame PNG, JPEG or WebP under 1 MB' }); }
    }
    if (settings.siteUrl) settings.siteUrl = new URL(settings.siteUrl).origin;
    const result = await store.update(request.admin, settings, revision);
    if (!result) return reply.code(409).send({ error: '设置已变更，请重新加载 / Settings changed. Reload before saving.' });
    return result;
  });
}
export function registerSeoPublicSettings(app: FastifyInstance, store: SeoStore, preview = false) {
  app.get('/api/site/seo', async () => store.publicSettings());
  app.get('/api/site/seo/images/:name', async (request, reply) => {
    const { name } = request.params as { name: string };
    const key = name === 'social' ? 'socialImage' : name === 'logo' || name === 'favicon' ? name : undefined;
    const { settings } = await store.read();
    const image = key ? settings[key] : null;
    if (!image) return reply.code(404).send({ error: 'Image not found' });
    return reply.header('X-Robots-Tag', settings.indexingEnabled && !preview ? 'index, follow' : 'noindex, nofollow').header('Content-Security-Policy', "default-src 'none'; sandbox").type('image/webp').send(Buffer.from(image.dataUrl.split(',')[1], 'base64'));
  });
}
