import { useI18n } from '../lib/i18n';
import { useLayoutEffect, useState, type FormEvent } from 'react';
import type { User } from '../lib/api';
import { PasswordField } from './PasswordField';
import { downloadPersonalData, recoveryCopyLabel } from './PersonalDataView';

type Props = { user: User; busy: boolean; setBusy: (busy: boolean) => void; visibilityVersion: number; onDelete: (password: string) => Promise<void>; onDirtyChange?: (dirty: boolean) => void };

export function AccountDeletion({ user, busy, setBusy, visibilityVersion, onDelete, onDirtyChange }: Props) {
  const { t, locale } = useI18n();

  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useLayoutEffect(() => { onDirtyChange?.(!!password || confirmed); }, [password, confirmed, onDirtyChange]);
  async function exportData() {
    setBusy(true); setError(''); setNotice('');
    try {
      const { missing, hasLocalRecovery, hasCloudRecovery } = await downloadPersonalData(user, 'json');
      const copies = recoveryCopyLabel(hasLocalRecovery, hasCloudRecovery, t);
      setNotice(missing.length ? t(`已导出部分资料：${missing.join('；')}`, `Partial export: ${missing.join('; ')}`) : copies ? t(`导出完成，含未合并的${copies}副本`, `Export complete, including unmerged ${copies} copies`) : t("导出完成", "Export complete"));
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("导出失败", "Export failed")); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!confirmed || busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await onDelete(password); }
    catch (problem) { setError(problem instanceof Error ? problem.message : t("注销失败", "Account deletion failed")); }
    finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}>
    <p className="form-error">{t("账号、云工作区、私人文章、草稿、背景、记录和反馈将删除，公开成绩将撤回。注销无法恢复；离线设备副本无法即时清除，已有备份副本也不会即时清除。请先关闭此设备的旧版页面；旧页面继续运行可能覆盖其他账号的本机记录。", "Your account, cloud workspace, private articles, drafts, backgrounds, history and feedback will be deleted, and public scores withdrawn. This cannot be undone. Offline copies and existing backups cannot be removed immediately. Close old tabs on this device first: they may overwrite other accounts’ local history.")}</p>
    <button type="button" className="outline-button" disabled={busy} onClick={() => void exportData()}>{t("导出个人数据", "Export personal data")}</button>
    <PasswordField key={visibilityVersion} label={t("当前密码（注销）", "Current password (delete account)")} toggleLabel={t("当前密码（注销）", "Current password (delete account)")} autoComplete="current-password" value={password} disabled={busy} required onChange={(event) => setPassword(event.target.value)} />
    <label className="settings-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />{t("我了解注销无法恢复", "I understand deletion cannot be undone")}</label>
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={busy || !confirmed}>{t("永久注销账号", "Permanently delete account")}</button>
  </form>;
}
