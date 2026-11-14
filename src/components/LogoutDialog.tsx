import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '../lib/api';
import type { SyncState } from '../lib/models';
import { Dialog } from './Dialog';
import { downloadPersonalData } from './PersonalDataView';

type Props = { user: User; pendingCount: number | null; syncState: SyncState; syncError: string;
  initialClear?: boolean; onSync: () => Promise<void>; onLogout: (clear: boolean) => Promise<void>; onClose: () => void };

export function LogoutDialog({ user, pendingCount, syncState, syncError, initialClear = false, onSync, onLogout, onClose }: Props) {
  const [clear, setClear] = useState(initialClear);
  const [abandon, setAbandon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const atRisk = clear && (syncState !== 'synced' || pendingCount !== 0);
  useEffect(() => { setAbandon(false); }, [atRisk]);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || (clear && !abandon)) return;
    setBusy(true); setError('');
    try { await onLogout(clear); }
    catch (problem) { setError(problem instanceof Error ? problem.message : '退出失败'); }
    finally { setBusy(false); }
  }
  async function exportData() {
    setBusy(true); setError(''); setNotice('');
    try {
      const missing = await downloadPersonalData(user, 'json');
      setNotice(missing.length ? `已导出部分资料：${missing.join('；')}` : '导出完成');
    } catch (problem) { setError(problem instanceof Error ? problem.message : '导出失败'); }
    finally { setBusy(false); }
  }
  return <Dialog title="退出登录" onClose={onClose} dismissible={!busy}>
    <form className="feature-form" onSubmit={submit}>
      <label className="settings-check"><input type="checkbox" checked={clear} disabled={busy} onChange={(event) => { setClear(event.target.checked); setAbandon(false); }} />同时清除此设备的账号数据</label>
      {clear && <>
        <p className="feature-muted">将清除此设备的账号缓存；未同步内容会丢失。云端资料和其他账号不会删除。</p>
        {atRisk && <p className="form-error">{pendingCount != null && pendingCount > 0 ? `${pendingCount} 项资料尚未同步，清理后将丢失。` : '无法确认是否存在未同步资料。'}</p>}
        {atRisk && syncError && <p className="feature-muted">{syncError}</p>}
        <div className="feature-actions"><button type="button" className="outline-button" disabled={busy || syncState === 'syncing' || syncState === 'loading'} onClick={() => void onSync()}>立即同步</button>
          <button type="button" className="outline-button" disabled={busy} onClick={() => void exportData()}>导出个人数据</button></div>
        <label className="settings-check"><input type="checkbox" checked={abandon} disabled={busy} onChange={(event) => setAbandon(event.target.checked)} />{atRisk ? '确认放弃未同步资料' : '确认清除本机数据'}</label>
      </>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={onClose}>取消</button>
        <button className="primary-button" disabled={busy || (clear && !abandon)}>确认退出</button></div>
    </form>
  </Dialog>;
}
