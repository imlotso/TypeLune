export const mainPaths = {
  practice: '/', lessons: '/lessons', library: '/library', rankings: '/rankings', history: '/records', drafts: '/drafts', mistakes: '/mistakes', stats: '/stats',
  feedback: '/feedback', account: '/account', data: '/account/data', help: '/help', about: '/about', privacy: '/privacy', terms: '/terms',
} as const;
export type MainView = keyof typeof mainPaths;
export type MainRoute = MainView | 'article' | 'notfound';
export const pathForView = (view: MainView) => mainPaths[view];
export const pathForFeedback = (id: string) => `/feedback/${encodeURIComponent(id)}`;
export function feedbackIdFromPath(pathname: string): string | undefined {
  const match = /^\/feedback\/([^/]+)\/?$/u.exec(pathname);
  if (!match) return undefined;
  try {
    const id = decodeURIComponent(match[1]);
    return id && id.length <= 200 && !/[\p{Cc}\p{Cf}]/u.test(id) ? id : undefined;
  } catch { return undefined; }
}
export const pathForRecord = (id: string) => `/records/${encodeURIComponent(id)}`;
export function recordIdFromPath(pathname: string): string | undefined {
  const match = /^\/records\/([^/]+)\/?$/u.exec(pathname);
  if (!match) return undefined;
  try {
    const id = decodeURIComponent(match[1]);
    return id && id.length <= 200 && !/[\p{Cc}\p{Cf}]/u.test(id) ? id : undefined;
  } catch { return undefined; }
}
export const pathForArticle = (id: string) => `/articles/${encodeURIComponent(id)}`;
export function articleIdFromPath(pathname: string): string | undefined {
  const match = /^\/articles\/([^/]+)\/?$/u.exec(pathname);
  if (!match) return undefined;
  try {
    const id = decodeURIComponent(match[1]);
    return id && id.length <= 200 && !/[\p{Cc}\p{Cf}]/u.test(id) ? id : undefined;
  } catch { return undefined; }
}
export function mainRoute(pathname: string): MainRoute {
  if (articleIdFromPath(pathname)) return 'article';
  if (recordIdFromPath(pathname)) return 'history';
  if (feedbackIdFromPath(pathname)) return 'feedback';
  const path = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return (Object.entries(mainPaths).find(([, value]) => value === path)?.[0] as MainView | undefined) ?? 'notfound';
}

const navigationIndexKey = '__typingNavigationIndex';
export function navigationEntryIndex(source: unknown = typeof window === 'undefined' ? undefined : (window as Window & { navigation?: unknown }).navigation): number | undefined {
  if (!source || typeof source !== 'object' || !('currentEntry' in source)) return undefined;
  const entry = source.currentEntry;
  if (!entry || typeof entry !== 'object' || !('index' in entry)) return undefined;
  return Number.isSafeInteger(entry.index) && (entry.index as number) >= 0 ? entry.index as number : undefined;
}
export function navigationIndex(state: unknown): number | undefined {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return undefined;
  const value = (state as Record<string, unknown>)[navigationIndexKey];
  return Number.isSafeInteger(value) ? value as number : undefined;
}
export function navigationState(state: unknown, index: number) {
  return { ...(state && typeof state === 'object' && !Array.isArray(state) ? state : {}), [navigationIndexKey]: index };
}
