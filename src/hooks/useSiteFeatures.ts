import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type SiteFeatures = { registrationEnabled: boolean; guestPracticeEnabled: boolean; guestLeaderboardEnabled: boolean };
export const defaultSiteFeatures: SiteFeatures = { registrationEnabled: true, guestPracticeEnabled: true, guestLeaderboardEnabled: true };

const maxBackgroundRetries = 3;
const baseRetryDelayMs = 2000;
const maxRetryDelayMs = 16000;

export function useSiteFeatures() {
  const [features, setFeatures] = useState<SiteFeatures>(defaultSiteFeatures);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const load = () => {
      setError('');
      void api<SiteFeatures>('/api/site/features', { signal: controller.signal }).then((data) => {
        if (typeof data.registrationEnabled !== 'boolean' || typeof data.guestPracticeEnabled !== 'boolean' || typeof data.guestLeaderboardEnabled !== 'boolean') throw new Error('站点配置无法读取');
        if (!controller.signal.aborted) setFeatures({ registrationEnabled: data.registrationEnabled, guestPracticeEnabled: data.guestPracticeEnabled, guestLeaderboardEnabled: data.guestLeaderboardEnabled });
      }).catch((problem: unknown) => {
        if (controller.signal.aborted) return;
        setError(problem instanceof Error ? problem.message : '站点配置无法读取');
        if (attempt < maxBackgroundRetries) {
          const delay = Math.min(baseRetryDelayMs * 2 ** attempt, maxRetryDelayMs);
          attempt += 1;
          retryTimer = setTimeout(() => {
            if (!controller.signal.aborted) load();
          }, delay);
        }
      });
    };

    load();
    return () => {
      controller.abort();
      if (retryTimer !== undefined) clearTimeout(retryTimer);
    };
  }, [revision]);
  useEffect(() => { window.addEventListener('focus', retry); return () => window.removeEventListener('focus', retry); }, [retry]);
  return { features, error, retry };
}
