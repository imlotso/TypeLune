import { useI18n } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';

type Session = { id: string; device: string; createdAt: number | null; lastActiveAt: number | null; current: boolean };
type Props = { ownerId: string; busy: boolean; setBusy: (busy: boolean) => void; onSignedOut: (message: string) => void };

export function SessionManager({ ownerId, busy, setBusy, onSignedOut }: Props) {
  const { t, locale } = useI18n();
const date = (value: number | null) => value == null ? t("未知", "Unknown") : new Date(value).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

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
        if (problem instanceof ApiError && problem.status === 401) onSignedOut(t("登录状态已失效，请重新登录", "Session expired. Please sign in again"));
        else { setSessions(undefined); setError(problem instanceof Error ? problem.message : t("加载失败", "Could not load")); }
      });
    return () => controller.abort();
  }, [ownerId, revision, busy]);
  async function revoke(id?: string) {
    setBusy(true); setError('');
    try {
      if (id) {
        const result = await api<{ current: boolean }>('/api/account/sessions/revoke', { method: 'POST', headers: { 'X-Workspace-Owner': ownerId }, body: { id } });
        if (result.current) { onSignedOut(t("已退出当前设备", "Signed out of this device")); return; }
        setSessions((current) => current?.filter((session) => session.id !== id));
      } else {
        await api('/api/account/sessions/revoke-others', { method: 'POST', headers: { 'X-Workspace-Owner': ownerId }, body: {} });
        setSessions((current) => current?.filter((session) => session.current));
      }
    } catch (problem) {
      if (problem instanceof ApiError && problem.status === 401) onSignedOut(t("登录状态已失效，请重新登录", "Session expired. Please sign in again"));
      else setError(problem instanceof Error ? problem.message : t("操作失败", "Action failed"));
    } finally { setBusy(false); }
  }
  return <div className="account-sessions">
    {!sessions && !error && <p role="status">{t("加载中…", "Loading…")}</p>}
    {sessions && <><ul className="session-list">{sessions.map((session) => <li key={session.id}>
      <div><strong>{session.device}</strong>{session.current && <span> {t("· 当前设备", "· This device")}</span>}<small>{t("创建：", "Created: ")}{date(session.createdAt)}<br />{t("最近活动：", "Last active: ")}{date(session.lastActiveAt)}</small></div>
      <button type="button" className="text-button" disabled={busy} aria-label={session.current ? t("退出当前设备", "Sign out this device") : t(`退出 ${session.device}`, `Sign out ${session.device}`)} onClick={() => void revoke(session.id)}>{t("退出", "Sign out")}</button>
    </li>)}</ul>{sessions.some((session) => !session.current) && <button type="button" className="outline-button" disabled={busy} onClick={() => void revoke()}>{t("退出其他设备", "Sign out other devices")}</button>}</>}
    {error && <><p className="form-error" role="alert">{error}</p><button type="button" className="outline-button" disabled={busy} onClick={() => setRevision((value) => value + 1)}>{t("重试", "Retry")}</button></>}
  </div>;
}
