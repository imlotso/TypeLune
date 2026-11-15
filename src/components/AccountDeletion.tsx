import { useLayoutEffect, useState, type FormEvent } from 'react';
import type { User } from '../lib/api';
import { PasswordField } from './PasswordField';
import { downloadPersonalData, recoveryCopyLabel } from './PersonalDataView';

type Props = { user: User; busy: boolean; setBusy: (busy: boolean) => void; visibilityVersion: number; onDelete: (password: string) => Promise<void>; onDirtyChange?: (dirty: boolean) => void };

export function AccountDeletion({ user, busy, setBusy, visibilityVersion, onDelete, onDirtyChange }: Props) {
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useLayoutEffect(() => { onDirtyChange?.(!!password || confirmed); }, [password, confirmed, onDirtyChange]);
  async function exportData() {
    setBusy(true); setError(''); setNotice('');
    try {
      const { missing, hasLocalRecovery, hasCloudRecovery } = await downloadPersonalData(user, 'json');
      const copies = recoveryCopyLabel(hasLocalRecovery, hasCloudRecovery);
      setNotice(missing.length ? `已导出部分资料：${missing.join('；')}` : copies ? `导出完成，含未合并的${copies}副本` : '导出完成');
    } catch (problem) { setError(problem instanceof Error ? problem.message : '导出失败'); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!confirmed || busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await onDelete(password); }
    catch (problem) { setError(problem instanceof Error ? problem.message : '注销失败'); }
    finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}>
    <p className="form-error">账号、云工作区、私人文章、草稿、背景、记录和反馈将删除，公开成绩将撤回。注销无法恢复；离线设备副本无法即时清除，已有备份副本也不会即时清除。请先关闭此设备的旧版页面；旧页面继续运行可能覆盖其他账号的本机记录。</p>
    <button type="button" className="outline-button" disabled={busy} onClick={() => void exportData()}>导出个人数据</button>
    <PasswordField key={visibilityVersion} label="当前密码（注销）" toggleLabel="当前密码（注销）" autoComplete="current-password" value={password} disabled={busy} required onChange={(event) => setPassword(event.target.value)} />
    <label className="settings-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />我了解注销无法恢复</label>
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={busy || !confirmed}>永久注销账号</button>
  </form>;
}
