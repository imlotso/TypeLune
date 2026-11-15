import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type SiteFeatures = { registrationEnabled: boolean; guestPracticeEnabled: boolean; guestLeaderboardEnabled: boolean };
export function useSiteFeatures() {
  const [features, setFeatures] = useState<SiteFeatures>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void api<SiteFeatures>('/api/site/features', { signal: controller.signal }).then((data) => {
      if (typeof data.registrationEnabled !== 'boolean' || typeof data.guestPracticeEnabled !== 'boolean' || typeof data.guestLeaderboardEnabled !== 'boolean') throw new Error('站点配置无法读取');
      if (!controller.signal.aborted) setFeatures({ registrationEnabled: data.registrationEnabled, guestPracticeEnabled: data.guestPracticeEnabled, guestLeaderboardEnabled: data.guestLeaderboardEnabled });
    }).catch((problem: unknown) => { if (!controller.signal.aborted) { setFeatures(undefined); setError(problem instanceof Error ? problem.message : '站点配置无法读取'); } });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => { window.addEventListener('focus', retry); return () => window.removeEventListener('focus', retry); }, [retry]);
  return { features, error, retry };
}
