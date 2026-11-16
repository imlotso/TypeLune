import { defaultPace, defaultSettings, sameDraftSnapshot, type ReaderSettings, type SavedPractice, type WorkspaceItem, type WorkspaceKind, type WorkspaceValues } from './models.js';
import { themeStorageKey } from './theme.js';
import { isBackgroundConfig } from './background.js';
import { isPresetList } from './practice-settings.js';
import { isPaceSettings } from './pace.js';
import { isStatisticsTimeZone } from './long-term-stats.js';
import { isProcessTrace } from './process-trace.js';
import { legacyConflictId, normalizeWorkspaceRecord } from './records.js';

const databaseName = 'cloudtyping-workspace';
const itemStore = 'items';
const storagePrefix = 'cloudtyping.workspace.v1.';
const maxChunkBytes = 3 * 1024 * 1024;
const maxChunkItems = 100;
const queues = new Map<string, Promise<unknown>>();
const clocks = new Map<string, { serverTime: number; observedAt: number }>();
const caches = new Map<string, WorkspaceItem[]>();
const listeners = new Set<(owner: string, local: boolean, items?: WorkspaceItem[]) => void>();
const blockedAccounts = new Set<string>();
export const localAccountBlockPrefix = 'cloudtyping.account-blocked.v1.';
const guestBlockKey = 'cloudtyping.guest-blocked.v1';
const guestBlockMs = 60_000;
type GuestBlock = { token: string; expiresAt: number };
function readGuestBlock(): GuestBlock | undefined {
  try {
    const raw = localStorage.getItem(guestBlockKey);
    if (!raw) return undefined;
    const block = JSON.parse(raw) as Partial<GuestBlock>;
    return typeof block.token === 'string' && typeof block.expiresAt === 'number' && block.expiresAt > Date.now() ? block as GuestBlock : undefined;
  } catch { return undefined; }
}
export const workspaceGenerationKey = (owner: string) => `cloudtyping.workspace.generation.v2.${owner}`;
export function readWorkspaceGeneration(owner: string) {
  const raw = localStorage.getItem(workspaceGenerationKey(owner));
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('本机同步代次无法读取');
  return value;
}
export function saveWorkspaceGeneration(owner: string, generation: number) { localStorage.setItem(workspaceGenerationKey(owner), String(generation)); }
let database: Promise<IDBDatabase | null> | undefined;
let channel: BroadcastChannel | undefined;

const scope = (ownerId: string | null) => ownerId === null ? 'guest' : 'user:' + ownerId;
export function isLocalAccountBlocked(ownerId: string | null) {
  if (!ownerId) {
    return !!readGuestBlock();
  }
  try { return blockedAccounts.has(ownerId) || localStorage.getItem(localAccountBlockPrefix + ownerId) === '1'; }
  catch { return blockedAccounts.has(ownerId); }
}
export function blockGuestWorkspace() {
  if (readGuestBlock()) throw new Error('其他页面正在清理游客资料');
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(guestBlockKey, JSON.stringify({ token, expiresAt: Date.now() + guestBlockMs }));
  if (!ownsGuestWorkspaceBlock(token)) throw new Error('无法保护游客资料');
  caches.delete(scope(null));
  return token;
}
export function ownsGuestWorkspaceBlock(token: string) { return readGuestBlock()?.token === token; }
export function allowGuestWorkspace(token: string) { if (readGuestBlock()?.token === token) localStorage.removeItem(guestBlockKey); }
export function blockLocalAccount(ownerId: string) {
  localStorage.setItem(localAccountBlockPrefix + ownerId, '1');
  blockedAccounts.add(ownerId);
  caches.delete(scope(ownerId));
}
export function allowLocalAccount(ownerId: string) {
  try { localStorage.removeItem(localAccountBlockPrefix + ownerId); } catch { /* Login still works if local storage is unavailable. */ }
  blockedAccounts.delete(ownerId);
}
export const workspaceItemKey = ({ kind, id }: Pick<WorkspaceItem, 'kind' | 'id'>) => kind + ':' + id;
const keyOf = workspaceItemKey;

const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const isLanguage = (value: unknown) => value === 'zh' || value === 'en';
const isDifficulty = (value: unknown) => ['beginner', 'intermediate', 'advanced'].includes(value as string);
const isMode = (value: unknown) => value === 'timed' || value === 'article';
const isTheme = (value: unknown) => value === 'light' || value === 'dark';
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isArticle = (value: unknown) => isObject(value) && typeof value.id === 'string' &&
  typeof value.title === 'string' && typeof value.text === 'string' &&
  isLanguage(value.language) && isDifficulty(value.difficulty) && typeof value.custom === 'boolean';

