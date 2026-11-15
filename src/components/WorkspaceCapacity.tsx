import { SystemMessage } from './SystemMessage';
import { useI18n } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { WorkspaceKind } from '../lib/models';

type Usage = { count: number; bytes: number; tombstones: number; aliasTombstones?: number; maxItems: number; maxBytes: number; generation: number;
  types: Array<{ kind: WorkspaceKind; count: number; bytes: number; tombstones: number; aliasTombstones?: number }> };
export type CapacityDestination = Exclude<WorkspaceKind, 'settings' | 'background'> | 'background-light' | 'background-dark';
const names: Record<WorkspaceKind, string> = { favorite: '收藏', article: '私人文章', draft: '草稿', record: '记录', settings: '设置', background: '背景' };
const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;

export function WorkspaceCapacity({ ownerId, onCompacted, onManage, onResetSettings }: { ownerId: string; onCompacted: () => void; onManage: (destination: CapacityDestination) => void; onResetSettings: () => Promise<void> }) {
  const { t, locale } = useI18n();
  const [usage, setUsage] = useState<Usage>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingSettings, setConfirmingSettings] = useState(false);
  const headers = { 'X-Workspace-Owner': ownerId, 'X-Workspace-Protocol': '2', 'X-Workspace-Capabilities': 'local-conflict-v2' };
  async function refresh() {
    setBusy(true); setError('');
    try {
      const next = await api<Usage>('/api/workspace/usage', { headers });
      if (![next.count, next.bytes, next.tombstones, next.maxItems, next.maxBytes, next.generation].every((value) => Number.isSafeInteger(value) && value >= 0) ||
        (next.aliasTombstones !== undefined && (!Number.isSafeInteger(next.aliasTombstones) || next.aliasTombstones < 0)) ||
        next.generation < 1 || !Array.isArray(next.types) || next.types.some((type) => !names[type.kind] || ![type.count, type.bytes, type.tombstones].every((value) => Number.isSafeInteger(value) && value >= 0) ||
          (type.aliasTombstones !== undefined && (!Number.isSafeInteger(type.aliasTombstones) || type.aliasTombstones < 0)))) throw new Error(t("容量数据无法读取", "Could not read capacity"));
      setUsage(next);
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("容量读取失败", "Could not load capacity")); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, [ownerId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function compact() {
    if (!usage || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ removed: number; generation: number }>('/api/workspace/compact', { method: 'POST', headers, body: { generation: usage.generation } });
      if (!Number.isSafeInteger(result.removed) || result.removed < 0 || !Number.isSafeInteger(result.generation)) throw new Error(t("整理结果无法读取", "Could not read cleanup result"));
      setConfirming(false);
      if (result.removed) onCompacted();
      else { setNotice(t("没有需要整理的删除标记", "No deletion markers to compact")); await refresh(); }
    } catch (problem) {
      setError(problem instanceof ApiError ? problem.message : t("整理结果无法确认，请检查同步状态后重试", "Could not confirm compaction. Check sync status and retry."));
    } finally { setBusy(false); }
  }
  async function resetSettings() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await onResetSettings(); setConfirmingSettings(false); setNotice(t("设置已在本机清除，等待同步", "Settings cleared locally. Waiting to sync.")); }
    catch (problem) { setError(problem instanceof Error ? problem.message : t("设置清除失败", "Could not clear settings")); }
    finally { setBusy(false); }
  }
  function manageKind(kind: WorkspaceKind) {
    if (kind !== 'settings' && kind !== 'background') onManage(kind);
  }
  return <section className="workspace-capacity" aria-labelledby="workspace-capacity-title">
    <h2 id="workspace-capacity-title">{t("云工作区容量", "Cloud workspace capacity")}</h2>
    {usage && <>
      <p>{usage.count} / {usage.maxItems}  {t("项 ·", "items ·")} {size(usage.bytes)} / {size(usage.maxBytes)}</p>
      <p>{t("已删除：", "Deleted:")}{usage.tombstones}  {t("项", "items")}</p>
      {!!usage.aliasTombstones && <p>{t("旧记录关联标记：", "Legacy record markers:")}{usage.aliasTombstones}  {t("项，不计入容量上限", "items, excluded from capacity limit")}</p>}
      <ul className="workspace-capacity-types">{usage.types.map((type) => <li key={type.kind}>
        <span>{t(names[type.kind], ({favorite:'Favorites',article:'Private articles',draft:'Drafts',record:'Records',settings:'Settings',background:'Background'})[type.kind])}：{type.count}  {t("项，已删除", "items; deleted")} {type.tombstones}  {t("项 ·", "items ·")} {size(type.bytes)}</span>
        {type.count > type.tombstones && <div className="feature-actions">
          {type.kind === 'settings' ? <button type="button" className="text-button" disabled={busy} onClick={() => setConfirmingSettings(true)}>{t("清除设置", "Clear settings")}</button> :
            type.kind === 'background' ? <><button type="button" className="text-button" disabled={busy} onClick={() => onManage('background-light')}>{t("管理日间背景", "Manage light background")}</button><button type="button" className="text-button" disabled={busy} onClick={() => onManage('background-dark')}>{t("管理夜间背景", "Manage dark background")}</button></> :
              <button type="button" className="text-button" disabled={busy} onClick={() => manageKind(type.kind)}>{t("管理", "Manage")}{names[type.kind]}</button>}
        </div>}
      </li>)}</ul>
      {confirmingSettings && <div className="feature-form">
        <p className="form-error">{t("练习设置、预设、错字状态和统计目标将被清除，并同步到其他设备。", "Practice settings, presets, mistake status and statistics goals will be cleared and synced to other devices.")}</p>
        <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => setConfirmingSettings(false)}>{t("取消", "Cancel")}</button>
          <button type="button" className="primary-button" disabled={busy} onClick={() => void resetSettings()}>{t("确认清除设置", "Confirm clear settings")}</button></div>
      </div>}
      {!confirming && <button type="button" className="outline-button" disabled={busy || !((usage.aliasTombstones ?? 0) + usage.tombstones)} onClick={() => setConfirming(true)}>{t("整理删除标记", "Compact deletion markers")}</button>}
      {confirming && <div className="feature-form">
        <p className="form-error">{t("整理后其他设备需要重新同步；未同步资料应先导出。此设备也需要确认本机资料。", "Other devices will need to resync. Export unsynced data first and confirm local data on this device.")}</p>
        <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => setConfirming(false)}>{t("取消", "Cancel")}</button>
          <button type="button" className="primary-button" disabled={busy} onClick={() => void compact()}>{t("确认整理", "Confirm compaction")}</button></div>
      </div>}
    </>}
    {error && <p role="alert" className="form-error">{<SystemMessage text={error} />}</p>}
    {notice && <p role="status" className="form-notice">{<SystemMessage text={notice} />}</p>}
    <button type="button" className="text-button" disabled={busy} onClick={() => void refresh()}>{t("刷新容量", "Refresh capacity")}</button>
  </section>;
}
