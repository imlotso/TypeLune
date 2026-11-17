import { api } from './api';
import { isBackgroundConfig, type BackgroundConfig, type BackgroundTheme } from './background';
import { wallpaperRequestTimeoutMs } from './wallpaper-policy';

export async function fetchDailyWallpaper(kind: 'nature' | 'portrait', theme: BackgroundTheme, signal?: AbortSignal): Promise<BackgroundConfig> {
  const result = await api<{ background: BackgroundConfig }>(`/api/wallpapers/daily?kind=${kind}&theme=${theme}`, { signal, timeoutMs: wallpaperRequestTimeoutMs });
  if (!isBackgroundConfig(result.background)) throw new Error('壁纸数据无效');
  return result.background;
}
