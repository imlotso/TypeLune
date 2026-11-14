import { useState } from 'react';
import type { User } from '../lib/api';
import { Dialog } from './Dialog';
import { downloadPersonalData } from './PersonalDataView';

type Props = { user: User; reason: 'generation' | 'conflict'; onReset: () => Promise<void>; onClose: () => void };
export function WorkspaceRecoveryDialog({ user, reason, onReset, onClose }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function exportLocal() {
    setBusy(true); setError(''); setNotice('');
    try {
      const missing = (await downloadPersonalData(user, 'json', { localOnly: true })).missing.filter((item) => !item.startsWith('云端工作区、'));
      setNotice(missing.length ? `部分本机资料无法读取：${missing.join('；')}` : '已导出本机资料');
    } catch (problem) { setError(problem instanceof Error ? problem.message : '导出失败'); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (!confirmed || busy) return;
    setBusy(true); setError('');
    try { await onReset(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : '重新同步失败'); }
    finally { setBusy(false); }
  }
  return <Dialog title="处理同步冲突" onClose={onClose} dismissible={!busy}>
    <div className="feature-form">
      <p>{reason === 'generation' ? '云端已整理删除标记，本机资料需要重新同步。' : '本机和云端的部分资料发生冲突。'}</p>
      <p className="form-error">重新同步会用云端资料替换本机账号数据，未同步的内容将丢失。</p>
      <button type="button" className="outline-button" disabled={busy} onClick={() => void exportLocal()}>导出本机资料</button>
      <label className="settings-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />我已备份或确认放弃本机未同步资料</label>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={onClose}>取消</button><button type="button" className="primary-button" disabled={busy || !confirmed} onClick={() => void reset()}>重新同步</button></div>
    </div>
  </Dialog>;
}