export function isWorkspaceItem(value: unknown): value is WorkspaceItem {
  if (!isObject(value)) return false;
  const { kind, id, updatedAt, deleted, value: payload, serverRevision, baseRevision, baseUpdatedAt, clientGeneration, localFallback, localConflict, localConflictBase } = value;
  if (!['favorite', 'article', 'draft', 'record', 'settings', 'background'].includes(kind as string) ||
    typeof id !== 'string' || !id || typeof updatedAt !== 'number' || !Number.isSafeInteger(updatedAt) || updatedAt < 0 ||
    (deleted !== undefined && typeof deleted !== 'boolean') ||
    (serverRevision !== undefined && (!Number.isSafeInteger(serverRevision) || (serverRevision as number) < 1)) ||
    (baseRevision !== undefined && (!Number.isSafeInteger(baseRevision) || (baseRevision as number) < 0)) ||
    (baseUpdatedAt !== undefined && (!Number.isSafeInteger(baseUpdatedAt) || (baseUpdatedAt as number) < 0)) ||
    (clientGeneration !== undefined && (!Number.isSafeInteger(clientGeneration) || (clientGeneration as number) < 1)) ||
    (localFallback !== undefined && typeof localFallback !== 'boolean') ||
    (localConflict !== undefined && (typeof localConflict !== 'boolean' || (localConflict && (kind !== 'record' || deleted !== true)))) ||
    (localConflictBase !== undefined && (localConflict !== true || typeof localConflictBase !== 'string' || !/^legacy-conflict-[a-f0-9]{64}$/u.test(localConflictBase)))) return false;
  if (kind === 'background' && !isTheme(id)) return false;
  if (deleted) return true;
  if (!isObject(payload)) return false;
  if ((kind === 'draft' || kind === 'record') && payload.mistakesTruncated !== undefined && typeof payload.mistakesTruncated !== 'boolean') return false;
  if ((kind === 'draft' || kind === 'record') && payload.paceTarget !== undefined && (typeof payload.paceTarget !== 'number' || !Number.isFinite(payload.paceTarget) || payload.paceTarget <= 0 || payload.paceTarget > 18_000_000)) return false;
  if ((kind === 'draft' || kind === 'record') && payload.processTrace !== undefined && !isProcessTrace(payload.processTrace)) return false;
  if (kind === 'draft' && payload.processErrorEvents !== undefined && (!Number.isSafeInteger(payload.processErrorEvents) || (payload.processErrorEvents as number) < 0 || (payload.processErrorEvents as number) > 10_000_000 ||
    (isProcessTrace(payload.processTrace) && (payload.processErrorEvents as number) < payload.processTrace.samples.at(-1)!.errors))) return false;
  switch (kind) {
    case 'background': return isBackgroundConfig(payload);
    case 'favorite': return payload.articleId === id;
    case 'article': return payload.id === id && payload.custom === true && isArticle(payload);
    case 'draft': return payload.id === id && isArticle(payload.article) &&
      typeof payload.typed === 'string' && typeof payload.recordId === 'string' &&
      typeof payload.offline === 'boolean' && typeof payload.strict === 'boolean' && isMode(payload.mode) &&
      [payload.duration, payload.elapsedMs, payload.offset, payload.backspaces, payload.savedAt].every(isNumber);
    case 'record': return isLanguage(payload.language) && isDifficulty(payload.difficulty) &&
      [payload.speed, payload.accuracy, payload.duration, payload.finishedAt].every(isNumber) &&
      (payload.article === undefined || isArticle(payload.article)) &&
      (payload.typed === undefined || typeof payload.typed === 'string');
    case 'settings': return Number.isInteger(payload.minutes) && isTheme(payload.theme) && isMode(payload.mode) &&
      (payload.wallpapers === undefined || (isObject(payload.wallpapers) && Object.entries(payload.wallpapers).every(([key, value]) => ['light','dark'].includes(key) && ['off','nature','portrait'].includes(String(value))))) &&
      (payload.uiLocale === undefined || payload.uiLocale === 'auto' || payload.uiLocale === 'zh' || payload.uiLocale === 'en') &&
      typeof payload.autoPause === 'boolean' && typeof payload.strict === 'boolean' &&
      [payload.fontSize, payload.lineHeight, payload.visibleLines].every(isNumber) &&
      ['showTimer', 'showSpeed', 'showAccuracy', 'shortcutsEnabled'].every((key) => payload[key] === undefined || typeof payload[key] === 'boolean') &&
      (payload.presets === undefined || isPresetList(payload.presets)) &&
      (payload.pace === undefined || isPaceSettings(payload.pace)) &&
      (payload.statisticsTimezone === undefined || isStatisticsTimeZone(payload.statisticsTimezone)) &&
      (payload.dailyGoalMinutes === undefined || (Number.isInteger(payload.dailyGoalMinutes) && (payload.dailyGoalMinutes as number) >= 0 && (payload.dailyGoalMinutes as number) <= 1440)) &&
      (payload.mistakeStates === undefined || (isObject(payload.mistakeStates) && Object.keys(payload.mistakeStates).length <= 2000 &&
        Object.entries(payload.mistakeStates).every(([key, state]) => key.length > 0 && key.length <= 512 && (state === 'mastered' || state === 'ignored'))));
    default: return false;
  }
}

