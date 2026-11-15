import { useEffect, useRef, useState } from 'react';
import { clearImportedGuestCopies, collectGuestImport, guestImportConflicts, importGuestItems, verifyGuestImport, type GuestImportPlan } from '../lib/guest-import';
import type { SyncState, WorkspaceKind } from '../lib/models';
import { Dialog } from './Dialog';

const names: Record<WorkspaceKind, string> = { article: '私人文章', favorite: '收藏', draft: '草稿', record: '记录', settings: '设置', background: '背景' };
const kinds: WorkspaceKind[] = ['article', 'favorite', 'draft', 'record', 'settings', 'background'];

export function GuestImportDialog({ ownerId, syncState, cloudLoaded, onSync, onClose, onRecovery }: { ownerId: string; syncState: SyncState; cloudLoaded: boolean; onSync: () => Promise<void>; onClose: () => void; onRecovery?: () => void }) {
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
    catch (problem) { setError(problem instanceof Error ? problem.message : '游客资料无法读取'); }
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
      if (!await verifyGuestImport(ownerId, result.accepted)) throw new Error('尚未全部同步，请重试');
      setDone({ count: result.accepted.length, conflicts: result.conflicts, fingerprint: plan.fingerprint });
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : '操作失败';
      setError(localSaved ? `已保存在本机，${message}` : `导入未完成：${message}；游客资料已保留`);
    } finally { setBusy(false); }
  }
  async function clearGuest() {
    if (!done || busy) return;
    setBusy(true); setError('');
    try {
      await clearImportedGuestCopies(ownerId, done.fingerprint);
      setConfirmClear(false); setNotice('游客副本已清除');
    } catch (problem) { setError(problem instanceof Error ? problem.message : '清理未完成'); }
    finally { setBusy(false); }
  }
  const close = () => { if (busy) return; if (confirmClear) setConfirmClear(false); else onClose(); };
  const total = plan?.items.length ?? 0;
  const conflicts = plan ? guestImportConflicts(plan, replaceSettings) : 0;
  return <Dialog title={confirmClear ? '清除游客副本？' : '导入游客资料'} onClose={close} dismissible={!busy}>
    {confirmClear ? <div className="feature-form">
      <p className="form-error">将清除本浏览器的游客资料，无法恢复。请先保存并关闭其他游客页面，未导入的内容会丢失。</p>
      {!!done?.conflicts && <p className="form-error">其中 {done.conflicts} 项未导入，清除后无法恢复。</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="feature-actions"><button ref={safeAction} type="button" className="outline-button" disabled={busy} onClick={() => setConfirmClear(false)}>保留</button>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void clearGuest()}>确认清除</button></div>
    </div> : <div className="feature-form">
      {plan && !done && <>
        <p>相同项目保留账号数据；游客成绩仅作个人记录。</p>
        <ul>{kinds.filter((kind) => plan.counts[kind] > 0).map((kind) => <li key={kind}>{names[kind]}：{plan.counts[kind]} 项</li>)}</ul>
        {!total && <p>暂无可导入的游客资料</p>}
        {plan.items.some((item) => item.kind === 'settings' && item.expected && !item.expected.deleted) && <label className="settings-check"><input type="checkbox" checked={replaceSettings} onChange={(event) => setReplaceSettings(event.target.checked)} />覆盖账号练习设置</label>}
        {!!conflicts && <p>冲突：{conflicts} 项，保留账号数据。</p>}
        {(!cloudLoaded || syncState !== 'synced') && <><p className="form-error">请先完成账号同步。</p>{onRecovery ?
          <button type="button" className="outline-button" disabled={busy} onClick={onRecovery}>处理同步冲突</button> :
          <button type="button" className="outline-button" disabled={busy || syncState === 'syncing' || syncState === 'loading'} onClick={() => void onSync()}>立即同步</button>}</>}
      </>}
      {done && <p role="status">已同步 {done.count} 项{done.conflicts ? `，${done.conflicts} 项保留账号数据` : ''}。</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {notice && <p role="status" className="form-notice">{notice}</p>}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={onClose}>{done ? '完成' : '取消'}</button>
        {!done && plan && <button type="button" className="primary-button" disabled={busy || !total || !cloudLoaded || syncState !== 'synced'} onClick={() => void runImport()}>{attempted ? '重试导入和同步' : '导入游客资料'}</button>}
        {done && !notice && <button type="button" className="primary-button" disabled={busy} onClick={() => setConfirmClear(true)}>清除游客副本</button>}
        {!plan && error && <button type="button" className="primary-button" disabled={busy} onClick={() => void load()}>重试读取</button>}
      </div>
    </div>}
  </Dialog>;
}
