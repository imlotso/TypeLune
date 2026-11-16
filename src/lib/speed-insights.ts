/** Only Vercel production builds collect; Docker, local and Preview builds stay silent. */
export function shouldCollectSpeedInsights(vercel: string | undefined, environment: string | undefined): boolean {
  return vercel === '1' && environment === 'production';
}

/** TypeLune is a single-page UI: only report its public root, never private routes or URL data. */
export function filterSpeedInsight<T extends { url: string }>(event: T): T | null {
  try {
    const url = new URL(event.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/') return null;
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