function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).filter((key) => key !== 'claimId' && key !== 'recoveryRequestId').sort().map((key) => [key, comparable(value[key])]));
}
export function sameWorkspaceValue(kind: WorkspaceKind, a: unknown, b: unknown) {
  const normalize = (value: unknown) => kind === 'settings' && isObject(value) ? { ...value,
    showTimer: value.showTimer !== false, showSpeed: value.showSpeed !== false, showAccuracy: value.showAccuracy !== false,
    mistakeStates: value.mistakeStates ?? {}, presets: value.presets ?? [], pace: value.pace ?? defaultPace, shortcutsEnabled: value.shortcutsEnabled !== false } : value;
  return JSON.stringify(comparable(normalize(a))) === JSON.stringify(comparable(normalize(b)));
}
function samePayload(a: WorkspaceItem, b: WorkspaceItem) {
  return a.updatedAt === b.updatedAt && !!a.deleted === !!b.deleted && JSON.stringify(comparable(a.value)) === JSON.stringify(comparable(b.value));
}
export function workspaceRecoveryReason(local: WorkspaceItem[], remote: WorkspaceItem[], knownGeneration: number | null, serverGeneration: number, baseline: WorkspaceItem[] = []): 'generation' | 'conflict' | null {
  if (local.length && ((knownGeneration !== null && knownGeneration !== serverGeneration) || (knownGeneration === null && serverGeneration > 1))) return 'generation';
  if (knownGeneration !== null && local.some((item) => item.clientGeneration !== knownGeneration)) return 'conflict';
  const cloud = new Map(remote.map((item) => [keyOf(item), item]));
  const before = new Map(baseline.map((item) => [keyOf(item), item]));
  for (const item of local) {
    const current = cloud.get(keyOf(item));
    if (!current) { if (item.serverRevision !== undefined) return 'conflict'; continue; }
    if (samePayload(item, current)) continue;
    const previous = before.get(keyOf(item));
    if (previous && samePayload(previous, current) && (item.serverRevision ?? 0) === (previous.serverRevision ?? 0)) continue;
    if (item.serverRevision === undefined || item.baseUpdatedAt === undefined) return 'conflict';
    const dirty = item.updatedAt !== item.baseUpdatedAt;
    if (dirty && item.serverRevision !== current.serverRevision) return 'conflict';
  }
  return null;
}

function replacesItem(previous: WorkspaceItem | undefined, incoming: WorkspaceItem, includeTies: boolean) {
  if (!previous) return true;
  if (incoming.kind === 'draft' && !!incoming.deleted !== !!previous.deleted) return !!incoming.deleted;
  if (incoming.kind === 'draft' && !incoming.deleted && !previous.deleted && isObject(incoming.value) && isObject(previous.value)) {
    const incomingClaim = typeof incoming.value.claimVersion === 'number' ? incoming.value.claimVersion : 0;
    const previousClaim = typeof previous.value.claimVersion === 'number' ? previous.value.claimVersion : 0;
    if (incomingClaim !== previousClaim) return incomingClaim > previousClaim;
    const incomingProgress = incoming.value.progressVersion;
    const previousProgress = previous.value.progressVersion;
    const incomingStale = typeof incoming.value.recoveryMarker === 'string' && incoming.value.recoveryMarker !== previous.value.recoveryMarker && typeof previousProgress === 'number' &&
      (typeof incoming.value.recoveryBaseVersion === 'number' ? incoming.value.recoveryBaseVersion : 0) < previousProgress;
    const previousStale = typeof previous.value.recoveryMarker === 'string' && previous.value.recoveryMarker !== incoming.value.recoveryMarker && typeof incomingProgress === 'number' &&
      (typeof previous.value.recoveryBaseVersion === 'number' ? previous.value.recoveryBaseVersion : 0) < incomingProgress;
    if (incomingStale) return previousStale && includeTies;
    if (previousStale) return true;
    if (typeof incomingProgress === 'number' && typeof previousProgress === 'number' && incomingProgress !== previousProgress) return incomingProgress > previousProgress;
  }
  return incoming.updatedAt > previous.updatedAt || (includeTies && incoming.updatedAt === previous.updatedAt);
}

export function mergeWorkspaceItems(local: WorkspaceItem[], incoming: WorkspaceItem[]): WorkspaceItem[] {
  const merged = new Map(local.map((item) => [keyOf(item), item]));
  for (const item of incoming) {
    const key = keyOf(item);
    const previous = merged.get(key);
    if (replacesItem(previous, item, true)) merged.set(key, item);
  }
  return [...merged.values()];
}

export function newerWorkspaceItems(local: WorkspaceItem[], remote: WorkspaceItem[]): WorkspaceItem[] {
  const server = new Map(remote.map((item) => [keyOf(item), item]));
  return local.filter((item) => replacesItem(server.get(keyOf(item)), item, false));
}

