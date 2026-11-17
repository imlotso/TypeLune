import type { FastifyInstance } from 'fastify';
import { EnvHttpProxyAgent } from 'undici';
import { defaultBackground, type BackgroundConfig } from '../src/lib/background.js';
import { isWallpaperStyle, isWallhavenImageUrl, wallpaperStyles, wallpaperWorkTimeoutMs, type WallpaperStyle } from '../src/lib/wallpaper-policy.js';

const proxyAgent = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy ? new EnvHttpProxyAgent() : undefined;
const banned = /bikini|lingerie|swimwear|underwear|cleavage|nude|nudity|erotic|sexy|sensual|suggestive|see.through|wet clothing|bedroom|bondage|fetish/i;
export const wallpaperHeaders = { 'User-Agent': 'TypeLune-Wallpapers/1.0', Accept: 'application/json' };
export async function boundedFetch(url: string, max: number, allowedHost: string, signal?: AbortSignal) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== allowedHost || parsed.username || parsed.password || parsed.port) throw new Error('Invalid image destination');
  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch(url, { ...(proxyAgent ? { dispatcher: proxyAgent } : {}), headers: wallpaperHeaders, redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok || Number(response.headers.get('content-length') || 0) > max) { await response.body?.cancel(); throw new Error('Wallpaper provider unavailable'); }
  if (!response.body) throw new Error('Empty wallpaper response');
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = response.body.getReader();
  try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > max) throw new Error('Wallpaper too large'); chunks.push(next.value); } }
  finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
type Wallpaper = { id: string; purity: string; category: string; dimension_x: number; dimension_y: number; path: string; tags?: Array<{ name: string }> };
export function validWallpaper(value: unknown, kind: string, minimum = { width: 1920, height: 1080 }): value is Wallpaper {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<Wallpaper>;
  if (!isWallpaperStyle(kind) || typeof row.id !== 'string' || !/^[a-z0-9]{6}$/.test(row.id) || row.purity !== 'sfw' || row.category !== wallpaperStyles[kind].category ||
    typeof row.dimension_x !== 'number' || !Number.isFinite(row.dimension_x) || row.dimension_x < minimum.width || typeof row.dimension_y !== 'number' || !Number.isFinite(row.dimension_y) || row.dimension_y < minimum.height || typeof row.path !== 'string') return false;
  if (!isWallhavenImageUrl(row.path, row.id) || row.dimension_x > 12_000 || row.dimension_y > 12_000 || row.dimension_x * row.dimension_y > 40_000_000) return false;
  if (row.tags !== undefined && (!Array.isArray(row.tags) || row.tags.some(tag => !tag || typeof tag.name !== 'string'))) return false;
  const tags = row.tags ?? [];
  return !banned.test(tags.map(tag => tag.name).join(' ')) && (kind !== 'portrait' || tags.some(tag => /^(portraits?|faces?|headshots?|close[ -]?ups?|portrait photography)$/i.test(tag.name)));
}
export type WallpaperRequest = { kind: WallpaperStyle; display?: { width: number; height: number }; exclude?: string[]; id?: string; seed?: number };

/** Fetch metadata only: image bytes travel directly from Wallhaven to the browser. */
export async function fetchWallhavenBackground(options: WallpaperRequest, signal = AbortSignal.timeout(wallpaperWorkTimeoutMs)): Promise<BackgroundConfig> {
  const { kind, display, exclude = [], id } = options;
  const day = new Date().toISOString().slice(0, 10);
  const minimum = id ? { width: 1, height: 1 } : display;
  const readDetail = async (candidate: string) => {
    const row = JSON.parse((await boundedFetch('https://wallhaven.cc/api/v1/w/' + candidate, 200_000, 'wallhaven.cc', signal)).toString()).data;
    if (!validWallpaper(row, kind, minimum)) throw new Error('No suitable wallpaper');
    return { ...defaultBackground('dark', { image: row.path, name: 'Wallhaven ' + row.id, width: row.dimension_x, height: row.dimension_y }), daily: { id: row.id, day, kind, ...(display && { resolution: `${display.width}x${display.height}` }) } };
  };
  if (id) return readDetail(id);
  const style = wallpaperStyles[kind];
  const query = new URLSearchParams({ q: style.query, categories: style.categories, purity: '100', atleast: display ? `${display.width}x${display.height}` : '1920x1080', sorting: 'toplist', topRange: kind === 'portrait' ? '1y' : '1M' });
  if (!display) query.set('ratios', '16x9');
  const list = JSON.parse((await boundedFetch('https://wallhaven.cc/api/v1/search?' + query, 1_000_000, 'wallhaven.cc', signal)).toString());
  if (!Array.isArray(list.data)) throw new Error('Invalid listing');
  const pool = list.data.slice(0, 24); const offset = (options.seed ?? Number(day.replaceAll('-', ''))) % Math.max(1, pool.length);
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)].filter(item => /^[a-z0-9]{6}$/.test(item?.id) && item.id !== exclude[0]);
  const candidates = [...rotated.filter(item => !exclude.includes(item.id)), ...rotated.filter(item => exclude.includes(item.id))];
  for (const item of candidates) {
    signal.throwIfAborted();
    try { return await readDetail(item.id); } catch { signal.throwIfAborted(); }
  }
  throw new Error('No suitable wallpaper');
}
export function registerWallpapers(app: FastifyInstance) {
  const cache = new Map<string, BackgroundConfig>();
  const pending = new Map<string, Promise<BackgroundConfig>>();
  app.get('/api/wallpapers/daily', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { kind = 'nature', theme = 'dark', width, height, exclude, id } = request.query as Record<string, string>;
    if (!isWallpaperStyle(kind) || !['light', 'dark'].includes(theme) || (id !== undefined && !/^[a-z0-9]{6}$/.test(id))) return reply.code(400).send({ error: '壁纸选项无效' });
    const adaptive = width !== undefined || height !== undefined;
    const target = adaptive ? { width: Number(width), height: Number(height) } : { width: 2560, height: 1440 };
    if (adaptive && (!/^\d{3,4}$/.test(width ?? '') || !/^\d{3,4}$/.test(height ?? '') || !Number.isInteger(target.width) || !Number.isInteger(target.height) || target.width < 320 || target.height < 320 || target.width > 5120 || target.height > 5120 || target.width * target.height > 16_000_000)) return reply.code(400).send({ error: '壁纸尺寸无效' });
    if (exclude !== undefined && (typeof exclude !== 'string' || !/^[a-z0-9]{6}(?:,[a-z0-9]{6}){0,11}$/.test(exclude))) return reply.code(400).send({ error: '壁纸选项无效' });
    const excluded = exclude?.split(',') ?? [];
    const day = new Date().toISOString().slice(0, 10); const resolution = `${target.width}x${target.height}`;
    const key = [day, kind, adaptive ? resolution : 'fixed', exclude ?? 'daily', id ?? ''].join(':');
    try {
      if (!cache.has(key)) {
        if (!pending.has(key)) pending.set(key, fetchWallhavenBackground({ kind, display: adaptive ? target : undefined, exclude: excluded, id }).then(value => {
          if (cache.size >= 16) cache.delete(cache.keys().next().value!); cache.set(key, value); return value;
        }).finally(() => pending.delete(key)));
        await pending.get(key);
      }
      const value = cache.get(key)!;
      reply.header('Cache-Control', 'private, max-age=3600');
      return { background: { ...value, shade: theme === 'dark' ? 45 : 25 } };
    } catch { return reply.code(503).send({ error: '每日壁纸暂不可用，当前背景已保留' }); }
  });
}
