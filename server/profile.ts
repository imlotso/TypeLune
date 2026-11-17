import sharp from 'sharp';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AsyncDatabase } from './database/types.js';
import type { AccountUser } from './account.js';
import { isBackgroundConfig,type BackgroundConfig } from '../src/lib/background.js';

export function profileValue(raw?: string | null): { avatar: string | null; profilePublic: boolean } {
  if (!raw || ['cloud', 'star', 'moon'].includes(raw)) return { avatar: raw || null, profilePublic: true };
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || typeof value.profilePublic !== 'boolean') return { avatar: null, profilePublic: false };
    return { avatar: typeof value.avatar === 'string' ? value.avatar : null, profilePublic: value.profilePublic };
  } catch { return { avatar: null, profilePublic: false }; }
}
export async function normalizeAvatar(value: unknown): Promise<string | null> {
  if (value === null || value === 'cloud' || value === 'star' || value === 'moon') return value;
  if (typeof value !== 'string' || value.length > 700_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('头像图片无效');
  const input = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
  const image = sharp(input, { limitInputPixels: 16_000_000, failOn: 'warning' });
  const metadata = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages ?? 1) !== 1) throw new Error('头像图片无效');
  const buffer = await image.rotate().resize(192, 192, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
  if (buffer.length > 80_000) throw new Error('头像图片过大');
  return 'data:image/webp;base64,' + buffer.toString('base64');
}
export function registerPublicProfiles(app: FastifyInstance, db: AsyncDatabase, userFor: (request: FastifyRequest) => Promise<AccountUser | undefined>,globalBackground?:()=>Promise<BackgroundConfig|null|undefined>) {
  app.get('/api/profiles/:id', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { id } = request.params as { id: string };
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) return reply.code(404).send({ error: '用户资料不可查看' });
    return db.transaction(async () => {
      const user = await db.prepare('SELECT id,username,display_name,avatar,created_at FROM users WHERE id=? AND disabled_at IS NULL').get(id) as (AccountUser & { created_at: number }) | undefined;
      const viewer = await userFor(request);
      if (!user || (!profileValue(user.avatar).profilePublic && viewer?.id !== id)) return reply.code(404).send({ error: '用户资料不可查看' });
      // Aggregate only completed server-side practice; never return drafts, text, mistakes, email, or sessions.
      const stats = await db.prepare(`SELECT language, COUNT(*) AS rounds, COALESCE(SUM(elapsed_ms),0) AS elapsedMs,
        MAX(speed) AS bestSpeed, AVG(accuracy) AS accuracy FROM challenges WHERE owner=? AND status='finished'
        AND finished_at IS NOT NULL GROUP BY language`).all('u:' + id);
      const rows = await db.prepare("SELECT item_id,value FROM workspace_items WHERE user_id=? AND kind='background' AND value IS NOT NULL").all(id) as { item_id: string; value: string }[];
      const backgrounds: Record<string, unknown> = {};
      for (const row of rows) { try { const value = JSON.parse(row.value); if (['light', 'dark'].includes(row.item_id) && isBackgroundConfig(value)) backgrounds[row.item_id] = { ...value, name: 'Wallpaper' }; } catch { /* Invalid legacy items are omitted. */ } }
      if(globalBackground){
        const prefs=await db.prepare("SELECT value FROM workspace_items WHERE user_id=? AND kind='settings' AND item_id='preferences'").get(id);
        let settings:{wallpaperFollowSite?:{light?:boolean;dark?:boolean}}={};try{settings=JSON.parse(prefs?.value??'{}');}catch{}
        const global=await globalBackground();for(const mode of ['light','dark'] as const)if(settings.wallpaperFollowSite?.[mode]!==false){if(global)backgrounds[mode]={...global,name:'Wallpaper',shade:mode==='dark'?45:25};else delete backgrounds[mode];}
      }
      return { id: user.id, displayName: user.display_name || user.username, ...profileValue(user.avatar), joinedAt: user.created_at, stats, backgrounds };
    }).immediate();
  });
}