export function chunkWorkspaceItems(
  items: WorkspaceItem[], onOversized?: (item: WorkspaceItem) => void,
): WorkspaceItem[][] {
  const encoder = new TextEncoder();
  const envelopeBytes = encoder.encode(JSON.stringify({ items: [] })).byteLength;
  const chunks: WorkspaceItem[][] = [];
  let chunk: WorkspaceItem[] = [];
  let bytes = envelopeBytes;
  for (const item of items) {
    const size = encoder.encode(JSON.stringify(item)).byteLength;
    if (size + envelopeBytes > maxChunkBytes) {
      if (!onOversized) throw new Error('同步项目超过大小限制');
      onOversized(item);
      continue;
    }
    if (chunk.length === maxChunkItems || bytes + size + (chunk.length ? 1 : 0) > maxChunkBytes) {
      chunks.push(chunk);
      chunk = [];
      bytes = envelopeBytes;
    }
    bytes += size + (chunk.length ? 1 : 0);
    chunk.push(item);
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}

type StoredItem = WorkspaceItem & { owner: string };
type Edit = (items: WorkspaceItem[]) => WorkspaceItem[];

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  database ??= new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(databaseName, 1); } catch { resolve(null); return; }
    request.onupgradeneeded = () => {
      request.result.createObjectStore(itemStore, { keyPath: ['owner', 'kind', 'id'] }).createIndex('owner', 'owner');
    };
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = undefined; };
      resolve(db);
    };
  });
  return database;
}

function readFallback(owner: string): WorkspaceItem[] {
  const raw = localStorage.getItem(storagePrefix + owner);
  if (!raw) return [];
  const result: unknown = JSON.parse(raw);
  if (!Array.isArray(result) || !result.every(isWorkspaceItem)) throw new Error('本地练习资料无法读取');
  return result;
}

async function access(owner: string, edit?: Edit): Promise<WorkspaceItem[]> {
  const db = await openDatabase();
  if (!db) {
    const current = readFallback(owner);
    if (!edit) return current;
    const next = edit(current);
    if (next !== current) localStorage.setItem(storagePrefix + owner, JSON.stringify(next));
    return next;
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(itemStore, edit ? 'readwrite' : 'readonly');
    const store = transaction.objectStore(itemStore);
    const request = store.index('owner').getAll(owner);
    let next: WorkspaceItem[];
    let editError: unknown;
    transaction.oncomplete = () => resolve(next);
    transaction.onabort = () => reject(editError ?? transaction.error ?? new Error('本地练习资料保存失败'));
    request.onsuccess = () => {
      const current = (request.result as StoredItem[]).map(({ owner: _owner, ...item }) => item);
      try {
        next = edit?.(current) ?? current;
        if (!edit || next === current) return;
        const previous = new Map(current.map((item) => [keyOf(item), item]));
        for (const item of next) {
          if (previous.get(keyOf(item)) !== item) store.put({ ...item, owner });
        }
      } catch (error) {
        editError = error;
        transaction.abort();
      }
    };
  });
}

function serialized<T>(owner: string, operation: () => Promise<T>): Promise<T> {
  const pending = (queues.get(owner) ?? Promise.resolve()).catch(() => {}).then(operation);
  queues.set(owner, pending);
  const remove = () => { if (queues.get(owner) === pending) queues.delete(owner); };
  void pending.then(remove, remove);
  return pending;
}

function broadcastChannel() {
  if (typeof indexedDB === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  if (!channel) {
    try {
      channel = new BroadcastChannel(databaseName);
      channel.onmessage = ({ data }) => {
        if (typeof data?.owner === 'string' && typeof data.local === 'boolean') {
          caches.delete(data.owner);
          for (const listener of listeners) listener(data.owner, data.local);
        }
      };
    } catch { /* The current tab still receives updates. */ }
  }
  return channel;
}

export function subscribeWorkspace(ownerId: string | null, listener: (local: boolean, items?: WorkspaceItem[]) => void) {
  const owner = scope(ownerId);
  let guestExpiry: ReturnType<typeof setTimeout> | undefined;
  const notify = (changedOwner: string, local: boolean, items?: WorkspaceItem[]) => {
    if (owner === changedOwner) listener(local, items);
  };
  const onStorage = (event: StorageEvent) => {
    if (ownerId === null && event.key === guestBlockKey) {
      caches.delete(owner);
      clearTimeout(guestExpiry);
      const block = readGuestBlock();
      listener(false, block ? [] : undefined);
      if (block) guestExpiry = setTimeout(() => { caches.delete(owner); listener(false); }, Math.max(0, block.expiresAt - Date.now()) + 10);
      return;
    }
    if (ownerId && event.key === localAccountBlockPrefix + ownerId && event.newValue === '1') {
      caches.delete(owner);
      listener(false, []);
      return;
    }
    if (event.key === storagePrefix + owner || event.key === null) {
      caches.delete(owner);
      listener(true);
    }
  };
  listeners.add(notify);
  broadcastChannel();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(notify);
    clearTimeout(guestExpiry);
    window.removeEventListener('storage', onStorage);
    if (!listeners.size) { channel?.close(); channel = undefined; }
  };
}

