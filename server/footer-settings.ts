import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AsyncDatabase } from './database/types.js';
import type { AdminActor, createAdminAudit } from './admin.js';
import {
  defaultFooterSettings,
  footerButtonIds,
  isSafeFooterUrl,
  type FooterButtonId,
  type FooterSettings,
  type FooterSnapshot,
} from '../src/lib/footer-settings.js';

const optionalSafeUrl = z.string().trim().max(500).refine((value) => !value || isSafeFooterUrl(value), {
  message: '仅支持 http://、https://、mailto: 或站内相对路径',
});

const requiredSafeUrl = z.string().trim().min(1).max(500).refine((value) => isSafeFooterUrl(value), {
  message: '请输入有效的 http://、https://、mailto: 或站内相对路径',
});

const buttonSchema = z.strictObject({
  id: z.enum(footerButtonIds),
  labelZh: z.string().trim().min(1).max(40),
  labelEn: z.string().trim().min(1).max(60),
  enabled: z.boolean(),
  mode: z.enum(['page', 'link']),
  url: optionalSafeUrl,
  openInNewTab: z.boolean(),
}).refine((item) => item.mode === 'page' || isSafeFooterUrl(item.url), {
  message: '外链模式必须填写有效链接',
});

const pageContentSchema = z.strictObject({
  zh: z.string().max(50_000),
  en: z.string().max(50_000),
});

const attributionSchema = z.strictObject({
  enabled: z.boolean(),
  prefix: z.string().trim().max(40),
  label: z.string().trim().max(60),
  url: optionalSafeUrl,
});

const extraLinkSchema = z.strictObject({
  id: z.string().trim().min(1).max(64),
  labelZh: z.string().trim().min(1).max(60),
  labelEn: z.string().trim().max(80),
  url: requiredSafeUrl,
  enabled: z.boolean(),
  openInNewTab: z.boolean(),
});

const footerSettingsSchema = z.strictObject({
  buttons: z.array(buttonSchema).length(footerButtonIds.length).refine(
    (items) => new Set(items.map((item) => item.id)).size === footerButtonIds.length,
    { message: '五个页脚按钮标识不能重复' },
  ),
  pages: z.strictObject({
    help: pageContentSchema,
    feedback: pageContentSchema,
    privacy: pageContentSchema,
    terms: pageContentSchema,
    about: pageContentSchema,
  }),
  attribution: attributionSchema,
  extraLinks: z.array(extraLinkSchema).max(20),
});

const updateInputSchema = z.strictObject({
  settings: footerSettingsSchema,
  revision: z.number().int().nonnegative(),
});

function normalizeStored(raw: unknown): FooterSettings {
  const defaults = defaultFooterSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const parsed = footerSettingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const candidate = raw as Partial<FooterSettings>;
  const byId = new Map((Array.isArray(candidate.buttons) ? candidate.buttons : []).map((b) => [b.id, b]));
  const buttons = defaults.buttons.map((fallback) => {
    const found = byId.get(fallback.id);
    const check = buttonSchema.safeParse(found);
    return check.success ? check.data : fallback;
  });
  const pages = Object.fromEntries(
    footerButtonIds.map((id: FooterButtonId) => {
      const check = pageContentSchema.safeParse(candidate.pages?.[id]);
      return [id, check.success ? check.data : defaults.pages[id]];
    }),
  ) as FooterSettings['pages'];
  const attributionCheck = attributionSchema.safeParse(candidate.attribution);
  const extraLinks = Array.isArray(candidate.extraLinks)
    ? candidate.extraLinks.map((item) => extraLinkSchema.safeParse(item)).filter((r) => r.success).map((r) => r.data).slice(0, 20)
    : defaults.extraLinks;
  return {
    buttons,
    pages,
    attribution: attributionCheck.success ? attributionCheck.data : defaults.attribution,
    extraLinks,
  };
}

export async function createFooterSettings(db: AsyncDatabase, audit: ReturnType<typeof createAdminAudit>) {
  if (db.dialect !== 'postgres') {
    await db.exec('CREATE TABLE IF NOT EXISTS footer_settings (id INTEGER PRIMARY KEY CHECK(id=1), settings TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0))');
  }
  const available = async () => db.dialect !== 'postgres' || !!(await db.prepare("SELECT to_regclass('footer_settings') AS name").get())?.name;
  const select = db.prepare('SELECT settings, revision FROM footer_settings WHERE id=1');

  async function read(): Promise<FooterSnapshot> {
    if (!(await available())) return { settings: defaultFooterSettings(), revision: 0 };
    const row = (await select.get()) as { settings: string; revision: number } | undefined;
    if (!row) return { settings: defaultFooterSettings(), revision: 0 };
    try {
      return { settings: normalizeStored(JSON.parse(row.settings)), revision: Number(row.revision) };
    } catch {
      return { settings: defaultFooterSettings(), revision: Number(row.revision) };
    }
  }

  const update = db.transaction(async (actor: AdminActor, settings: FooterSettings, revision: number) => {
    const row = (await select.get()) as { settings: string; revision: number } | undefined;
    if (Number(row?.revision ?? 0) !== revision) return null;
    const nextRevision = revision + 1;
    await db.prepare(`INSERT INTO footer_settings(id, settings, revision) VALUES(1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET settings=excluded.settings, revision=excluded.revision`).run(
      JSON.stringify(settings),
      nextRevision,
    );
    await audit(actor, 'settings.footer.update', 'setting', 'footer', '页脚与页面设置', '更新了页脚按钮、页面 Markdown 内容或底部扩展链接');
    return { settings, revision: nextRevision };
  });

  return { read, available, update: update.immediate };
}

export function registerFooterAdminRoutes(app: FastifyInstance, store: Awaited<ReturnType<typeof createFooterSettings>>) {
  app.get('/footer', async (_request, reply) => {
    if (!(await store.available())) return reply.code(503).send({ error: '页脚设置数据表尚未初始化' });
    return store.read();
  });
  app.post('/footer', { bodyLimit: 512 * 1024 }, async (request, reply) => {
    if (!(await store.available())) return reply.code(503).send({ error: '页脚设置数据表尚未初始化' });
    const parsed = updateInputSchema.safeParse(request.body);
    if (!parsed.success) {
      const detail = parsed.error.issues[0]?.message || '页脚设置格式无效';
      return reply.code(400).send({ error: detail });
    }
    const saved = await store.update(request.admin, parsed.data.settings, parsed.data.revision);
    if (!saved) return reply.code(409).send({ error: '页脚设置已被其他人修改，请重新加载后再保存' });
    return saved;
  });
}

export function registerFooterPublicRoutes(app: FastifyInstance, store: Awaited<ReturnType<typeof createFooterSettings>>) {
  app.get('/api/site/footer', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { settings } = await store.read();
    return settings;
  });
}
