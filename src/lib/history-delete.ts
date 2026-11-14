import { deleteLocalHistory } from '../hooks/usePractice';
import { api } from './api';
import type { PracticeRecord, WorkspaceItem } from './models';
import { legacyConflictId, normalizeWorkspaceRecord, stableRecordId } from './records';
import { applyAuthoritativeRecordDeletions, deleteGuestConflict, deleteWorkspaceValue, isWorkspaceItem, readWorkspace } from './workspace';

const attemptId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const needsLegacyMarker = (record: PracticeRecord) => !!record.legacyWorkspaceId && !record.legacyIdConflict && record.legacyProof === undefined &&
  !!record.legacyLocalIds?.some((id) => id !== stableRecordId(record));
const recordIds = (record: PracticeRecord) => [stableRecordId(record), ...(record.legacyIdConflict ? [] : needsLegacyMarker(record) ? [legacyConflictId(record)] : record.legacyLocalIds ?? [])];
export async function deletePracticeRecords(ownerId: string | null, records: PracticeRecord[]) {
  if (!records.length || records.length > 100) throw new Error('请选择 1 至 100 条记录');
  if (records.some((record) => record.legacyDeletionBlocked)) throw new Error('记录标识冲突，请先导出并检查本机资料');
  const ids = [...new Set(records.flatMap(recordIds))];
  if (ids.length > 200 || ids.some((id) => !id || id.length > 200 || /[\p{Cc}\p{Cf}]/u.test(id))) throw new Error('记录标识无效');
  const expectedOnlineIds = [...new Set(records.filter((record) => record.localOnly !== true && !!record.recordId && attemptId.test(record.recordId)).map(stableRecordId))];
  const legacyPairs = records.flatMap((record) => record.legacyWorkspaceId && !record.legacyIdConflict && !needsLegacyMarker(record) ? (record.legacyLocalIds ?? []).filter((alias) => alias !== stableRecordId(record)).map((alias) => ({ id: stableRecordId(record), alias, ...(record.legacyProof && { proof: record.legacyProof }) })) : []);
  const localConflicts = [...new Set(records.flatMap((record) => record.legacyIdConflict ? [stableRecordId(record)] : needsLegacyMarker(record) ? [legacyConflictId(record)] : []))];
  if (legacyPairs.length > 100) throw new Error('旧记录标识无效');
  let expectedRevisions: Array<{ id: string; revision: number }> = [];
  if (ownerId && records.some((record) => record.legacyLocalIds?.length)) {
    const workspace = await readWorkspace(ownerId);
    const byId = new Map(workspace.filter((item) => item.kind === 'record').map((item) => [item.id, item]));
    for (const record of records.filter((entry) => entry.legacyLocalIds?.length && !entry.legacyIdConflict)) {
      const stored = byId.get(stableRecordId(record));
      const current = stored && normalizeWorkspaceRecord(stored);
      if (current && legacyConflictId(current) !== legacyConflictId(record)) throw new Error('记录已更新，请重新选择后删除');
    }
    const protectedIds = new Set(records.filter((record) => record.legacyLocalIds?.length).flatMap(recordIds));
    expectedRevisions = [...protectedIds].map((id) => ({ id, revision: byId.get(id)?.serverRevision ?? 0 }));
  }
  if (ownerId || expectedOnlineIds.length) {
    const result = await api<{ ok: boolean; generation?: number; items?: WorkspaceItem[] }>('/api/history/delete', {
      method: 'POST', headers: { 'X-Workspace-Owner': ownerId ?? 'guest' }, body: { ids, expectedOnlineIds, ...(legacyPairs.length && { legacyPairs }), ...(localConflicts.length && { localConflicts }), ...(expectedRevisions.length && { expectedRevisions }) },
    });
    if (!result.ok) throw new Error('删除结果无法确认，请重试');
    if (ownerId) {
      const items = result.items;
      if (!Array.isArray(items) || items.length !== ids.length || new Set(items.map((item) => item.id)).size !== ids.length ||
        items.some((item) => !isWorkspaceItem(item) || item.kind !== 'record' || !item.deleted || !ids.includes(item.id) || item.serverRevision === undefined) ||
        localConflicts.some((id) => !items.some((item) => item.id === id && item.localConflict === true)) ||
        !Number.isSafeInteger(result.generation) || result.generation! < 1) throw new Error('删除结果无法确认，请重试');
      try { await applyAuthoritativeRecordDeletions(ownerId, items, result.generation!); }
      catch { throw new Error('云端已删除，本机记录清理失败，请重试'); }
    }
  }
  try {
    if (!ownerId) for (const id of ids) {
      if (localConflicts.includes(id)) await deleteGuestConflict(id);
      else await deleteWorkspaceValue(null, 'record', id);
    }
    deleteLocalHistory(ownerId, ids, localConflicts);
  } catch { throw new Error(ownerId || expectedOnlineIds.length ? '在线成绩已处理，本机记录清理失败，请重试' : '本机记录清理失败，请重试'); }
  return ids;
}
