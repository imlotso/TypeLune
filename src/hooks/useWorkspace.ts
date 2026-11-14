import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { localPracticeNeedsRecovery } from '../lib/local-practice-generation';
import { applyPresetAction, type PresetAction } from '../lib/practice-settings';
import type { MistakeStatus, ReaderSettings, SyncState, WorkspaceItem, WorkspaceKind, WorkspaceValues } from '../lib/models';
import {
  cachedWorkspace, chunkWorkspaceItems, deleteWorkspaceValue, isWorkspaceItem, mergeRemoteWorkspace, mutateWorkspaceValue,
  newerWorkspaceItems, putWorkspaceValue, readWorkspace, readWorkspaceGeneration, saveWorkspaceGeneration, subscribeWorkspace, workspaceGenerationKey, workspaceItemKey, workspaceRecoveryReason, WorkspaceMergeConflictError, workspaceSettings, workspaceValue,
} from '../lib/workspace';

const pollMs = 30_000;
const debounceMs = 1000;
const emptyItems: WorkspaceItem[] = [];
const syncTimeKey = (owner: string) => `cloudtyping.sync.last-success.v1.${owner}`;
function readSyncTime(owner: string | null) {
  if (!owner) return null;
  try { const value = Number(localStorage.getItem(syncTimeKey(owner))); return Number.isSafeInteger(value) && value > 0 ? value : null; }
  catch { return null; }
}
function saveSyncTime(owner: string, time: number) {
  try { localStorage.setItem(syncTimeKey(owner), String(time)); } catch { /* The current view still has the time. */ }
}
export function clearSyncTime(owner: string) { localStorage.removeItem(syncTimeKey(owner)); localStorage.removeItem(workspaceGenerationKey(owner)); }

type View = {
  ownerId: string | null;
  ready: boolean;
  cloudLoaded: boolean;
  items: WorkspaceItem[];
  syncState: SyncState;
  error: string;
  lastSyncedAt: number | null;
  pendingCount: number | null;
  cloudCount: number | null;
  recoveryReason: 'generation' | 'conflict' | null;
};
type Response = { items: WorkspaceItem[]; serverTime: number; protocol: number; generation: number; backgroundsVersion?: string; backgroundsUnchanged?: boolean };
type KnownBackgrounds = { version: string; items: WorkspaceItem[] };

async function workspaceRequest(owner: string, signal: AbortSignal, items?: WorkspaceItem[], known?: KnownBackgrounds, generation?: number): Promise<Response> {
  const data = await api<Response>(items === undefined ? '/api/workspace' : '/api/workspace/sync', {
    method: items === undefined ? 'GET' : 'POST',
    body: items === undefined ? undefined : { generation, items: items.map(({ serverRevision, baseUpdatedAt: _baseTime, baseRevision: _baseRevision, clientGeneration: _clientGeneration, localFallback: _localFallback, ...item }) => ({ ...item, baseRevision: serverRevision ?? 0 })) },
    headers: { 'X-Workspace-Owner': owner, 'X-Workspace-Backgrounds': known?.version ?? 'initial', 'X-Workspace-Protocol': '2' },
    signal,
  });
  if (!Array.isArray(data.items) || data.items.length > 2000 || !data.items.every(isWorkspaceItem) ||
    !Number.isSafeInteger(data.serverTime) || data.serverTime <= 0 || data.protocol !== 2 || !Number.isSafeInteger(data.generation) || data.generation < 1 ||
    data.items.some((item) => item.serverRevision === undefined)) {
    throw new Error('同步数据无法读取');
  }
  if (data.backgroundsVersion !== undefined && (typeof data.backgroundsVersion !== 'string' || !/^[a-f0-9]{64}$/.test(data.backgroundsVersion))) throw new Error('同步数据无法读取');
  if (data.backgroundsUnchanged) {
    if (!known || data.backgroundsVersion !== known.version || data.items.some((item) => item.kind === 'background')) throw new Error('同步数据无法读取');
    return { ...data, items: [...data.items, ...known.items] };
  }
  return data;
}

