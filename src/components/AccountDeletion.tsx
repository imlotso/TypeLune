import { useState, type FormEvent } from 'react';
import type { User } from '../lib/api';
import { PasswordField } from './PasswordField';
import { downloadPersonalData } from './PersonalDataView';

type Props = { user: User; busy: boolean; setBusy: (busy: boolean) => void; visibilityVersion: number; onDelete: (password: string) => Promise<void> };

export function AccountDeletion({ user, busy, setBusy, visibilityVersion, onDelete }: Props) {
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function exportData() {
    setBusy(true); setError(''); setNotice('');
    try {
      const missing = await downloadPersonalData(user, 'json');
      setNotice(missing.length ? `已导出部分资料：${missing.join('；')}` : '导出完成');
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
    <p className="form-error">账号、云工作区、私人文章、草稿、背景、记录和反馈将删除，公开成绩将撤回。注销无法恢复；离线设备副本无法即时清除，已有备份副本也不会即时清除。</p>
    <button type="button" className="outline-button" disabled={busy} onClick={() => void exportData()}>导出个人数据</button>
    <PasswordField key={visibilityVersion} label="当前密码（注销）" toggleLabel="当前密码（注销）" autoComplete="current-password" value={password} disabled={busy} required onChange={(event) => setPassword(event.target.value)} />
    <label className="settings-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />我了解注销无法恢复</label>
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={busy || !confirmed}>永久注销账号</button>
  </form>;
}
