import { api } from './api';
import { isBackgroundConfig, type BackgroundConfig, type BackgroundTheme } from './background';
import { wallpaperRequestTimeoutMs, type WallpaperStyle } from './wallpaper-policy';

export type WallpaperDisplay = { width: number; height: number };

export function wallpaperDisplay(): WallpaperDisplay {
  const ratio = Math.min(4, Math.max(1, window.devicePixelRatio || 1));
  const width = Math.max(320, (window.screen.width || window.innerWidth || 1920) * ratio);
  const height = Math.max(320, (window.screen.height || window.innerHeight || 1080) * ratio);
  const scale = Math.min(1, 5120 / Math.max(width, height), Math.sqrt(16_000_000 / (width * height)));
  return { width: Math.max(320, Math.floor(width * scale)), height: Math.max(320, Math.floor(height * scale)) };
}

export async function fetchDailyWallpaper(kind: WallpaperStyle, theme: BackgroundTheme, signal?: AbortSignal, options?: { display?: WallpaperDisplay; exclude?: string[]; id?: string }): Promise<BackgroundConfig> {
  const query = new URLSearchParams({ kind, theme });
  if (options?.display) { query.set('width', String(options.display.width)); query.set('height', String(options.display.height)); }
  if (options?.exclude?.length) query.set('exclude', [...new Set(options.exclude)].slice(0, 12).join(','));
  if (options?.id) query.set('id', options.id);
  const result = await api<{ background: BackgroundConfig }>('/api/wallpapers/daily?' + query, { signal, timeoutMs: wallpaperRequestTimeoutMs });
  if (!isBackgroundConfig(result.background)) throw new Error('壁纸数据无效');
  return result.background;
}
