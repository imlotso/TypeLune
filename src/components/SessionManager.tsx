import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';

type Session = { id: string; device: string; createdAt: number | null; lastActiveAt: number | null; current: boolean };
type Props = { ownerId: string; busy: boolean; setBusy: (busy: boolean) => void; onSignedOut: (message: string) => void };
const date = (value: number | null) => value == null ? '未知' : new Date(value).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

export function SessionManager({ ownerId, busy, setBusy, onSignedOut }: Props) {
  const [sessions, setSessions] = useState<Session[]>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const timer = setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    setError(''); setSessions(undefined);
    api<{ sessions: Session[] }>('/api/account/sessions', { headers: { 'X-Workspace-Owner': ownerId }, signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setSessions(data.sessions); })
      .catch((problem: unknown) => {
        if (controller.signal.aborted) return;
        if (problem instanceof ApiError && problem.status === 401) onSignedOut('登录状态已失效，请重新登录');
        else { setSessions(undefined); setError(problem instanceof Error ? problem.message : '加载失败'); }
      });
    return () => controller.abort();
  }, [ownerId, revision, busy]);
  async function revoke(id?: string) {
    setBusy(true); setError('');
    try {
      if (id) {
        const result = await api<{ current: boolean }>('/api/account/sessions/revoke', { method: 'POST', headers: { 'X-Workspace-Owner': ownerId }, body: { id } });
        if (result.current) { onSignedOut('已退出当前设备'); return; }
        setSessions((current) => current?.filter((session) => session.id !== id));
      } else {
        await api('/api/account/sessions/revoke-others', { method: 'POST', headers: { 'X-Workspace-Owner': ownerId }, body: {} });
        setSessions((current) => current?.filter((session) => session.current));
      }
    } catch (problem) {
      if (problem instanceof ApiError && problem.status === 401) onSignedOut('登录状态已失效，请重新登录');
      else setError(problem instanceof Error ? problem.message : '操作失败');
    } finally { setBusy(false); }
  }
  return <div className="account-sessions">
    {!sessions && !error && <p role="status">加载中…</p>}
    {sessions && <><ul className="session-list">{sessions.map((session) => <li key={session.id}>
      <div><strong>{session.device}</strong>{session.current && <span> · 当前设备</span>}<small>创建：{date(session.createdAt)}<br />最近活动：{date(session.lastActiveAt)}</small></div>
      <button type="button" className="text-button" disabled={busy} aria-label={session.current ? '退出当前设备' : `退出 ${session.device}`} onClick={() => void revoke(session.id)}>退出</button>
    </li>)}</ul>{sessions.some((session) => !session.current) && <button type="button" className="outline-button" disabled={busy} onClick={() => void revoke()}>退出其他设备</button>}</>}
    {error && <><p className="form-error" role="alert">{error}</p><button type="button" className="outline-button" disabled={busy} onClick={() => setRevision((value) => value + 1)}>重试</button></>}
  </div>;
}