export function readWorkspace(ownerId: string | null): Promise<WorkspaceItem[]> {
  const owner = scope(ownerId);
  return serialized(owner, async () => {
    if (isLocalAccountBlocked(ownerId)) return [];
    const items = await access(owner);
    if (typeof indexedDB !== 'undefined') caches.set(owner, items);
    return items;
  });
}

export function readBlockedWorkspace(ownerId: string | null): Promise<WorkspaceItem[]> {
  const owner = scope(ownerId);
  return serialized(owner, async () => {
    if (!isLocalAccountBlocked(ownerId)) throw new Error('请先保护本机资料');
    return access(owner);
  });
}

export function cachedWorkspace(ownerId: string | null): WorkspaceItem[] | undefined {
  if (isLocalAccountBlocked(ownerId)) return [];
  return typeof indexedDB === 'undefined' ? undefined : caches.get(scope(ownerId));
}

export function isWorkspaceDraftDeleted(ownerId: string | null, id: string): boolean {
  try {
    const items = cachedWorkspace(ownerId) ?? readFallback(scope(ownerId));
    return items.some((item) => item.kind === 'draft' && item.id === id && item.deleted);
  } catch { return false; }
}
export function isWorkspaceFallbackDraft(ownerId: string | null, id: string): boolean {
  try {
    const items = cachedWorkspace(ownerId) ?? readFallback(scope(ownerId));
    return items.some((item) => item.kind === 'draft' && item.id === id && !item.deleted && item.localFallback === true);
  } catch { return false; }
}

export class DraftDeletedError extends Error {
  constructor(public readonly id: string) {
    super('此草稿已删除');
    this.name = 'DraftDeletedError';
  }
}
export class WorkspaceMergeConflictError extends Error {
  constructor() { super('部分资料已在其他设备更改，请先保留本机资料'); }
}

function mergeProtocolItems(local: WorkspaceItem[], incoming: WorkspaceItem[], acknowledged: WorkspaceItem[], generation: number) {
  const items = new Map(local.map((item) => [keyOf(item), item]));
  const sent = new Map(acknowledged.map((item) => [keyOf(item), item]));
  for (const remote of incoming) {
    const key = keyOf(remote); const current = items.get(key);
    // An older GET may finish after an explicit server-side deletion.
    if (current?.clientGeneration === generation && current.serverRevision !== undefined && remote.serverRevision !== undefined && current.serverRevision > remote.serverRevision) continue;
    const localLease = current?.kind === 'draft' && isObject(current.value) && isObject(remote.value) && samePayload(current, remote)
      ? { value: { ...remote.value, ...(typeof current.value.claimId === 'string' && { claimId: current.value.claimId }),
        ...(typeof current.value.recoveryRequestId === 'string' && { recoveryRequestId: current.value.recoveryRequestId }) } } : {};
    const cleanRemote = { ...remote, ...localLease, ...(current?.localFallback && samePayload(current, remote) && { localFallback: true }), baseUpdatedAt: remote.updatedAt, clientGeneration: generation };
    if (!current || samePayload(current, remote)) { items.set(key, cleanRemote); continue; }
    const dirty = current.baseUpdatedAt === undefined || current.updatedAt !== current.baseUpdatedAt;
    if (!dirty) { items.set(key, cleanRemote); continue; }
    if (current.serverRevision === remote.serverRevision) continue;
    const submitted = sent.get(key);
    if (submitted && samePayload(submitted, remote) && (current.serverRevision ?? 0) === (submitted.serverRevision ?? 0)) {
      items.set(key, { ...current, serverRevision: remote.serverRevision, baseUpdatedAt: remote.updatedAt, clientGeneration: generation });
      continue;
    }
    throw new WorkspaceMergeConflictError();
  }
  return [...items.values()].map((item) => item.clientGeneration === undefined ? { ...item, clientGeneration: generation } : item);
}

function editWorkspace(ownerId: string | null, edit: Edit, local: boolean): Promise<WorkspaceItem[]> {
  const owner = scope(ownerId);
  return serialized(owner, async () => {
    if (isLocalAccountBlocked(ownerId)) throw new Error('该账号的本机资料已清理');
    let changed = false;
    const items = await access(owner, (current) => {
      if (isLocalAccountBlocked(ownerId)) throw new Error('该账号的本机资料已清理');
      // Preserve the latest committed read for callers recovering from a rejected write.
      if (typeof indexedDB !== 'undefined') caches.set(owner, current);
      const next = edit(current);
      changed = next !== current;
      return next;
    });
    if (typeof indexedDB !== 'undefined') caches.set(owner, items);
    if (changed) {
      for (const listener of listeners) listener(owner, local, items);
      const broadcaster = broadcastChannel();
      broadcaster?.postMessage({ owner, local });
      if (!listeners.size) { broadcaster?.close(); channel = undefined; }
    }
    return items;
  });
}

export function workspaceFingerprint(items: readonly WorkspaceItem[]) {
  return JSON.stringify([...items].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)));
}

