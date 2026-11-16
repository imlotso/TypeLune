import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { EnvHttpProxyAgent } from 'undici';
const proxyAgent = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy ? new EnvHttpProxyAgent() : undefined;
import { defaultBackground, type BackgroundConfig } from '../src/lib/background.js';

const banned = /bikini|lingerie|swimwear|underwear|cleavage|nude|nudity|erotic|sexy|sensual|suggestive|see.through|wet clothing|bedroom|bondage|fetish/i;
export const wallpaperHeaders = { 'User-Agent': 'TypeLune-Wallpapers/1.0', Accept: 'application/json' };
export async function boundedFetch(url: string, max: number, allowedHost: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== allowedHost || parsed.username || parsed.password || parsed.port) throw new Error('Invalid image destination');
  const response = await fetch(url, { ...(proxyAgent ? { dispatcher: proxyAgent } : {}), headers: wallpaperHeaders, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok || Number(response.headers.get('content-length') || 0) > max) throw new Error('Wallpaper provider unavailable');
  const chunks: Uint8Array[] = []; let size = 0;
  if (!response.body) throw new Error('Empty wallpaper response');
  const reader = response.body.getReader();
  try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > max) throw new Error('Wallpaper too large'); chunks.push(next.value); } }
  finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
export function validWallpaper(row: any, kind: string) {
  return row && /^[a-z0-9]{6}$/.test(row.id) && row.purity === 'sfw' && row.category === (kind === 'nature' ? 'general' : 'people') &&
    row.dimension_x >= 1920 && row.dimension_y >= 1080 && typeof row.path === 'string' &&
    new URL(row.path).hostname === 'w.wallhaven.cc' && (!banned.test((row.tags || []).map((tag: { name?: string }) => tag.name || '').join(' '))) &&
    (kind !== 'portrait' || (Array.isArray(row.tags) && row.tags.some((tag: any) => /^(portrait|face|headshot|closeup)$/i.test(tag.name))));
}
export function registerWallpapers(app: FastifyInstance) {
  const cache = new Map<string, BackgroundConfig>();
  const pending = new Map<string, Promise<BackgroundConfig>>();
  const failedAt = new Map<string, number>();
  app.get('/api/wallpapers/daily', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { kind = 'nature', theme = 'dark' } = request.query as Record<string, string>;
    if (!['nature', 'portrait'].includes(kind) || !['light', 'dark'].includes(theme)) return reply.code(400).send({ error: '壁纸选项无效' });
    const day = new Date().toISOString().slice(0, 10); const key = day + ':' + kind;
    try {
      if (Date.now() - (failedAt.get(key) ?? 0) < 60_000) throw new Error('Provider cooling down');
      if (!cache.has(key)) {
        if (!pending.has(key)) pending.set(key, (async () => {
          const deadline = Date.now() + 40_000;
          const query = new URLSearchParams({ q: kind === 'nature' ? 'nature landscape' : 'portrait', categories: kind === 'nature' ? '100' : '001', purity: '100', atleast: '1920x1080', ratios: '16x9', sorting: 'toplist', topRange: kind === 'nature' ? '1M' : '1y' });
          const list = JSON.parse((await boundedFetch('https://wallhaven.cc/api/v1/search?' + query, 1_000_000, 'wallhaven.cc')).toString());
          if (!Array.isArray(list.data)) throw new Error('Invalid listing');
          // Day rotation is stable across requests and only downloads one accepted image.
          const candidates = list.data.slice(0, 24); const offset = Number(day.replaceAll('-', '')) % Math.max(1, candidates.length);
          for (let i = 0; i < Math.min(candidates.length, 4); i++) {
            if (Date.now() > deadline) break;
            const item = candidates[(i + offset) % candidates.length];
            if (!/^[a-z0-9]{6}$/.test(item?.id)) continue;
            const row = JSON.parse((await boundedFetch('https://wallhaven.cc/api/v1/w/' + item.id, 200_000, 'wallhaven.cc')).toString()).data;
            if (!validWallpaper(row, kind)) continue;
            if (Date.now() > deadline) throw new Error('Wallpaper deadline exceeded');
            const original = await boundedFetch(row.path, 20_000_000, 'w.wallhaven.cc');
            const image = sharp(original, { limitInputPixels: 40_000_000, failOn: 'warning' });
            const metadata = await image.metadata(); if ((metadata.pages || 1) !== 1 || !['png','jpeg','webp'].includes(metadata.format || '')) continue;
            const { data, info } = await image.rotate().resize({ width: 2560, height: 1440, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
            if (data.length > 768 * 1024) continue;
            const value = { ...defaultBackground('dark', { image: 'data:image/webp;base64,' + data.toString('base64'), name: 'Wallhaven ' + row.id, width: info.width, height: info.height }), daily: { id: row.id, day, kind: kind as 'nature' | 'portrait' } };
            if(cache.size>=4)cache.delete(cache.keys().next().value!); cache.set(key, value); return value;
          }
          throw new Error('No suitable wallpaper');
        })().finally(() => pending.delete(key)));
        await pending.get(key);
      }
      const value = cache.get(key)!;
      reply.header('Cache-Control', 'private, max-age=3600');
      return { background: { ...value, shade: theme === 'dark' ? 45 : 25 } };
    } catch { if(!failedAt.has(key) || Date.now()-failedAt.get(key)!>=60_000)failedAt.set(key, Date.now()); if(failedAt.size>4)failedAt.delete(failedAt.keys().next().value!); return reply.code(503).send({ error: '每日壁纸暂不可用，当前背景已保留' }); }
  });
}
