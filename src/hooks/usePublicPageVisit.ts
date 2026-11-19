import { useEffect, useRef } from 'react';
import { trackedPages } from '../lib/admin-overview';
import { mainRoute, type MainRoute } from '../lib/routes';

export function usePublicPageVisit(pathname: string, enabled: boolean) {
  const previousPath = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled || previousPath.current === pathname) return;
    previousPath.current = pathname;
    const view = mainRoute(pathname);
    if (!(trackedPages as readonly MainRoute[]).includes(view)) return;

    const browser = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (browser.globalPrivacyControl || browser.doNotTrack === '1' || browser.doNotTrack === 'yes') return;

    void fetch('/api/site/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
      body: JSON.stringify({ page: view }),
    }).catch(() => {});
  }, [enabled, pathname]);
}
