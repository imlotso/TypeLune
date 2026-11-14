export const mainPaths = {
  practice: '/', library: '/library', rankings: '/rankings', history: '/records', drafts: '/drafts', mistakes: '/mistakes', stats: '/stats',
  feedback: '/feedback', data: '/account/data', help: '/help', about: '/about', privacy: '/privacy', terms: '/terms',
} as const;
export type MainView = keyof typeof mainPaths;
export type MainRoute = MainView | 'article' | 'notfound';
export const pathForView = (view: MainView) => mainPaths[view];
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
  const path = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return (Object.entries(mainPaths).find(([, value]) => value === path)?.[0] as MainView | undefined) ?? 'notfound';
}

const navigationIndexKey = '__typingNavigationIndex';
export function navigationIndex(state: unknown): number | undefined {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return undefined;
  const value = (state as Record<string, unknown>)[navigationIndexKey];
  return Number.isSafeInteger(value) ? value as number : undefined;
}
export function navigationState(state: unknown, index: number) {
  return { ...(state && typeof state === 'object' && !Array.isArray(state) ? state : {}), [navigationIndexKey]: index };
}
