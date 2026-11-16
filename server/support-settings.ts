import sharp from 'sharp';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AsyncDatabase } from './database/types.js';
import type { AdminActor, createAdminAudit } from './admin.js';
const maxBytes = 1024 * 1024;
const image = z.strictObject({ dataUrl: z.string().max(1_400_000) }).nullable();
const schema = z.strictObject({ enabled: z.boolean(), alipay: image, wechat: image });
export type SupportSettings = z.infer<typeof schema>;
export type SupportSnapshot = { settings: SupportSettings; revision: number };
const empty: SupportSettings = { enabled: false, alipay: null, wechat: null };
const input = z.strictObject({ settings: schema, revision: z.number().int().nonnegative() });
type ImageIssue = 'FORMAT' | 'SIZE' | 'DIMENSIONS' | 'FRAMES' | 'NORMALIZED_SIZE';
class SupportImageError extends Error { constructor(public issue: ImageIssue) { super(issue); } }
export async function prepareSupportImage(dataUrl: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new SupportImageError('FORMAT');
  if (match[2].length > Math.ceil(maxBytes / 3) * 4) throw new SupportImageError('SIZE');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > maxBytes) throw new SupportImageError('SIZE');
  if (!bytes.length || bytes.toString('base64') !== match[2]) throw new SupportImageError('FORMAT');
  const source = sharp(bytes, { animated: true, limitInputPixels: 4_000_000, failOn: 'error' });
  const info = await source.metadata();
  if (info.format !== match[1] || !info.width || !info.height) throw new SupportImageError('FORMAT');
  if ((info.pages ?? 1) !== 1) throw new SupportImageError('FRAMES');
  if (info.width > 4096 || info.height > 4096 || info.width * info.height > 4_000_000) throw new SupportImageError('DIMENSIONS');
  // Lossless normalization strips metadata without blurring QR module boundaries.
  const normalized = await source.rotate().webp({ lossless: true }).toBuffer();
  if (normalized.length > maxBytes) throw new SupportImageError('NORMALIZED_SIZE');
  return { dataUrl: `data:image/webp;base64,${normalized.toString('base64')}` };
}
export async function createSupportSettings(db: AsyncDatabase, audit: ReturnType<typeof createAdminAudit>) {
  if (db.dialect === 'sqlite') await db.exec('CREATE TABLE IF NOT EXISTS support_settings (id INTEGER PRIMARY KEY CHECK(id=1), settings TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0))');
  const available = async () => db.dialect === 'sqlite' || !!(await db.prepare("SELECT to_regclass('support_settings') AS name").get())?.name;
  const select = db.prepare('SELECT settings,revision FROM support_settings WHERE id=1');
  async function read(): Promise<SupportSnapshot> {
    if (!(await available())) return { settings: { ...empty }, revision: 0 };
    const row = await select.get();
    return { settings: schema.parse(row ? JSON.parse(row.settings) : empty), revision: row?.revision ?? 0 };
  }
  const update = db.transaction(async (actor: AdminActor, settings: SupportSettings, revision: number) => {
    const row = await select.get();
    if ((row?.revision ?? 0) !== revision) return null;
    await db.prepare(`INSERT INTO support_settings(id,settings,revision) VALUES(1,?,?)
      ON CONFLICT(id) DO UPDATE SET settings=excluded.settings,revision=excluded.revision`).run(
      JSON.stringify(settings), revision + 1);
    await audit(actor, 'settings.support.update', 'setting', 'support', 'Support QR codes', 'Updated support visibility or QR images');
    return { settings, revision: revision + 1 };
  });
  return { read, available, update: update.immediate };
}
export function registerSupportAdminRoutes(app: FastifyInstance, store: Awaited<ReturnType<typeof createSupportSettings>>) {
  app.get('/support', async (_request, reply) => { if (!(await store.available())) return reply.code(503).send({ error: 'Support settings storage has not been installed' }); return store.read(); });
  app.post('/support', { bodyLimit: 3 * 1024 * 1024 }, async (request, reply) => {
    if (!(await store.available())) return reply.code(503).send({ error: 'Support settings storage has not been installed' });
    const parsed = input.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid support settings' });
    const { settings, revision } = parsed.data;
    // Validate everything before writing; never partially publish either code.
    for (const key of ['alipay', 'wechat'] as const) {
      if (!settings[key]) continue;
      try { settings[key] = await prepareSupportImage(settings[key].dataUrl); }
      catch (error) {
        const issue = error instanceof SupportImageError ? error.issue :
          error instanceof Error && /pixel limit/i.test(error.message) ? 'DIMENSIONS' : 'FORMAT';
        return reply.code(400).send({ error: key + ': QR image validation failed (' + issue + '). Neither image was saved.', code: 'SUPPORT_IMAGE_' + key.toUpperCase() + '_' + issue });
      }
    }
    if (settings.enabled && !settings.alipay && !settings.wechat) return reply.code(400).send({ error: 'Upload at least one QR image before enabling support' });
    const saved = await store.update(request.admin, settings, revision);
    if (!saved) return reply.code(409).send({ error: 'Settings changed. Reload before saving.' });
    return saved;
  });
}
export function registerSupportPublicRoutes(app: FastifyInstance, store: Awaited<ReturnType<typeof createSupportSettings>>) {
  app.get('/api/site/support', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { settings } = await store.read();
    if (!settings.enabled || (!settings.alipay && !settings.wechat)) return { enabled: false };
    return { enabled: true, ...(settings.alipay ? { alipay: settings.alipay } : {}), ...(settings.wechat ? { wechat: settings.wechat } : {}) };
  });
}
