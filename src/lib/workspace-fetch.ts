import { api } from './api';
import type { WorkspaceItem } from './models';
import { isWorkspaceItem, workspaceItemKey } from './workspace';

export type WorkspaceResponse = { items: WorkspaceItem[]; serverTime: number; protocol: number; generation: number; backgroundsVersion?: string; backgroundsUnchanged?: boolean; nextCursor?: string | null; acknowledged?: boolean };
export type KnownWorkspaceBackgrounds = { version: string; items: WorkspaceItem[] };

// Never publish or replace local state until every page belongs to one complete snapshot.
export async function fetchWorkspace(owner: string, options: { signal?: AbortSignal; items?: WorkspaceItem[]; known?: KnownWorkspaceBackgrounds; generation?: number } = {}): Promise<WorkspaceResponse> {
  const { signal, items, known, generation } = options;
  let cursor: string | undefined; let first: WorkspaceResponse | undefined;
  const seenCursors = new Set<string>(); const seenItems = new Set<string>(); const collected: WorkspaceItem[] = [];
  do {
    const headers: Record<string, string> = { 'X-Workspace-Owner': owner, 'X-Workspace-Backgrounds': known?.version ?? 'initial',
      'X-Workspace-Protocol': '2', 'X-Workspace-Capabilities': 'local-conflict-v2', 'X-Workspace-Paged': '1', 'X-Workspace-Background-References': '1' };
    if (cursor) headers['X-Workspace-Cursor'] = cursor;
    const data = await api<WorkspaceResponse>(items === undefined ? '/api/workspace' : '/api/workspace/sync', {
      method: items === undefined ? 'GET' : 'POST', timeoutMs: 60_000,
      body: items === undefined ? undefined : { generation, items: items.map(({ serverRevision, baseUpdatedAt: _baseTime, baseRevision: _baseRevision, clientGeneration: _clientGeneration, localFallback: _localFallback, localConflict: _localConflict, localConflictBase: _localConflictBase, ...item }) => ({ ...item, baseRevision: serverRevision ?? 0 })) },
      headers, signal,
    });
    if (!Number.isSafeInteger(data.serverTime) || data.serverTime <= 0 || data.protocol !== 2 || !Number.isSafeInteger(data.generation) || data.generation < 1) throw new Error('同步数据无法读取');
    if (data.acknowledged && items !== undefined) {
      if (generation !== data.generation) throw new Error('同步数据已变更，请重试');
      return fetchWorkspace(owner, { signal, known, generation });
    }
    if (!Array.isArray(data.items) || data.items.length > 4100 || !data.items.every(isWorkspaceItem) || data.items.some((item) => item.serverRevision === undefined)) throw new Error('同步数据无法读取');
    if (data.backgroundsVersion !== undefined && (typeof data.backgroundsVersion !== 'string' || !/^[a-f0-9]{64}$/.test(data.backgroundsVersion))) throw new Error('同步数据无法读取');
    if (first && (data.generation !== first.generation || data.backgroundsVersion !== first.backgroundsVersion || data.backgroundsUnchanged !== first.backgroundsUnchanged)) throw new Error('同步数据已变更，请重试');
    first ??= data;
    for (const item of data.items) {
      const key = workspaceItemKey(item);
      if (seenItems.has(key)) throw new Error('同步数据无法读取');
      seenItems.add(key); collected.push(item);
    }
    if (collected.length > 4100 || (data.nextCursor !== undefined && data.nextCursor !== null && (typeof data.nextCursor !== 'string' || !data.nextCursor || data.nextCursor.length > 2048))) throw new Error('同步数据无法读取');
    cursor = data.nextCursor ?? undefined;
    if (cursor && (items !== undefined || seenCursors.has(cursor) || seenCursors.size >= 4100)) throw new Error('同步数据无法读取');
    if (cursor) seenCursors.add(cursor);
    first.serverTime = Math.max(first.serverTime, data.serverTime);
  } while (cursor);
  if (!first) throw new Error('同步数据无法读取');
  if (first.backgroundsUnchanged) {
    if (!known || first.backgroundsVersion !== known.version || collected.some((item) => item.kind === 'background')) throw new Error('同步数据无法读取');
    collected.push(...known.items);
  }
  return { ...first, items: collected, nextCursor: null };
}
