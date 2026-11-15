import { useI18n } from '../lib/i18n';
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
  const { t, locale } = useI18n();

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
        setLegacyRisk(latest); setAbandon(false); setError(t("本机练习资料已变化，请重新确认", "Local practice data changed. Please confirm again")); return;
      }
      rawFingerprint = latest.rawFingerprint;
    }
    setBusy(true); setError('');
    try { await onLogout(clear, rawFingerprint === undefined ? undefined : { rawFingerprint, riskAcknowledged: atRisk }); }
    catch (problem) { setAbandon(false); setError(problem instanceof Error ? problem.message : t("退出失败", "Sign-out failed")); }
    finally { setBusy(false); }
  }
  async function exportData(localOnly = false) {
    setBusy(true); setError(''); setNotice('');
    try {
      const { missing, hasLocalRecovery, hasCloudRecovery } = await downloadPersonalData(user, 'json', localOnly ? { localOnly: true } : undefined);
      const unavailable = localOnly ? missing.filter((item) => !item.startsWith('云端工作区、')) : missing;
      const copies = recoveryCopyLabel(hasLocalRecovery, hasCloudRecovery, t);
      setNotice(unavailable.length ? t(`已导出部分资料：${unavailable.join('；')}`, `Partial export: ${unavailable.join('; ')}`) : localOnly ? t("已导出本机资料；不包含云端资料", "Local data exported; cloud data not included") : copies ? t(`导出完成，含未合并的${copies}副本`, `Export complete, including unmerged ${copies} copies`) : t("导出完成", "Export complete"));
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("导出失败", "Export failed")); }
    finally { setBusy(false); }
  }
  return <Dialog title={t("退出登录", "Sign out")} onClose={onClose} dismissible={!busy}>
    <form className="feature-form" onSubmit={submit}>
      <label className="settings-check"><input type="checkbox" checked={clear} disabled={busy} onChange={(event) => { setClear(event.target.checked); setAbandon(false); }} />{t("同时清除此设备的账号数据", "Also clear this account’s data on this device")}</label>
      {clear && <>
        <p className="feature-muted">{t("清理前请先同步或导出，并关闭此设备的旧版页面。旧页面继续运行可能覆盖其他账号的本机记录。", "Sync or export first, then close old tabs on this device. Old tabs may overwrite other accounts’ local history.")}</p>
        {workspaceRisk && <p className="form-error">{pendingCount != null && pendingCount > 0 ? t(`${pendingCount} 项资料尚未同步，清理后将丢失。`, `${pendingCount} unsynced items will be lost if cleared.`) : t("无法确认工作区是否存在未同步资料。", "Could not confirm whether the workspace has unsynced data.")}</p>}
        {legacyRisk.pending > 0 && <p className="form-error">{legacyRisk.pending} {t("项本机练习资料未确认同步，清理后将丢失。", "local practice items are not confirmed synced and will be lost.")}</p>}
        {legacyRisk.unknown && <p className="form-error">{t("部分本机旧版练习资料无法确认，请先导出或检查。", "Some legacy local data could not be checked. Export or inspect it first.")}</p>}
        {atRisk && syncError && <p className="feature-muted">{syncError}</p>}
        <div className="feature-actions"><button type="button" className="outline-button" disabled={busy || syncState === 'syncing' || syncState === 'loading'} onClick={() => void onSync()}>{t("立即同步", "Sync now")}</button>
          <button type="button" className="outline-button" disabled={busy} onClick={() => void exportData()}>{t("导出个人数据", "Export personal data")}</button>
          {atRisk && <button type="button" className="outline-button" disabled={busy} onClick={() => void exportData(true)}>{t("导出本机资料", "Export local data")}</button>}</div>
        <label className="settings-check"><input type="checkbox" checked={abandon} disabled={busy} onChange={(event) => setAbandon(event.target.checked)} />{atRisk ? t("确认放弃未同步资料", "Discard unsynced data") : t("确认清除本机数据", "Confirm clearing local data")}</label>
      </>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={onClose}>{t("取消", "Cancel")}</button>
        <button className="primary-button" disabled={busy || (clear && !abandon)}>{t("确认退出", "Confirm sign out")}</button></div>
    </form>
  </Dialog>;
}
