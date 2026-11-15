import { useI18n } from '../lib/i18n';
import { useState } from 'react';
import type { User } from '../lib/api';
import { Dialog } from './Dialog';
import { downloadPersonalData } from './PersonalDataView';

type Props = { user: User; reason: 'generation' | 'conflict'; onReset: () => Promise<void>; onClose: () => void };
export function WorkspaceRecoveryDialog({ user, reason, onReset, onClose }: Props) {
  const { t, locale } = useI18n();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function exportLocal() {
    setBusy(true); setError(''); setNotice('');
    try {
      const missing = (await downloadPersonalData(user, 'json', { localOnly: true })).missing.filter((item) => !item.startsWith(t("云端工作区、", "Cloud workspace,")));
      setNotice(missing.length ? `部分本机资料无法读取：${missing.join('；')}` : t("已导出本机资料", "Local data exported"));
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("导出失败", "Export failed")); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (!confirmed || busy) return;
    setBusy(true); setError('');
    try { await onReset(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : t("重新同步失败", "Resync failed")); }
    finally { setBusy(false); }
  }
  return <Dialog title={t("处理同步冲突", "Resolve sync conflict")} onClose={onClose} dismissible={!busy}>
    <div className="feature-form">
      <p>{reason === 'generation' ? t("云端已整理删除标记，本机资料需要重新同步。", "Cloud deletion markers were compacted. Local data needs resyncing.") : t("本机和云端的部分资料发生冲突。", "Some local and cloud data conflicts.")}</p>
      <p className="form-error">{t("重新同步会用云端资料替换本机账号数据，未同步的内容将丢失。", "Resync replaces local account data with cloud data. Unsynced content will be lost.")}</p>
      <button type="button" className="outline-button" disabled={busy} onClick={() => void exportLocal()}>{t("导出本机资料", "Export local data")}</button>
      <label className="settings-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />{t("我已备份或确认放弃本机未同步资料", "I have backed up or chosen to discard unsynced local data")}</label>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={onClose}>{t("取消", "Cancel")}</button><button type="button" className="primary-button" disabled={busy || !confirmed} onClick={() => void reset()}>{t("重新同步", "Resync")}</button></div>
    </div>
  </Dialog>;
}