export function clearLocalWorkspace(ownerId: string | null, guestToken?: string, expected?: readonly WorkspaceItem[]): Promise<void> {
  const owner = scope(ownerId);
  return serialized(owner, async () => {
    if (guestToken && !ownsGuestWorkspaceBlock(guestToken)) throw new Error('游客资料保护已过期，请重试');
    const db = await openDatabase();
    if (!db) {
      if (expected && workspaceFingerprint(readFallback(owner)) !== workspaceFingerprint(expected)) throw new Error('本机资料已变化');
      localStorage.removeItem(storagePrefix + owner);
    } else {
      // IndexedDB can be changed by an older tab after the caller's check.
      // Compare and delete under the same read-write transaction.
      if (expected && localStorage.getItem(storagePrefix + owner) !== null) throw new Error('本机资料已变化');
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(itemStore, 'readwrite');
        const store = transaction.objectStore(itemStore);
        const request = store.index('owner').getAll(owner);
        let failure: Error | undefined;
        request.onsuccess = () => {
          const current = (request.result as StoredItem[]).map(({ owner: _owner, ...item }) => item);
          if ((guestToken && !ownsGuestWorkspaceBlock(guestToken)) || (expected && workspaceFingerprint(current) !== workspaceFingerprint(expected))) {
            failure = new Error('本机资料已变化'); transaction.abort(); return;
          }
          for (const item of current) store.delete([owner, item.kind, item.id]);
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('本机资料清理失败'));
        transaction.onerror = () => reject(failure ?? transaction.error ?? new Error('本机资料清理失败'));
      });
      if (!expected) localStorage.removeItem(storagePrefix + owner);
    }
    caches.delete(owner); clocks.delete(owner);
    for (const listener of listeners) listener(owner, false, []);
    const broadcaster = broadcastChannel();
    broadcaster?.postMessage({ owner, local: false });
    if (!listeners.size) { broadcaster?.close(); channel = undefined; }
  });
}

export function replaceLocalWorkspace(ownerId: string, items: WorkspaceItem[], generation: number): Promise<void> {
  const owner = scope(ownerId);
  if (!Number.isSafeInteger(generation) || generation < 1 || items.some((item) => !isWorkspaceItem(item) || item.serverRevision === undefined)) return Promise.reject(new Error('云端资料无法读取'));
  return serialized(owner, async () => {
    if (!isLocalAccountBlocked(ownerId)) throw new Error('请先保护本机资料');
    const replacement = items.map(({ baseRevision: _baseRevision, ...item }) => ({ ...item, baseUpdatedAt: item.updatedAt, clientGeneration: generation }));
    const db = await openDatabase();
    if (!db) localStorage.setItem(storagePrefix + owner, JSON.stringify(replacement));
    else {
      localStorage.removeItem(storagePrefix + owner);
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(itemStore, 'readwrite');
        const store = transaction.objectStore(itemStore);
        const request = store.index('owner').openKeyCursor(IDBKeyRange.only(owner));
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) { store.delete(cursor.primaryKey); cursor.continue(); }
          else for (const item of replacement) store.put({ ...item, owner });
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error('本机资料替换失败'));
        transaction.onerror = () => reject(transaction.error ?? new Error('本机资料替换失败'));
      });
    }
    caches.set(owner, replacement); clocks.delete(owner);
    for (const listener of listeners) listener(owner, false, []);
    const broadcaster = broadcastChannel();
    broadcaster?.postMessage({ owner, local: false });
    if (!listeners.size) { broadcaster?.close(); channel = undefined; }
  });
}

function estimatedServerTime(ownerId: string | null) {
  const clock = clocks.get(scope(ownerId));
  return clock ? clock.serverTime + Math.round(performance.now() - clock.observedAt) : Date.now();
}

export function mergeRemoteWorkspace(ownerId: string, items: WorkspaceItem[], serverTime: number, signal: AbortSignal, protocol2 = false, acknowledged: WorkspaceItem[] = [], generation = 1) {
  return editWorkspace(ownerId, (current) => {
    if (signal.aborted) return current;
    clocks.set(scope(ownerId), { serverTime, observedAt: performance.now() });
    const safeTime = estimatedServerTime(ownerId) + 4 * 60_000;
    const normalized = current.map((item) => {
      const value = item.value as { finishedAt?: number; savedAt?: number } | undefined;
      if (item.updatedAt <= safeTime && (value?.finishedAt ?? 0) <= safeTime && (value?.savedAt ?? 0) <= safeTime) return item;
      return {
        ...item, updatedAt: Math.min(item.updatedAt, safeTime), ...(value && { value: {
          ...value,
          ...(value.finishedAt !== undefined && { finishedAt: Math.min(value.finishedAt, safeTime) }),
          ...(value.savedAt !== undefined && { savedAt: Math.min(value.savedAt, safeTime) }),
        } }),
      };
    });
    const merged = protocol2 ? mergeProtocolItems(normalized, items, acknowledged, generation) : mergeWorkspaceItems(normalized, items);
    // Server responses can include the entire workspace for every chunk. Avoid
    // rewriting records that already match the stored copy.
    const previous = new Map(current.map((item) => [keyOf(item), item]));
    const next = merged.map((item) => {
      const stored = previous.get(keyOf(item));
      return stored && stored.updatedAt === item.updatedAt && stored.serverRevision === item.serverRevision && stored.baseUpdatedAt === item.baseUpdatedAt && stored.clientGeneration === item.clientGeneration && stored.localFallback === item.localFallback && stored.localConflict === item.localConflict && stored.localConflictBase === item.localConflictBase &&
        !!stored.deleted === !!item.deleted && JSON.stringify(stored.value) === JSON.stringify(item.value) ? stored : item;
    });
    return next.length === current.length && next.every((item, index) => item === current[index]) ? current : next;
  }, false);
}

