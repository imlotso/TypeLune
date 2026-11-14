import { deleteLocalHistory } from '../hooks/usePractice';
import { api } from './api';
import type { PracticeRecord, WorkspaceItem } from './models';
import { stableRecordId } from './records';
import { applyAuthoritativeRecordDeletions, deleteWorkspaceValue, isWorkspaceItem } from './workspace';

const attemptId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export async function deletePracticeRecords(ownerId: string | null, records: PracticeRecord[]) {
  const ids = [...new Set(records.map(stableRecordId))];
  if (!ids.length || ids.length > 100) throw new Error('请选择 1 至 100 条记录');
  const expectedOnlineIds = [...new Set(records.filter((record) => record.localOnly !== true && !!record.recordId && attemptId.test(record.recordId)).map(stableRecordId))];
  if (ownerId || expectedOnlineIds.length) {
    const result = await api<{ ok: boolean; generation?: number; items?: WorkspaceItem[] }>('/api/history/delete', {
      method: 'POST', headers: { 'X-Workspace-Owner': ownerId ?? 'guest' }, body: { ids, expectedOnlineIds },
    });
    if (!result.ok) throw new Error('删除结果无法确认，请重试');
    if (ownerId) {
      const items = result.items;
      if (!Array.isArray(items) || items.length !== ids.length || new Set(items.map((item) => item.id)).size !== ids.length ||
        items.some((item) => !isWorkspaceItem(item) || item.kind !== 'record' || !item.deleted || !ids.includes(item.id) || item.serverRevision === undefined) ||
        !Number.isSafeInteger(result.generation) || result.generation! < 1) throw new Error('删除结果无法确认，请重试');
      try { await applyAuthoritativeRecordDeletions(ownerId, items, result.generation!); }
      catch { throw new Error('云端已删除，本机记录清理失败，请重试'); }
    }
  }
  try {
    if (!ownerId) for (const id of ids) await deleteWorkspaceValue(null, 'record', id);
    deleteLocalHistory(ownerId, ids);
  } catch { throw new Error(ownerId || expectedOnlineIds.length ? '在线成绩已处理，本机记录清理失败，请重试' : '本机记录清理失败，请重试'); }
  return ids;
}
