import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '../lib/api';
import type { PracticeRecord, SavedPractice, SyncState } from '../lib/models';
import { inspectLocalPracticeCopies } from '../lib/local-practice-unsynced';
import { Dialog } from './Dialog';
import { downloadPersonalData, recoveryCopyLabel } from './PersonalDataView';

type Props = { user: User; pendingCount: number | null; syncState: SyncState; syncError: string;
  initialClear?: boolean; drafts?: readonly SavedPractice[]; records?: readonly PracticeRecord[]; onSync: () => Promise<void>; onLogout: (clear: boolean, options?: { rawFingerprint: string; riskAcknowledged: boolean }) => Promise<void>; onClose: () => void };

const noDrafts: readonly SavedPractice[] = [];
const noRecords: readonly PracticeRecord[] = [];
export function LogoutDialog({ user, pendingCount, syncState, syncError, initialClear = false, drafts = noDrafts, records = noRecords, onSync, onLogout, onClose }: Props) {
  const [clear, setClear] = useState(initialClear);
  const [abandon, setAbandon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [legacyRisk, setLegacyRisk] = useState(() => inspectLocalPracticeCopies(user.id, drafts, records));
  const workspaceRisk = syncState !== 'synced' || pendingCount !== 0;
  const atRisk = clear && (workspaceRisk || legacyRisk.pending > 0 || legacyRisk.unknown);
  useEffect(() => { setLegacyRisk(inspectLocalPracticeCopies(user.id, drafts, records)); }, [user.id, drafts, records, syncState, pendingCount]);
  useEffect(() => {
    const update = () => setLegacyRisk(inspectLocalPracticeCopies(user.id, drafts, records));
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [user.id, drafts, records]);
  useEffect(() => { setAbandon(false); }, [atRisk, legacyRisk.fingerprint]);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || (clear && !abandon)) return;
    let rawFingerprint: string | undefined;
    if (clear) {
      const latest = inspectLocalPracticeCopies(user.id, drafts, records);
      if (latest.fingerprint !== legacyRisk.fingerprint) {
        setLegacyRisk(latest); setAbandon(false); setError('本机练习资料已变化，请重新确认'); return;
      }
      rawFingerprint = latest.rawFingerprint;
    }
    setBusy(true); setError('');
    try { await onLogout(clear, rawFingerprint === undefined ? undefined : { rawFingerprint, riskAcknowledged: atRisk }); }
    catch (problem) { setAbandon(false); setError(problem instanceof Error ? problem.message : '退出失败'); }
    finally { setBusy(false); }
  }
  async function exportData(localOnly = false) {
    setBusy(true); setError(''); setNotice('');
    try {
      const { missing, hasLocalRecovery, hasCloudRecovery } = await downloadPersonalData(user, 'json', localOnly ? { localOnly: true } : undefined);
      const unavailable = localOnly ? missing.filter((item) => !item.startsWith('云端工作区、')) : missing;
      const copies = recoveryCopyLabel(hasLocalRecovery, hasCloudRecovery);
      setNotice(unavailable.length ? `已导出部分资料：${unavailable.join('；')}` : localOnly ? '已导出本机资料；不包含云端资料' : copies ? `导出完成，含未合并的${copies}副本` : '导出完成');
    } catch (problem) { setError(problem instanceof Error ? problem.message : '导出失败'); }
    finally { setBusy(false); }
  }
  return <Dialog title="退出登录" onClose={onClose} dismissible={!busy}>
    <form className="feature-form" onSubmit={submit}>
      <label className="settings-check"><input type="checkbox" checked={clear} disabled={busy} onChange={(event) => { setClear(event.target.checked); setAbandon(false); }} />同时清除此设备的账号数据</label>
      {clear && <>
        <p className="feature-muted">将清除此设备的账号缓存；未同步内容会丢失。云端资料和其他账号不会删除。请关闭此设备的旧版页面，避免再次写入缓存。</p>
        {workspaceRisk && <p className="form-error">{pendingCount != null && pendingCount > 0 ? `${pendingCount} 项资料尚未同步，清理后将丢失。` : '无法确认工作区是否存在未同步资料。'}</p>}
        {legacyRisk.pending > 0 && <p className="form-error">{legacyRisk.pending} 项本机练习资料未确认同步，清理后将丢失。</p>}
        {legacyRisk.unknown && <p className="form-error">部分本机旧版练习资料无法确认，请先导出或检查。</p>}
        {atRisk && syncError && <p className="feature-muted">{syncError}</p>}
        <div className="feature-actions"><button type="button" className="outline-button" disabled={busy || syncState === 'syncing' || syncState === 'loading'} onClick={() => void onSync()}>立即同步</button>
          <button type="button" className="outline-button" disabled={busy} onClick={() => void exportData()}>导出个人数据</button>
          {atRisk && <button type="button" className="outline-button" disabled={busy} onClick={() => void exportData(true)}>导出本机资料</button>}</div>
        <label className="settings-check"><input type="checkbox" checked={abandon} disabled={busy} onChange={(event) => setAbandon(event.target.checked)} />{atRisk ? '确认放弃未同步资料' : '确认清除本机数据'}</label>
      </>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={onClose}>取消</button>
        <button className="primary-button" disabled={busy || (clear && !abandon)}>确认退出</button></div>
    </form>
  </Dialog>;
}