export function applyAuthoritativeRecordDeletions(ownerId: string, deleted: WorkspaceItem[], generation: number): Promise<void> {
  if (!Number.isSafeInteger(generation) || generation < 1 || deleted.some((item) => !isWorkspaceItem(item) || item.kind !== 'record' || !item.deleted || item.serverRevision === undefined)) {
    return Promise.reject(new Error('删除结果无法读取'));
  }
  return editWorkspace(ownerId, (items) => {
    const next = new Map(items.map((item) => [keyOf(item), item]));
    for (const item of deleted) {
      const current = next.get(keyOf(item));
      if (current?.clientGeneration === generation && current.serverRevision !== undefined && current.serverRevision > item.serverRevision!) continue;
      next.set(keyOf(item), { ...item, baseUpdatedAt: item.updatedAt, clientGeneration: generation });
    }
    return [...next.values()];
  }, false).then(() => {});
}

export function workspaceValue<K extends WorkspaceKind>(items: WorkspaceItem[], kind: K, id: string): WorkspaceValues[K] | undefined {
  const item = items.find((entry) => entry.kind === kind && entry.id === id);
  return !item?.deleted ? item?.value as WorkspaceValues[K] | undefined : undefined;
}

export function workspaceSettings(items: WorkspaceItem[]): ReaderSettings {
  const saved = workspaceValue(items, 'settings', 'preferences');
  if (saved) return { ...defaultSettings, ...saved };
  try {
    const theme = localStorage.getItem(themeStorageKey);
    if (theme === 'light' || theme === 'dark') return { ...defaultSettings, theme };
  } catch { /* Default settings remain available. */ }
  return defaultSettings;
}

export function mutateWorkspaceValue<K extends WorkspaceKind>(
  ownerId: string | null, kind: K, id: string,
  update: (value: WorkspaceValues[K] | undefined, items: WorkspaceItem[]) => WorkspaceValues[K] | undefined,
): Promise<void> {
  return editWorkspace(ownerId, (items) => {
    const old = items.find((item) => item.kind === kind && item.id === id);
    const value = update(old?.deleted ? undefined : old?.value as WorkspaceValues[K] | undefined, items);
    if ((kind === 'draft' || kind === 'record') && old?.deleted) {
      if (value !== undefined) throw kind === 'draft' ? new DraftDeletedError(id) : new Error('此记录已删除');
      return items;
    }
    if (old && !old.deleted && old.value === value) return items;
    const updatedAt = Math.max(estimatedServerTime(ownerId), (old?.updatedAt ?? -1) + 1);
    const generation = ownerId ? readWorkspaceGeneration(ownerId) : null;
    const base = { ...(old?.serverRevision === undefined ? {} : { serverRevision: old.serverRevision, baseUpdatedAt: old.baseUpdatedAt ?? old.updatedAt }), ...(old?.localFallback && { localFallback: true }),
      ...((old?.clientGeneration ?? (!old ? generation : null)) ? { clientGeneration: old?.clientGeneration ?? generation! } : {}) };
    const item: WorkspaceItem = value === undefined
      ? { kind, id, updatedAt, deleted: true, ...base }
      : { kind, id, updatedAt, value, ...base };
    return mergeWorkspaceItems(items, [item]);
  }, true).then(() => {});
}

export function putWorkspaceValue<K extends WorkspaceKind>(ownerId: string | null, kind: K, id: string, value: WorkspaceValues[K]) {
  return mutateWorkspaceValue(ownerId, kind, id, () => value);
}

export function deleteWorkspaceValue(ownerId: string | null, kind: WorkspaceKind, id: string) {
  return mutateWorkspaceValue(ownerId, kind, id, () => undefined);
}

