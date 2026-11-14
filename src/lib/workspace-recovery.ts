import { clearLocalPractice } from '../hooks/usePractice';
import { clearSyncTime } from '../hooks/useWorkspace';
import { api } from './api';
import { cancelLocalCleanup, prepareLocalCleanup } from './local-account-cleanup';
import type { WorkspaceItem } from './models';
import { isWorkspaceItem, replaceLocalWorkspace, saveWorkspaceGeneration } from './workspace';

export class WorkspaceResetIncompleteError extends Error {
  constructor() { super('本机重同步未完成，请重试清理后重新登录'); }
}

export async function resetWorkspaceFromCloud(ownerId: string) {
  prepareLocalCleanup(ownerId);
  let snapshot: { protocol: number; generation: number; items: WorkspaceItem[] };
  try {
    snapshot = await api('/api/workspace', { headers: { 'X-Workspace-Owner': ownerId, 'X-Workspace-Protocol': '2' }, timeoutMs: 60_000 });
    if (snapshot.protocol !== 2 || !Number.isSafeInteger(snapshot.generation) || snapshot.generation < 1 ||
      !Array.isArray(snapshot.items) || !snapshot.items.every((item) => isWorkspaceItem(item) && item.serverRevision !== undefined)) throw new Error('云端资料无法读取');
  } catch (problem) {
    cancelLocalCleanup(ownerId);
    throw problem;
  }
  try {
    await replaceLocalWorkspace(ownerId, snapshot.items, snapshot.generation);
    clearLocalPractice(ownerId);
    clearSyncTime(ownerId);
    saveWorkspaceGeneration(ownerId, snapshot.generation);
    cancelLocalCleanup(ownerId);
  } catch { throw new WorkspaceResetIncompleteError(); }
}
