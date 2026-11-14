import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { WorkspaceKind } from '../lib/models';

type Usage = { count: number; bytes: number; tombstones: number; maxItems: number; maxBytes: number; generation: number;
  types: Array<{ kind: WorkspaceKind; count: number; bytes: number; tombstones: number }> };
export type CapacityDestination = Exclude<WorkspaceKind, 'settings' | 'background'> | 'background-light' | 'background-dark';
const names: Record<WorkspaceKind, string> = { favorite: '收藏', article: '私人文章', draft: '草稿', record: '记录', settings: '设置', background: '背景' };
const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;

export function WorkspaceCapacity({ ownerId, onCompacted, onManage, onResetSettings }: { ownerId: string; onCompacted: () => void; onManage: (destination: CapacityDestination) => void; onResetSettings: () => Promise<void> }) {
  const [usage, setUsage] = useState<Usage>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingSettings, setConfirmingSettings] = useState(false);
  const headers = { 'X-Workspace-Owner': ownerId, 'X-Workspace-Protocol': '2' };
  async function refresh() {
    setBusy(true); setError('');
    try {
      const next = await api<Usage>('/api/workspace/usage', { headers });
      if (![next.count, next.bytes, next.tombstones, next.maxItems, next.maxBytes, next.generation].every((value) => Number.isSafeInteger(value) && value >= 0) ||
        next.generation < 1 || !Array.isArray(next.types) || next.types.some((type) => !names[type.kind] || ![type.count, type.bytes, type.tombstones].every((value) => Number.isSafeInteger(value) && value >= 0))) throw new Error('容量数据无法读取');
      setUsage(next);
    } catch (problem) { setError(problem instanceof Error ? problem.message : '容量读取失败'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, [ownerId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function compact() {
    if (!usage || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ removed: number; generation: number }>('/api/workspace/compact', { method: 'POST', headers, body: { generation: usage.generation } });
      if (!Number.isSafeInteger(result.removed) || result.removed < 0 || !Number.isSafeInteger(result.generation)) throw new Error('整理结果无法读取');
      setConfirming(false);
      if (result.removed) onCompacted();
      else { setNotice('没有需要整理的删除标记'); await refresh(); }
    } catch (problem) {
      setError(problem instanceof ApiError ? problem.message : '整理结果无法确认，请检查同步状态后重试');
    } finally { setBusy(false); }
  }
  async function resetSettings() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await onResetSettings(); setConfirmingSettings(false); setNotice('设置已在本机清除，等待同步'); }
    catch (problem) { setError(problem instanceof Error ? problem.message : '设置清除失败'); }
    finally { setBusy(false); }
  }
  function manageKind(kind: WorkspaceKind) {
    if (kind !== 'settings' && kind !== 'background') onManage(kind);
  }
  return <section className="workspace-capacity" aria-labelledby="workspace-capacity-title">
    <h2 id="workspace-capacity-title">云工作区容量</h2>
    {usage && <>
      <p>{usage.count} / {usage.maxItems} 项 · {size(usage.bytes)} / {size(usage.maxBytes)}</p>
      <p>已删除：{usage.tombstones} 项</p>
      <ul className="workspace-capacity-types">{usage.types.map((type) => <li key={type.kind}>
        <span>{names[type.kind]}：{type.count} 项，已删除 {type.tombstones} 项 · {size(type.bytes)}</span>
        {type.count > type.tombstones && <div className="feature-actions">
          {type.kind === 'settings' ? <button type="button" className="text-button" disabled={busy} onClick={() => setConfirmingSettings(true)}>清除设置</button> :
            type.kind === 'background' ? <><button type="button" className="text-button" disabled={busy} onClick={() => onManage('background-light')}>管理日间背景</button><button type="button" className="text-button" disabled={busy} onClick={() => onManage('background-dark')}>管理夜间背景</button></> :
              <button type="button" className="text-button" disabled={busy} onClick={() => manageKind(type.kind)}>管理{names[type.kind]}</button>}
        </div>}
      </li>)}</ul>
      {confirmingSettings && <div className="feature-form">
        <p className="form-error">练习设置、预设、错字状态和统计目标将被清除，并同步到其他设备。</p>
        <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => setConfirmingSettings(false)}>取消</button>
          <button type="button" className="primary-button" disabled={busy} onClick={() => void resetSettings()}>确认清除设置</button></div>
      </div>}
      {!confirming && <button type="button" className="outline-button" disabled={busy || !usage.tombstones} onClick={() => setConfirming(true)}>整理删除标记</button>}
      {confirming && <div className="feature-form">
        <p className="form-error">整理后其他设备需要重新同步；未同步资料应先导出。此设备也需要确认本机资料。</p>
        <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => setConfirming(false)}>取消</button>
          <button type="button" className="primary-button" disabled={busy} onClick={() => void compact()}>确认整理</button></div>
      </div>}
    </>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status" className="form-notice">{notice}</p>}
    <button type="button" className="text-button" disabled={busy} onClick={() => void refresh()}>刷新容量</button>
  </section>;
}