// Validate all selected identities before changing any of them. A second tab
// can otherwise occupy an alias or marker between reading and deleting it.
export function deleteGuestHistory(ids: string[], conflicts: string[], bases: Record<string, string>, expectedRecords: Record<string, string>): Promise<void> {
  return editWorkspace(null, (items) => {
    const byId = new Map(items.filter((item) => item.kind === 'record').map((item) => [item.id, item]));
    for (const id of ids) {
      const old = byId.get(id);
      if (conflicts.includes(id)) {
        if (old && !(old.deleted && old.localConflict && old.localConflictBase === bases[id])) throw new Error('记录标识已被占用，请刷新后重试');
      } else if (old && !old.deleted && expectedRecords[id]) {
        const current = normalizeWorkspaceRecord(old);
        if (!current || legacyConflictId(current) !== expectedRecords[id]) throw new Error('记录已更新，请重新选择后删除');
      }
    }
    const tombstones: WorkspaceItem[] = ids.flatMap((id) => {
      const old = byId.get(id);
      if (old?.deleted) return [];
      const updatedAt = Math.max(estimatedServerTime(null), (old?.updatedAt ?? -1) + 1);
      return [{ kind: 'record', id, updatedAt, deleted: true, ...(conflicts.includes(id) && { localConflict: true, ...(bases[id] && { localConflictBase: bases[id] }) }) }];
    });
    return tombstones.length ? mergeWorkspaceItems(items, tombstones) : items;
  }, true).then(() => {});
}

export function markWorkspaceDraftFallback(ownerId: string | null, draft: SavedPractice): Promise<void> {
  return editWorkspace(ownerId, (items) => {
    const index = items.findIndex((item) => item.kind === 'draft' && item.id === draft.id && !item.deleted);
    const stored = index >= 0 ? items[index].value as SavedPractice : undefined;
    if (!stored || stored.recordId !== draft.recordId || stored.article.id !== draft.article.id || stored.article.text !== draft.article.text ||
      stored.progressVersion !== draft.progressVersion || !sameDraftSnapshot(stored, draft) || JSON.stringify(stored.mistakes ?? []) !== JSON.stringify(draft.mistakes ?? [])) throw new Error('本机草稿已变化，请重试');
    if (items[index].localFallback) return items;
    const next = [...items]; next[index] = { ...items[index], localFallback: true }; return next;
  }, false).then(() => {});
}

// Do not overwrite a newer account value or a deletion that appeared after the
// import preview. Retrying an identical transfer remains a no-op.
export function importWorkspaceValue(ownerId: string, kind: WorkspaceKind, id: string, value: WorkspaceValues[WorkspaceKind], expected: WorkspaceItem | undefined, replaceSettings: boolean): Promise<'added' | 'existing' | 'conflict'> {
  let outcome: 'added' | 'existing' | 'conflict' = 'conflict';
  return editWorkspace(ownerId, (items) => {
    const old = items.find((item) => item.kind === kind && item.id === id);
    if (old && !old.deleted && sameWorkspaceValue(kind, old.value, value)) { outcome = 'existing'; return items; }
    if (old && !(kind === 'settings' && replaceSettings && !old.deleted && expected &&
      old.updatedAt === expected.updatedAt && old.serverRevision === expected.serverRevision &&
      JSON.stringify(comparable(old.value)) === JSON.stringify(comparable(expected.value)))) return items;
    const generation = readWorkspaceGeneration(ownerId);
    const updatedAt = Math.max(estimatedServerTime(ownerId), (old?.updatedAt ?? -1) + 1);
    const item: WorkspaceItem = { kind, id, value, updatedAt,
      ...(old?.serverRevision !== undefined && { serverRevision: old.serverRevision, baseUpdatedAt: old.baseUpdatedAt ?? old.updatedAt }),
      ...((old?.clientGeneration ?? (!old ? generation : null)) && { clientGeneration: old?.clientGeneration ?? generation! }) };
    outcome = 'added';
    return mergeWorkspaceItems(items, [item]);
  }, true).then(() => outcome);
}

/** Persist the image and its update preference in one local workspace transaction. */
export function saveWallpaper(ownerId: string | null, theme: 'light' | 'dark', background: WorkspaceValues['background'] | undefined, automatic: 'off' | 'nature' | 'portrait') {
  return editWorkspace(ownerId, (items) => {
    const settings = workspaceSettings(items);
    const changes: { kind: 'settings' | 'background'; id: string; value: unknown }[] = [
      { kind: 'background', id: theme, value: background },
      { kind: 'settings', id: 'preferences', value: { ...settings, wallpapers: { ...settings.wallpapers, [theme]: automatic } } },
    ];
    const generation = ownerId ? readWorkspaceGeneration(ownerId) : null;
    const updates = changes.map(({ kind, id, value }): WorkspaceItem => {
      const old = items.find(item => item.kind === kind && item.id === id);
      const updatedAt = Math.max(estimatedServerTime(ownerId), (old?.updatedAt ?? -1) + 1);
      const base = { ...(old?.serverRevision === undefined ? {} : { serverRevision: old.serverRevision, baseUpdatedAt: old.baseUpdatedAt ?? old.updatedAt }), ...(old?.localFallback && { localFallback: true }),
        ...((old?.clientGeneration ?? (!old ? generation : null)) ? { clientGeneration: old?.clientGeneration ?? generation! } : {}) };
      return { kind, id, updatedAt, ...base, ...(value === undefined ? { deleted: true } : { value }) };
    });
    return mergeWorkspaceItems(items, updates);
  }, true).then(() => {});
}
