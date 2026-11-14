import type { PracticeRecord, WorkspaceItem } from './models';
import { isProcessTrace } from './process-trace';

export const legacyProofStatuses = ['finished', 'review', 'ranked', 'published', 'rejected', 'removed', 'ineligible', 'expired'] as const;
export type LegacyRecordProof = { localOnly?: boolean; status?: typeof legacyProofStatuses[number]; localSyncGeneration?: number };

export function legacyRecordProof(record: PracticeRecord): LegacyRecordProof | undefined {
  const raw = record as PracticeRecord & { localSyncGeneration?: unknown };
  const proof: LegacyRecordProof = {};
  if (raw.scoreStatus !== undefined) return undefined;
  if (raw.localOnly !== undefined) { if (typeof raw.localOnly !== 'boolean') return undefined; proof.localOnly = raw.localOnly; }
  if (raw.status !== undefined) {
    if (!(legacyProofStatuses as readonly string[]).includes(raw.status)) return undefined;
    proof.status = raw.status as LegacyRecordProof['status'];
  }
  if (raw.localSyncGeneration !== undefined) {
    if (!Number.isSafeInteger(raw.localSyncGeneration) || (raw.localSyncGeneration as number) < 0) return undefined;
    proof.localSyncGeneration = raw.localSyncGeneration as number;
  }
  return proof;
}

function canonicalRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalRecord);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalRecord(entry)]));
}

// Keep the existing guest-import ID for old records without an explicit ID.
export function stableRecordId(value: PracticeRecord) {
  if (value.recordId) return value.recordId;
  const { legacyLocalIds: _localIds, legacyWorkspaceId: _workspaceId, legacyIdConflict: _conflict, legacyProof: _proof, ...stored } = value;
  const text = JSON.stringify(canonicalRecord(stored));
  let first = 2166136261; let second = 2246822519;
  for (let index = 0; index < text.length; index++) { first = Math.imul(first ^ text.charCodeAt(index), 16777619); second = Math.imul(second ^ text.charCodeAt(index), 3266489917); }
  return `guest-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

export function normalizeWorkspaceRecord(item: WorkspaceItem): PracticeRecord | undefined {
  if (item.kind !== 'record' || item.deleted || !item.value || typeof item.value !== 'object') return undefined;
  const { legacyLocalIds: _localIds, legacyWorkspaceId: _workspaceId, legacyIdConflict: _conflict, legacyProof: _proof, ...value } = item.value as PracticeRecord;
  return value.recordId ? value : { ...value, recordId: item.id, localOnly: true, legacyWorkspaceId: true };
}

function legacyContent(record: PracticeRecord) {
  const { recordId: _id, ownerId: _owner, localOnly: _localOnly, status: _status, scoreStatus: _scoreStatus,
    legacyLocalIds: _localIds, legacyWorkspaceId: _workspaceId, legacyIdConflict: _conflict, legacyProof: _proof, ...content } = record;
  delete (content as Record<string, unknown>).localSyncGeneration;
  return JSON.stringify(canonicalRecord(content));
}

function reconcileLegacyRecords(local: PracticeRecord[], workspace: PracticeRecord[], remote: PracticeRecord[]) {
  const localGroups = new Map<string, PracticeRecord[]>(); const workspaceGroups = new Map<string, PracticeRecord[]>();
  for (const record of local) if (record.legacyLocalIds?.length) {
    const key = legacyContent(record); const group = localGroups.get(key) ?? []; group.push(record); localGroups.set(key, group);
  }
  for (const record of workspace) if (record.legacyWorkspaceId && record.recordId) {
    const key = legacyContent(record); const group = workspaceGroups.get(key) ?? []; group.push(record); workspaceGroups.set(key, group);
  }
  const byId = new Map<string, PracticeRecord[]>();
  for (const record of [...workspace, ...remote]) if (record.recordId) {
    const group = byId.get(record.recordId) ?? []; group.push(record); byId.set(record.recordId, group);
  }
  const reserved = new Set(byId.keys());
  const matches = new Map<PracticeRecord, string>();
  for (const [key, candidates] of localGroups) {
    const targets = workspaceGroups.get(key);
    if (candidates.length !== 1 || targets?.length !== 1) continue;
    const candidate = candidates[0]; const target = targets[0]; const alias = stableRecordId(candidate);
    if (!target.recordId || (alias !== target.recordId && reserved.has(alias))) continue;
    matches.set(candidate, target.recordId);
  }
  return local.map((record) => {
    const target = matches.get(record);
    if (target) return { ...record, recordId: target, legacyLocalIds: [...new Set([...(record.legacyLocalIds ?? []), stableRecordId(record)])] };
    const id = stableRecordId(record);
    const collision = record.legacyLocalIds?.length && byId.get(id)?.some((other) => legacyContent(other) !== legacyContent(record));
    if (!collision) return record;
    let safeId = `legacy-conflict-${id}`;
    while (reserved.has(safeId)) safeId += '-local';
    reserved.add(safeId);
    return { ...record, recordId: safeId, legacyIdConflict: true };
  });
}

export function mergePracticeRecords(local: PracticeRecord[], remote: PracticeRecord[], workspace: PracticeRecord[]) {
  const keyOf = (record: PracticeRecord) => record.recordId || `${record.finishedAt}:${record.language}:${record.difficulty}:${record.speed}:${record.accuracy}`;
  const onlineRecords = new Set(remote.map(keyOf));
  const entries = new Map<string, PracticeRecord>();
  // Official results are applied last so a synced local snapshot cannot replace
  // the server's verified speed and accuracy for the same attempt.
  const withoutCachedStatus = ({ scoreStatus: _status, ...record }: PracticeRecord) => record;
  const reconciledLocal = reconcileLegacyRecords(local, workspace, remote);
  for (const record of [...reconciledLocal.map(withoutCachedStatus), ...workspace.map(withoutCachedStatus), ...remote]) {
    const key = keyOf(record); const previous = entries.get(key);
    if (!previous) { entries.set(key, record); continue; }
    const rich = [record, previous].find((entry) => entry.article && entry.typed != null);
    const mistakes = [record, previous].find((entry) => entry.mistakes?.length)?.mistakes;
    const processTrace = [record, previous].find((entry) => isProcessTrace(entry.processTrace))?.processTrace;
    const legacyLocalIds = [...new Set([...(previous.legacyLocalIds ?? []), ...(record.legacyLocalIds ?? [])])];
    entries.set(key, { ...previous, ...record, ...(rich && { article: rich.article, typed: rich.typed, offset: rich.offset, articleTotal: rich.articleTotal }), ...(mistakes && { mistakes }), ...(processTrace && { processTrace }), ...(legacyLocalIds.length && { legacyLocalIds }) });
  }
  return [...entries].map(([key, record]) => onlineRecords.has(key) ? { ...record, localOnly: false } : record).sort((a, b) => b.finishedAt - a.finishedAt);
}
