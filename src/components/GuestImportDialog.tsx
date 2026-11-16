import { SystemMessage } from './SystemMessage';
import { useI18n } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { clearImportedGuestCopies, collectGuestImport, guestImportConflicts, importGuestItems, verifyGuestImport, type GuestImportPlan } from '../lib/guest-import';
import type { SyncState, WorkspaceKind } from '../lib/models';
import { Dialog } from './Dialog';

const kinds: WorkspaceKind[] = ['article', 'favorite', 'draft', 'record', 'settings', 'background'];

export function GuestImportDialog({ ownerId, syncState, cloudLoaded, onSync, onClose, onRecovery }: { ownerId: string; syncState: SyncState; cloudLoaded: boolean; onSync: () => Promise<void>; onClose: () => void; onRecovery?: () => void }) {
  const { t, locale } = useI18n();
const names: Record<WorkspaceKind, string> = { article: t("私人文章", "Private articles"), favorite: t("收藏", "Favorites"), draft: t("草稿", "Drafts"), record: t("记录", "History"), settings: t("设置", "Settings"), background: t("背景", "Backgrounds") };

  const [plan, setPlan] = useState<GuestImportPlan>();
  const [replaceSettings, setReplaceSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [done, setDone] = useState<{ count: number; conflicts: number; fingerprint: string }>();
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const safeAction = useRef<HTMLButtonElement>(null);

  async function load() {
    setBusy(true); setError('');
    try { setPlan(await collectGuestImport(ownerId)); }
    catch (problem) { setError(problem instanceof Error ? problem.message : t("游客资料无法读取", "Could not read guest data")); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [ownerId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (confirmClear) safeAction.current?.focus(); }, [confirmClear]);
  async function runImport() {
    if (!plan || busy || !cloudLoaded || syncState !== 'synced') return;
    setBusy(true); setError(''); setAttempted(true);
    let localSaved = false;
    try {
      const result = await importGuestItems(ownerId, plan, replaceSettings);
      localSaved = true;
      await onSync();
      if (!await verifyGuestImport(ownerId, result.accepted)) throw new Error(t("尚未全部同步，请重试", "Sync is incomplete. Please retry"));
      setDone({ count: result.accepted.length, conflicts: result.conflicts, fingerprint: plan.fingerprint });
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : t("操作失败", "Action failed");
      setError(localSaved ? t(`已保存在本机，${message}`, `Saved locally. ${message}`) : t(`导入未完成：${message}；游客资料已保留`, `Import incomplete: ${message}. Guest data is kept.`));
    } finally { setBusy(false); }
  }
  async function clearGuest() {
    if (!done || busy) return;
    setBusy(true); setError('');
    try {
      await clearImportedGuestCopies(ownerId, done.fingerprint);
      setConfirmClear(false); setNotice(t("游客副本已清除", "Guest copies cleared"));
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("清理未完成", "Cleanup incomplete")); }
    finally { setBusy(false); }
  }
  const close = () => { if (busy) return; if (confirmClear) setConfirmClear(false); else onClose(); };
  const total = plan?.items.length ?? 0;
  const conflicts = plan ? guestImportConflicts(plan, replaceSettings) : 0;
  return <Dialog title={confirmClear ? t("清除游客副本？", "Clear guest copies?") : t("导入游客资料", "Import guest data")} onClose={close} dismissible={!busy}>
    {confirmClear ? <div className="feature-form">
      <p className="form-error">{t("将清除本浏览器的游客资料，无法恢复。请先保存并关闭其他游客页面，未导入的内容会丢失。", "Guest data in this browser will be permanently cleared. Save and close other guest tabs first. Any content not imported will be lost.")}</p>
      {!!done?.conflicts && <p className="form-error">{t("其中", "Of these, ")}{done.conflicts} {t("项未导入，清除后无法恢复。", "items were not imported and cannot be recovered after clearing.")}</p>}
      {error && <p role="alert" className="form-error">{<SystemMessage text={error} />}</p>}
      <div className="feature-actions"><button ref={safeAction} type="button" className="outline-button" disabled={busy} onClick={() => setConfirmClear(false)}>{t("保留", "Keep")}</button>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void clearGuest()}>{t("确认清除", "Confirm clear")}</button></div>
    </div> : <div className="feature-form">
      {plan && !done && <>
        <p>{t("相同项目保留账号数据；游客成绩仅作个人记录。", "For matching items, account data is kept. Guest scores become personal history only.")}</p>
        <ul>{kinds.filter((kind) => plan.counts[kind] > 0).map((kind) => <li key={kind}>{names[kind]}：{plan.counts[kind]} {t("项", " items")}</li>)}</ul>
        {!total && <p>{t("暂无可导入的游客资料", "No guest data to import")}</p>}
        {plan.items.some((item) => item.kind === 'settings' && item.expected && !item.expected.deleted) && <label className="settings-check"><input type="checkbox" checked={replaceSettings} onChange={(event) => setReplaceSettings(event.target.checked)} />{t("覆盖账号练习设置", "Replace account practice settings")}</label>}
        {!!conflicts && <p>{t("冲突：", "Conflicts: ")}{conflicts} {t("项，保留账号数据。", "items; account data is kept.")}</p>}
        {(!cloudLoaded || syncState !== 'synced') && <><p className="form-error">{t("请先完成账号同步。", "Sync your account first.")}</p>{onRecovery ?
          <button type="button" className="outline-button" disabled={busy} onClick={onRecovery}>{t("处理同步冲突", "Resolve sync conflict")}</button> :
          <button type="button" className="outline-button" disabled={busy || syncState === 'syncing' || syncState === 'loading'} onClick={() => void onSync()}>{t("立即同步", "Sync now")}</button>}</>}
      </>}
      {done && <p role="status">{t(`已同步 ${done.count} 项`, `Synced ${done.count} items`)}{done.conflicts ? t(`，${done.conflicts} 项保留账号数据`, `; account data kept for ${done.conflicts} items`) : ''}。</p>}
      {error && <p role="alert" className="form-error">{<SystemMessage text={error} />}</p>}
      {notice && <p role="status" className="form-notice">{<SystemMessage text={notice} />}</p>}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={onClose}>{done ? t("完成", "Done") : t("取消", "Cancel")}</button>
        {!done && plan && <button type="button" className="primary-button" disabled={busy || !total || !cloudLoaded || syncState !== 'synced'} onClick={() => void runImport()}>{attempted ? t("重试导入和同步", "Retry import and sync") : t("导入游客资料", "Import guest data")}</button>}
        {done && !notice && <button type="button" className="primary-button" disabled={busy} onClick={() => setConfirmClear(true)}>{t("清除游客副本", "Clear guest copies")}</button>}
        {!plan && error && <button type="button" className="primary-button" disabled={busy} onClick={() => void load()}>{t("重试读取", "Retry loading")}</button>}
      </div>
    </div>}
  </Dialog>;
}
