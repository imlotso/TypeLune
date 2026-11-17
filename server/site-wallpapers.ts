import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AsyncDatabase } from './database/types.js';
import type { AdminActor, createAdminAudit } from './admin.js';
import { fetchWallhavenBackground } from './wallpapers.js';
import { wallpaperSchema } from './wallpaper-schema.js';
import { isBackgroundConfig, type BackgroundConfig } from '../src/lib/background.js';
import { siteWallpaperIntervalMs, wallpaperStyleNames } from '../src/lib/wallpaper-policy.js';

const schema = z.strictObject({ enabled: z.boolean(), styles: z.array(z.enum(wallpaperStyleNames)).min(1).max(wallpaperStyleNames.length).refine(values => new Set(values).size === values.length) });
export type SiteWallpaperSettings = z.infer<typeof schema>;
export type SiteWallpaperSnapshot = { settings: SiteWallpaperSettings; revision: number; background: BackgroundConfig | null; updatedAt: number | null; nextChangeAt: number | null };
const defaults: SiteWallpaperSettings = { enabled: false, styles: ['nature'] };
const input = z.strictObject({ settings: schema, revision: z.number().int().nonnegative() });
type State = { config_revision: number; slot: number; background: string | null; token: string | null; lease_until: number; retry_at: number; updated_at: number };

export async function createSiteWallpapers(db: AsyncDatabase, audit: ReturnType<typeof createAdminAudit>, now: () => number = Date.now, provider = fetchWallhavenBackground) {
  if (db.dialect === 'sqlite') await db.exec(wallpaperSchema);
  const available = async () => db.dialect === 'sqlite' || !!(await db.prepare("SELECT to_regclass('wallpaper_settings') AS name").get())?.name;
  const readConfig = async () => {
    if (!await available()) return { settings: { ...defaults }, revision: 0 };
    const row = await db.prepare('SELECT settings,revision FROM wallpaper_settings WHERE id=1').get();
    return row ? { settings: schema.parse(JSON.parse(row.settings)), revision: row.revision as number } : { settings: { ...defaults }, revision: 0 };
  };
  const state = async () => await db.prepare('SELECT config_revision,slot,background,token,lease_until,retry_at,updated_at FROM wallpaper_rotation WHERE id=1').get() as State | undefined;
  const background = (value: State | undefined) => { try { const item = JSON.parse(value?.background ?? 'null'); return isBackgroundConfig(item) ? item : null; } catch { return null; } };
  const read = async (): Promise<SiteWallpaperSnapshot> => {
    const config = await readConfig(); const current = await available() ? await state() : undefined;
    return { ...config, background: background(current), updatedAt: current?.updated_at || null, nextChangeAt: config.settings.enabled ? (Math.floor(now() / siteWallpaperIntervalMs) + 1) * siteWallpaperIntervalMs : null };
  };
  const update = db.transaction(async (actor: AdminActor, settings: SiteWallpaperSettings, revision: number) => {
    const old = await readConfig(); if (old.revision !== revision) return null;
    if (JSON.stringify(old.settings) === JSON.stringify(settings)) return read();
    await db.prepare('INSERT INTO wallpaper_settings(id,settings,revision) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET settings=excluded.settings,revision=excluded.revision').run(JSON.stringify(settings), revision + 1);
    // Invalidate a previous refresh without removing the last working URL.
    await db.prepare('UPDATE wallpaper_rotation SET token=NULL,lease_until=0,retry_at=0 WHERE id=1').run();
    if(!settings.enabled)await db.prepare('UPDATE wallpaper_rotation SET background=NULL,slot=-1,updated_at=0 WHERE id=1').run();
    await audit(actor, 'settings.wallpaper.update', 'setting', 'wallpaper', '全站壁纸', '更新轮换开关或壁纸风格');
    return read();
  });
  const claim = db.transaction(async (force: boolean) => {
    const config = await readConfig(); const current = await state(); const slot = Math.floor(now() / siteWallpaperIntervalMs);
    if (!config.settings.enabled) return { config, current };
    if (!force && current?.config_revision === config.revision && Number(current.slot) === slot && background(current)) return { config, current };
    if (Number(current?.lease_until ?? 0) > now() || (!force && Number(current?.retry_at ?? 0) > now())) return { config, current };
    const token = randomUUID();
    await db.prepare('INSERT INTO wallpaper_rotation(id,config_revision,slot,token,lease_until,retry_at) VALUES(1,?,-1,?,?,0) ON CONFLICT(id) DO UPDATE SET token=excluded.token,lease_until=excluded.lease_until,retry_at=0').run(config.revision, token, now() + 45_000);
    return { config, current, token, slot };
  });
  const refresh = async (force = false): Promise<SiteWallpaperSnapshot> => {
    if (!await available()) return read();
    const work = await claim.immediate(force);
    if (!work.token) return read();
    const previous = background(work.current);
    const style = work.config.settings.styles[work.slot! % work.config.settings.styles.length];
    try {
      const next = await provider({ kind: style, display: { width: 3840, height: 2160 }, exclude: previous?.daily ? [previous.daily.id] : [], seed: work.slot });
      await db.transaction(async () => {
        const config = await readConfig(); const current = await state();
        if (config.revision !== work.config.revision || current?.token !== work.token || Math.floor(now()/siteWallpaperIntervalMs) !== work.slot) return;
        await db.prepare('UPDATE wallpaper_rotation SET config_revision=?,slot=?,background=?,token=NULL,lease_until=0,retry_at=0,updated_at=? WHERE id=1').run(config.revision, work.slot, JSON.stringify(next), now());
      }).immediate();
    } catch {
      await db.prepare('UPDATE wallpaper_rotation SET token=NULL,lease_until=0,retry_at=? WHERE id=1 AND token=?').run(now()+60_000, work.token);
    }
    return read();
  };
  return { read, available, update: update.immediate, refresh, now };
}

