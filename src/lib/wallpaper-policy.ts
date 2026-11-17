// Leave time for function startup and transferring the bounded image response.
export const wallpaperWorkTimeoutMs = 40_000;
export const wallpaperRequestTimeoutMs = 55_000;

export const wallpaperStyles = {
  nature: { zh: '自然风景', en: 'Landscapes', query: 'nature landscape', categories: '100', category: 'general' },
  mountains: { zh: '山川雪峰', en: 'Mountains', query: 'mountains', categories: '100', category: 'general' },
  forest: { zh: '森林绿意', en: 'Forests', query: 'forest', categories: '100', category: 'general' },
  ocean: { zh: '海洋湖泊', en: 'Water and coast', query: 'ocean lake', categories: '100', category: 'general' },
  city: { zh: '城市建筑', en: 'Architecture', query: 'city architecture', categories: '100', category: 'general' },
  space: { zh: '星空宇宙', en: 'Space', query: 'space galaxy', categories: '100', category: 'general' },
  anime: { zh: '动漫风景', en: 'Anime scenery', query: 'scenery', categories: '010', category: 'anime' },
  portrait: { zh: '清新人像', en: 'Portraits', query: 'portrait', categories: '001', category: 'people' },
} as const;
export type WallpaperStyle = keyof typeof wallpaperStyles;
export const wallpaperStyleNames = Object.keys(wallpaperStyles) as WallpaperStyle[];
export const isWallpaperStyle = (value: unknown): value is WallpaperStyle => typeof value === 'string' && Object.hasOwn(wallpaperStyles, value);

export function isWallhavenImageUrl(value: unknown, id?: string): value is string {
  if (typeof value !== 'string' || value.length > 240) return false;
  try {
    const url = new URL(value);
    const match = /^\/full\/([a-z0-9]{2})\/wallhaven-([a-z0-9]{6})\.(?:jpg|jpeg|png|webp)$/.exec(url.pathname);
    return url.protocol === 'https:' && url.hostname === 'w.wallhaven.cc' && !url.username && !url.password && !url.port && !url.search && !url.hash && !!match && match[2].startsWith(match[1]) && (!id || match[2] === id);
  } catch { return false; }
}

export const siteWallpaperIntervalMs = 12 * 60 * 60_000;

export const wallpaperWidths = [640,1280,1920,2560,3840,5120] as const;
