import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { EnvHttpProxyAgent } from 'undici';
import { defaultBackground, type BackgroundConfig } from '../src/lib/background.js';
import { wallpaperWorkTimeoutMs } from '../src/lib/wallpaper-policy.js';

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
export function validWallpaper(value: unknown, kind: string): value is Wallpaper {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<Wallpaper>;
  if (typeof row.id !== 'string' || !/^[a-z0-9]{6}$/.test(row.id) || row.purity !== 'sfw' || row.category !== (kind === 'nature' ? 'general' : 'people') ||
    typeof row.dimension_x !== 'number' || row.dimension_x < 1920 || typeof row.dimension_y !== 'number' || row.dimension_y < 1080 || typeof row.path !== 'string') return false;
  try { const url = new URL(row.path); if (url.protocol !== 'https:' || url.hostname !== 'w.wallhaven.cc' || url.username || url.password || url.port) return false; } catch { return false; }
  if (row.tags !== undefined && (!Array.isArray(row.tags) || row.tags.some(tag => !tag || typeof tag.name !== 'string'))) return false;
  const tags = row.tags ?? [];
  return !banned.test(tags.map(tag => tag.name).join(' ')) && (kind !== 'portrait' || tags.some(tag => /^(portraits?|faces?|headshots?|close[ -]?ups?|portrait photography)$/i.test(tag.name)));
}
async function prepareWallpaper(original: Buffer, signal: AbortSignal) {
  const image = sharp(original, { limitInputPixels: 40_000_000, failOn: 'warning' });
  const metadata = await image.metadata();
  if ((metadata.pages || 1) !== 1 || !['png', 'jpeg', 'webp'].includes(metadata.format || '')) throw new Error('Invalid wallpaper format');
  for (const [width, height, quality] of [[2560, 1440, 78], [2560, 1440, 64], [1920, 1080, 68]]) {
    signal.throwIfAborted();
    const result = await image.clone().rotate().resize({ width, height, fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer({ resolveWithObject: true });
    signal.throwIfAborted();
    if (result.data.length <= 768 * 1024) return result;
  }
  throw new Error('Wallpaper too large');
}
export function registerWallpapers(app: FastifyInstance) {
  const cache = new Map<string, BackgroundConfig>();
  const pending = new Map<string, Promise<BackgroundConfig>>();
  app.get('/api/wallpapers/daily', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { kind = 'nature', theme = 'dark' } = request.query as Record<string, string>;
    if (!['nature', 'portrait'].includes(kind) || !['light', 'dark'].includes(theme)) return reply.code(400).send({ error: '壁纸选项无效' });
    const day = new Date().toISOString().slice(0, 10); const key = day + ':' + kind;
    try {
      if (!cache.has(key)) {
        if (!pending.has(key)) pending.set(key, (async () => {
          const signal = AbortSignal.timeout(wallpaperWorkTimeoutMs);
          const query = new URLSearchParams({ q: kind === 'nature' ? 'nature landscape' : 'portrait', categories: kind === 'nature' ? '100' : '001', purity: '100', atleast: '1920x1080', ratios: '16x9', sorting: 'toplist', topRange: kind === 'nature' ? '1M' : '1y' });
          const list = JSON.parse((await boundedFetch('https://wallhaven.cc/api/v1/search?' + query, 1_000_000, 'wallhaven.cc', signal)).toString());
          if (!Array.isArray(list.data)) throw new Error('Invalid listing');
          const candidates = list.data.slice(0, 24); const offset = Number(day.replaceAll('-', '')) % Math.max(1, candidates.length);
          for (let index = 0; index < candidates.length; index++) {
            signal.throwIfAborted();
            const item = candidates[(index + offset) % candidates.length];
            if (!/^[a-z0-9]{6}$/.test(item?.id)) continue;
            try {
              const row = JSON.parse((await boundedFetch('https://wallhaven.cc/api/v1/w/' + item.id, 200_000, 'wallhaven.cc', signal)).toString()).data;
              if (!validWallpaper(row, kind)) continue;
              const original = await boundedFetch(row.path, 20_000_000, 'w.wallhaven.cc', signal);
              const { data, info } = await prepareWallpaper(original, signal);
              const value = { ...defaultBackground('dark', { image: 'data:image/webp;base64,' + data.toString('base64'), name: 'Wallhaven ' + row.id, width: info.width, height: info.height }), daily: { id: row.id, day, kind: kind as 'nature' | 'portrait' } };
              if (cache.size >= 4) cache.delete(cache.keys().next().value!); cache.set(key, value); return value;
            } catch { signal.throwIfAborted(); /* A broken candidate must not prevent trying the remaining safe images. */ }
          }
          throw new Error('No suitable wallpaper');
        })().finally(() => pending.delete(key)));
        await pending.get(key);
      }
      const value = cache.get(key)!;
      reply.header('Cache-Control', 'private, max-age=3600');
      return { background: { ...value, shade: theme === 'dark' ? 45 : 25 } };
    } catch { return reply.code(503).send({ error: '每日壁纸暂不可用，当前背景已保留' }); }
  });
}