export function useWorkspace(ownerId: string | null, enabled = true) {
  const [view, setView] = useState<View>(() => ({
    ownerId, ready: false, cloudLoaded: false, items: emptyItems, syncState: ownerId ? 'loading' : 'guest', error: '', lastSyncedAt: readSyncTime(ownerId), pendingCount: null, cloudCount: null, recoveryReason: null,
  }));
  const lifecycle = useRef<{ ownerId: string | null; sync: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const { signal } = controller;
    const cached = cachedWorkspace(ownerId);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running: Promise<void> | undefined;
    let lastStartedAt = -Infinity;
    let pendingWrite = false;
    let localGeneration = 0;
    let recoveryRequired = false;
    let generation: number | undefined;
    let lastCloud: WorkspaceItem[] | undefined;
    let knownBackgrounds: KnownBackgrounds | undefined;
    const requestWorkspace = async (items?: WorkspaceItem[]) => {
      const response = await workspaceRequest(ownerId!, signal, items, knownBackgrounds, generation);
      if (!signal.aborted) {
        lastCloud = response.items;
        publish({ cloudCount: response.items.filter((item) => !item.deleted).length });
        knownBackgrounds = response.backgroundsVersion
          ? { version: response.backgroundsVersion, items: response.items.filter((item) => item.kind === 'background') }
          : undefined;
      }
      return response;
    };
    setView({ ownerId, ready: !!cached, cloudLoaded: false, items: cached ?? emptyItems, syncState: ownerId ? 'loading' : 'guest', error: '', lastSyncedAt: readSyncTime(ownerId), pendingCount: null, cloudCount: null, recoveryReason: null });

    const publish = (patch: Partial<View>) => {
      if (!signal.aborted) setView((current) => current.ownerId === ownerId ? { ...current, ...patch } : current);
    };
    const failed = (error: unknown, pendingCount: number | null = null) => publish({
      syncState: 'error',
      error: error instanceof Error ? error.message : '同步失败',
      pendingCount,
    });
    const refresh = async () => {
      try {
        const items = await readWorkspace(ownerId);
        publish({ items, ready: true });
      } catch (error) {
        publish({ ready: true });
        failed(error);
      }
    };
    const schedule = (items?: WorkspaceItem[], preserveCount = false) => {
      if (!ownerId || signal.aborted) return;
      if (recoveryRequired) return;
      pendingWrite = true;
      publish({ syncState: 'syncing', error: '', ...(preserveCount ? {} : { pendingCount: items && lastCloud ? newerWorkspaceItems(items, lastCloud).length : null }) });
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!running) void sync();
      }, debounceMs);
    };
    const quarantined = new Map<string, { updatedAt: number; reason: string }>();
    const sync = (retry = false) => {
      if (!ownerId || signal.aborted) return Promise.resolve();
      if (recoveryRequired) return Promise.resolve();
      if (running) return running;
      if (retry) quarantined.clear();
      lastStartedAt = performance.now();
      pendingWrite = false;
      clearTimeout(timer);
      publish({ syncState: 'syncing', error: '' });
      running = (async () => {
        try {
          const beforeRequest = await readWorkspace(ownerId);
          let cloud = await requestWorkspace();
          if (signal.aborted) return;
          const existing = await readWorkspace(ownerId);
          const knownGeneration = readWorkspaceGeneration(ownerId);
          const reason = localPracticeNeedsRecovery(ownerId, knownGeneration, cloud.generation) ?? workspaceRecoveryReason(existing, cloud.items, knownGeneration, cloud.generation, beforeRequest);
          if (reason) {
            recoveryRequired = true; pendingWrite = false;
            publish({ syncState: 'error', recoveryReason: reason, pendingCount: null,
              error: reason === 'generation' ? '云端资料已整理，请先导出本机资料并重新同步' : '部分资料已在其他设备更改，请先保留本机资料' });
            return;
          }
          generation = cloud.generation;
          if (knownGeneration !== generation) saveWorkspaceGeneration(ownerId, generation);
          const local = await mergeRemoteWorkspace(ownerId, cloud.items, cloud.serverTime, signal, true, beforeRequest, generation);
          publish({ cloudLoaded: true });
          const upload = async (remaining: Set<string>): Promise<void> => {
            if (signal.aborted) return;
            if (localPracticeNeedsRecovery(ownerId, readWorkspaceGeneration(ownerId), cloud.generation)) throw new WorkspaceMergeConflictError();
            // A local edit or deletion can land while another chunk is in flight.
            const latest = await readWorkspace(ownerId);
            if (signal.aborted) return;
            const pending = newerWorkspaceItems(latest, cloud.items).filter((item) => {
              const key = workspaceItemKey(item);
              return remaining.has(key) && quarantined.get(key)?.updatedAt !== item.updatedAt;
            });
            const [batch] = chunkWorkspaceItems(pending, (item) => {
              const key = workspaceItemKey(item);
              quarantined.set(key, { updatedAt: item.updatedAt, reason: '单项超过同步大小' });
              remaining.delete(key);
            });
            if (!batch) { remaining.clear(); return; }
            for (const item of batch) remaining.delete(workspaceItemKey(item));
            try {
              cloud = await requestWorkspace(batch);
            } catch (error) {
              if (!(error instanceof ApiError) || error.status !== 400) throw error;
              if (batch.length === 1) {
                const item = batch[0];
                quarantined.set(workspaceItemKey(item), { updatedAt: item.updatedAt, reason: '服务端校验未通过' });
                return;
              }
              const midpoint = Math.floor(batch.length / 2);
              for (const half of [batch.slice(0, midpoint), batch.slice(midpoint)]) {
                const keys = new Set(half.map(workspaceItemKey));
                while (keys.size && !signal.aborted) await upload(keys);
              }
              return;
            }
            if (!signal.aborted) await mergeRemoteWorkspace(ownerId, cloud.items, cloud.serverTime, signal, true, batch, generation);
          };
          const remaining = new Set(newerWorkspaceItems(local, cloud.items).map(workspaceItemKey));
          while (remaining.size && !signal.aborted) await upload(remaining);
          if (signal.aborted) return;
          const observedGeneration = localGeneration;
          const latest = await readWorkspace(ownerId);
          const changedDuringRead = observedGeneration !== localGeneration;
          const outstanding = newerWorkspaceItems(latest, cloud.items);
          const rejected = outstanding.filter((item) =>
            quarantined.get(workspaceItemKey(item))?.updatedAt === item.updatedAt);
          if (rejected.length) {
            pendingWrite = changedDuringRead;
            const reasons = [...new Set(rejected.map((item) => quarantined.get(workspaceItemKey(item))?.reason).filter(Boolean))].join('、');
            failed(new Error(`${rejected.length} 项资料无法同步（${reasons}），已保存在本机`), outstanding.length);
          } else if (outstanding.length || changedDuringRead) {
            pendingWrite = true;
            publish({ syncState: 'syncing', pendingCount: outstanding.length });
          } else {
            pendingWrite = false;
            saveSyncTime(ownerId, cloud.serverTime);
            publish({ syncState: 'synced', error: '', pendingCount: 0, lastSyncedAt: cloud.serverTime });
          }
        } catch (error) {
          if ((error instanceof ApiError && (error.code === 'SYNC_RESYNC_REQUIRED' || error.code === 'SYNC_CONFLICT')) || error instanceof WorkspaceMergeConflictError) {
            recoveryRequired = true; pendingWrite = false;
            publish({ syncState: 'error', recoveryReason: error instanceof ApiError && error.code === 'SYNC_RESYNC_REQUIRED' ? 'generation' : 'conflict', pendingCount: null, error: error.message });
            return;
          }
          const latest = await readWorkspace(ownerId).catch(() => undefined);
          failed(error, latest && lastCloud ? newerWorkspaceItems(latest, lastCloud).length : null);
        } finally {
          running = undefined;
          if (pendingWrite) schedule(undefined, true);
        }
      })();
      return running;
    };
    const unsubscribe = subscribeWorkspace(ownerId, (local, items) => {
      if (items) publish({ items, ready: true });
      else void refresh();
      if (local) { localGeneration++; schedule(items); }
    });
    lifecycle.current = { ownerId, sync: () => sync(true) };
    void refresh().then(() => sync());
    const poll = () => {
      if (performance.now() - lastStartedAt >= pollMs) void sync();
    };
    const interval = ownerId ? setInterval(poll, pollMs) : undefined;
    if (ownerId) window.addEventListener('focus', poll);
    return () => {
      controller.abort();
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener('focus', poll);
      lifecycle.current = null;
    };
  }, [enabled, ownerId]);

  const put = useCallback(<K extends WorkspaceKind>(kind: K, id: string, value: WorkspaceValues[K]) =>
    putWorkspaceValue(ownerId, kind, id, value), [ownerId]);
  const remove = useCallback((kind: WorkspaceKind, id: string) =>
    deleteWorkspaceValue(ownerId, kind, id), [ownerId]);
  const settingsAvailable = !ownerId || (view.ownerId === ownerId && (view.cloudLoaded || view.syncState === 'error' || workspaceValue(view.items, 'settings', 'preferences') !== undefined));
  const updateSettings = useCallback((patch: Partial<ReaderSettings>) => {
    if (!settingsAvailable) return Promise.reject(new Error('账号设置尚未读取'));
    return mutateWorkspaceValue(ownerId, 'settings', 'preferences', (_saved, items) => ({ ...workspaceSettings(items), ...patch }));
  }, [ownerId, settingsAvailable]);
  const ensureStatisticsTimezone = useCallback((timeZone: string) => {
    if (!settingsAvailable) return Promise.reject(new Error('账号设置尚未读取'));
    return mutateWorkspaceValue(ownerId, 'settings', 'preferences', (saved, items) => saved?.statisticsTimezone ? saved : { ...workspaceSettings(items), statisticsTimezone: timeZone });
  }, [ownerId, settingsAvailable]);
  const toggleFavorite = useCallback((id: string) =>
    mutateWorkspaceValue(ownerId, 'favorite', id, (old) => old ? undefined : { articleId: id }), [ownerId]);
  const updateMistakeState = useCallback((id: string, status?: MistakeStatus) => {
    if (!settingsAvailable) return Promise.reject(new Error('账号设置尚未读取'));
    if (!id || id.length > 512) return Promise.reject(new Error('错字过长，无法标记状态'));
    return mutateWorkspaceValue(ownerId, 'settings', 'preferences', (_saved, items) => {
      const settings = workspaceSettings(items); const mistakeStates = { ...settings.mistakeStates };
      if (status) mistakeStates[id] = status; else delete mistakeStates[id];
      if (Object.keys(mistakeStates).length > 2000) throw new Error('错字状态已达上限');
      return { ...settings, mistakeStates };
    });
  }, [ownerId, settingsAvailable]);
  const changePresets = useCallback((action: PresetAction) => {
    if (!settingsAvailable) return Promise.reject(new Error('账号设置尚未读取'));
    return mutateWorkspaceValue(ownerId, 'settings', 'preferences', (_saved, items) => {
      const settings = workspaceSettings(items);
      return { ...settings, presets: applyPresetAction(settings.presets ?? [], action) };
    });
  }, [ownerId, settingsAvailable]);
  const sync = useCallback(() =>
    enabled && lifecycle.current?.ownerId === ownerId ? lifecycle.current.sync() : Promise.resolve(), [enabled, ownerId]);

  const visible = enabled && view.ownerId === ownerId ? view : undefined;
  const items = visible?.items ?? emptyItems;
  const values = useMemo(() => {
    const active = items.filter((item) => !item.deleted);
    const get = <K extends WorkspaceKind>(kind: K) => active.filter((item) => item.kind === kind).map((item) => item.value as WorkspaceValues[K]);
    return {
      settings: workspaceSettings(items),
      hasSavedSettings: workspaceValue(items, 'settings', 'preferences') !== undefined,
      backgrounds: { light: workspaceValue(items, 'background', 'light'), dark: workspaceValue(items, 'background', 'dark') },
      favorites: get('favorite').map((favorite) => favorite.articleId),
      privateArticles: get('article'),
      drafts: get('draft').sort((a, b) => b.savedAt - a.savedAt),
      deletedDraftIds: items.filter((item) => item.kind === 'draft' && item.deleted).map((item) => item.id) as readonly string[],
      deletedRecordIds: items.filter((item) => item.kind === 'record' && item.deleted).map((item) => item.id) as readonly string[],
      records: get('record').sort((a, b) => b.finishedAt - a.finishedAt),
    };
  }, [items, ownerId, visible?.ready]);

  return {
    ...values,
    ready: visible?.ready ?? false,
    settingsReady: !!visible?.ready && (!ownerId || visible.cloudLoaded || visible.syncState === 'error' || values.hasSavedSettings),
    cloudLoaded: visible?.cloudLoaded ?? false,
    syncState: visible?.syncState ?? (ownerId ? 'loading' : 'guest'),
    error: visible?.error ?? '',
    lastSyncedAt: visible?.lastSyncedAt ?? null,
    pendingCount: visible?.pendingCount ?? null,
    cloudCount: visible?.cloudCount ?? null,
    recoveryReason: visible?.recoveryReason ?? null,
    put, remove, updateSettings, ensureStatisticsTimezone, updateMistakeState, changePresets, toggleFavorite, sync,
  };
}
