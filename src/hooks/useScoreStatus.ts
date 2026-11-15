import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { isServerScoreStatus, type ServerScoreStatus } from '../lib/score-status';

type View = { key: string; status?: ServerScoreStatus; loading: boolean; error: string };
export function useScoreStatus(attemptId: string | undefined, ownerId: string | null, enabled: boolean, revision: number) {
  const [retryCount, setRetryCount] = useState(0);
  const activation = useRef({ active: false, epoch: 0 });
  const active = !!(enabled && attemptId);
  if (active && !activation.current.active) activation.current.epoch++;
  activation.current.active = active;
  const key = active ? `${ownerId ?? 'guest'}:${attemptId}:${revision}:${retryCount}:${activation.current.epoch}` : '';
  const [view, setView] = useState<View>({ key: '', loading: false, error: '' });
  useEffect(() => {
    if (!key || !attemptId) return;
    const controller = new AbortController();
    setView({ key, loading: true, error: '' });
    api<unknown>(`/api/tests/${encodeURIComponent(attemptId)}/score-status`, { headers: { 'X-Workspace-Owner': ownerId ?? 'guest' }, signal: controller.signal })
      .then((value) => {
        if (!isServerScoreStatus(value)) throw new Error('成绩状态无法读取');
        if (!controller.signal.aborted) setView({ key, status: value, loading: false, error: '' });
      }).catch((problem: unknown) => { if (!controller.signal.aborted) setView({ key, loading: false, error: problem instanceof Error ? problem.message : '成绩状态无法读取' }); });
    return () => controller.abort();
  }, [attemptId, ownerId, key, revision, retryCount]);
  const current = view.key === key && key ? view : { key, loading: !!key, error: '' };
  return { status: current.status, loading: current.loading, error: current.error, retry: () => setRetryCount((count) => count + 1) };
}