export function registerSiteWallpaperAdmin(app: FastifyInstance, store: Awaited<ReturnType<typeof createSiteWallpapers>>) {
  app.get('/wallpaper', async (_request, reply) => { if (!await store.available()) return reply.code(503).send({ error: '全站壁纸存储尚未安装' }); return store.read(); });
  app.post('/wallpaper', async (request, reply) => {
    if (!await store.available()) return reply.code(503).send({ error: '全站壁纸存储尚未安装' });
    const parsed = input.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: '全站壁纸设置无效' });
    const saved = await store.update(request.admin, parsed.data.settings, parsed.data.revision);
    if (!saved) return reply.code(409).send({ error: '设置已更新，请重新加载' }); return saved;
  });
  app.post('/wallpaper/refresh', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (_request, reply) => {
    if (!await store.available()) return reply.code(503).send({ error: '全站壁纸存储尚未安装' }); return store.refresh(true);
  });
}

export function registerSiteWallpaperPublic(app: FastifyInstance, store: Awaited<ReturnType<typeof createSiteWallpapers>>) {
  app.get('/api/site/wallpaper', { config: { rateLimit: { max: 90, timeWindow: '1 minute' } } }, async (request, reply) => {
    const theme = (request.query as { theme?: string }).theme ?? 'light'; if (!['light','dark'].includes(theme)) return reply.code(400).send({ error: '壁纸选项无效' });
    reply.header('Cache-Control','no-store'); const snapshot = await store.refresh();
    return { enabled: snapshot.settings.enabled, revision: snapshot.revision, nextChangeAt: snapshot.nextChangeAt, serverTime:store.now(), retryAfterMs: snapshot.settings.enabled && !snapshot.background ? 5000 : 60_000,
      background: snapshot.settings.enabled && snapshot.background ? { ...snapshot.background, shade: theme==='dark'?45:25 } : null };
  });
}
