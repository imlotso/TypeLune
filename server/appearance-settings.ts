import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AsyncDatabase } from './database/types.js';
import type { AdminActor, createAdminAudit } from './admin.js';
import {
  defaultSiteAppearance,
  hexColorPattern,
  type SiteAppearanceSettings,
  type SiteAppearanceSnapshot,
} from '../src/lib/site-appearance.js';

const hexColor = z.string().trim().regex(hexColorPattern, '请输入 6 位十六进制颜色值，例如 #bfc3cb').transform((v) => v.toLowerCase());
const percent = z.number().int().min(0).max(100);
const blurPx = z.number().int().min(0).max(24);

const paletteSchema = z.strictObject({
  bgFrom: hexColor,
  bgVia: hexColor,
  bgTo: hexColor,
  workspaceBg: hexColor,
  panelBg: hexColor,
  accent: hexColor,
  text: hexColor,
  muted: hexColor,
});

const surfaceSchema = z.strictObject({
  headerOpacity: percent,
  workspaceOpacity: percent,
  panelOpacity: percent,
  panelBlur: blurPx,
  borderOpacity: percent,
});

const themeAppearanceSchema = z.strictObject({
  palette: paletteSchema,
  surface: surfaceSchema,
});

const appearanceSettingsSchema = z.strictObject({
  light: themeAppearanceSchema,
  dark: themeAppearanceSchema,
});

const updateInputSchema = z.strictObject({
  settings: appearanceSettingsSchema,
  revision: z.number().int().nonnegative(),
});

function normalizeStored(raw: unknown): SiteAppearanceSettings {
  const defaults = defaultSiteAppearance();
  const parsed = appearanceSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaults;
}

export async function createAppearanceSettings(db: AsyncDatabase, audit: ReturnType<typeof createAdminAudit>) {
  if (db.dialect !== 'postgres') {
    await db.exec('CREATE TABLE IF NOT EXISTS appearance_settings (id INTEGER PRIMARY KEY CHECK(id=1), settings TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0))');
  }
  const available = async () => db.dialect !== 'postgres' || !!(await db.prepare("SELECT to_regclass('appearance_settings') AS name").get())?.name;
  const select = db.prepare('SELECT settings, revision FROM appearance_settings WHERE id=1');

  async function read(): Promise<SiteAppearanceSnapshot> {
    if (!(await available())) return { settings: defaultSiteAppearance(), revision: 0 };
    const row = (await select.get()) as { settings: string; revision: number } | undefined;
    if (!row) return { settings: defaultSiteAppearance(), revision: 0 };
    try {
      return { settings: normalizeStored(JSON.parse(row.settings)), revision: Number(row.revision) };
    } catch {
      return { settings: defaultSiteAppearance(), revision: Number(row.revision) };
    }
  }

  const update = db.transaction(async (actor: AdminActor, settings: SiteAppearanceSettings, revision: number) => {
    const row = (await select.get()) as { settings: string; revision: number } | undefined;
    if (Number(row?.revision ?? 0) !== revision) return null;
    const nextRevision = revision + 1;
    await db.prepare(`INSERT INTO appearance_settings(id, settings, revision) VALUES(1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET settings=excluded.settings, revision=excluded.revision`).run(
      JSON.stringify(settings),
      nextRevision,
    );
    await audit(actor, 'settings.appearance.update', 'setting', 'appearance', '全站外观与配色', '更新了全站默认日夜间配色与透明度设置');
    return { settings, revision: nextRevision };
  });

  return { read, available, update: update.immediate };
}

export function registerAppearanceAdminRoutes(app: FastifyInstance, store: Awaited<ReturnType<typeof createAppearanceSettings>>) {
  app.get('/appearance', async (_request, reply) => {
    if (!(await store.available())) return reply.code(503).send({ error: '外观设置数据表尚未初始化' });
    return store.read();
  });
  app.post('/appearance', async (request, reply) => {
    if (!(await store.available())) return reply.code(503).send({ error: '外观设置数据表尚未初始化' });
    const parsed = updateInputSchema.safeParse(request.body);
    if (!parsed.success) {
      const detail = parsed.error.issues[0]?.message || '外观设置格式无效';
      return reply.code(400).send({ error: detail });
    }
    const saved = await store.update(request.admin, parsed.data.settings, parsed.data.revision);
    if (!saved) return reply.code(409).send({ error: '外观设置已被其他人修改，请重新加载后再保存' });
    return saved;
  });
}

export function registerAppearancePublicRoutes(app: FastifyInstance, store: Awaited<ReturnType<typeof createAppearanceSettings>>) {
  app.get('/api/site/appearance', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { settings } = await store.read();
    return settings;
  });
}
