// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deleteLocalHistory, localHistory } from '../src/hooks/usePractice';
import { deletePracticeRecords } from '../src/lib/history-delete';
import { legacyConflictId, mergePracticeRecords, normalizeWorkspaceRecord, stableRecordId } from '../src/lib/records';
import { applyAuthoritativeRecordDeletions, clearLocalWorkspace, mergeRemoteWorkspace, putWorkspaceValue, readWorkspace, saveWorkspaceGeneration } from '../src/lib/workspace';
import type { PracticeRecord, WorkspaceItem } from '../src/lib/models';

const record: PracticeRecord = { recordId: 'round', ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000 };
beforeEach(async () => { localStorage.clear(); await clearLocalWorkspace('alice'); saveWorkspaceGeneration('alice', 1); });
afterEach(async () => { await clearLocalWorkspace('alice'); localStorage.clear(); vi.unstubAllGlobals(); });
it('keeps a confirmed deletion when an older workspace response arrives later', async () => {
  const active: WorkspaceItem = { kind: 'record', id: 'round', updatedAt: 1000, serverRevision: 1, value: record };
  const tombstone: WorkspaceItem = { kind: 'record', id: 'round', updatedAt: 2000, serverRevision: 2, deleted: true };
  await mergeRemoteWorkspace('alice', [active], 2000, new AbortController().signal, true, [], 1);
  await applyAuthoritativeRecordDeletions('alice', [tombstone], 1);
  await mergeRemoteWorkspace('alice', [active], 2000, new AbortController().signal, true, [], 1);
  expect(await readWorkspace('alice')).toEqual([expect.objectContaining({ id: 'round', serverRevision: 2, deleted: true })]);
  await expect(putWorkspaceValue('alice', 'record', 'round', record)).rejects.toThrow();
});
it('removes selected legacy copies for only the current account without truncating unrelated history', () => {
  const legacy: PracticeRecord = { ...record, recordId: undefined };
  const unrelated = Array.from({ length: 65 }, (_, index) => ({ ...record, ownerId: index % 2 ? 'bobby' : null, recordId: `other-${index}` }));
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy, record, ...unrelated]));
  deleteLocalHistory('alice', [stableRecordId(legacy), 'round']);
  expect(JSON.parse(localStorage.getItem('cloudtyping.history.v1')!)).toEqual(unrelated);
});

it('retires both the workspace ID and a matching id-less local copy', async () => {
  const legacy: PracticeRecord = { ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000 };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy]));
  const alias = stableRecordId(legacy);
  const cloud = normalizeWorkspaceRecord({ kind: 'record', id: 'old-cloud-id', updatedAt: 1000, value: legacy })!;
  const merged = mergePracticeRecords(localHistory(), [], [cloud]);
  expect(merged).toHaveLength(1);
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    expect(body.ids).toEqual(['old-cloud-id', alias]);
    expect(body.legacyPairs).toEqual([{ id: 'old-cloud-id', alias, proof: {} }]);
    return new Response(JSON.stringify({ ok: true, generation: 1, items: body.ids.map((id: string) => ({ kind: 'record', id, deleted: true, updatedAt: 2000, serverRevision: 1 })) }));
  });
  vi.stubGlobal('fetch', fetcher);
  expect(await deletePracticeRecords('alice', merged)).toEqual(['old-cloud-id', alias]);
  expect(localHistory()).toEqual([]);
  expect((await readWorkspace('alice')).map((item) => item.id).sort()).toEqual([alias, 'old-cloud-id'].sort());
});

it('deletes a conflicting local legacy copy without deleting the distinct cloud record', async () => {
  const legacy: PracticeRecord = { ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy]));
  const alias = stableRecordId(legacy);
  const other = { ...legacy, recordId: alias, typed: '海' };
  await putWorkspaceValue('alice', 'record', alias, other);
  const conflicted = mergePracticeRecords(localHistory(), [], [other]).find((item) => item.legacyIdConflict)!;
  const conflictId = legacyConflictId(legacy);
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    expect(body.ids).toEqual([conflictId]);
    expect(body.localConflicts).toEqual([conflictId]);
    return new Response(JSON.stringify({ ok: true, generation: 1, items: [{ kind: 'record', id: conflictId, deleted: true, localConflict: true, updatedAt: 2000, serverRevision: 1 }] }));
  });
  vi.stubGlobal('fetch', fetcher);
  expect(await deletePracticeRecords('alice', [conflicted])).toEqual([conflictId]);
  expect(localHistory()).toEqual([]);
  expect((await readWorkspace('alice')).find((item) => item.id === alias)).toMatchObject({ value: { typed: '海' } });
});

it('purges the same conflicting copy when its content-specific tombstone arrives on another device', () => {
  const legacy: PracticeRecord = { ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy, { ...legacy, ownerId: 'bobby' }]));
  deleteLocalHistory('alice', [legacyConflictId(legacy)], [legacyConflictId(legacy)]);
  expect(localHistory()).toHaveLength(1);
  expect(localHistory()[0].ownerId).toBe('bobby');
});

it('does not treat an ordinary record ID with the conflict prefix as a local-copy tombstone', () => {
  const legacy: PracticeRecord = { ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy]));
  deleteLocalHistory('alice', [legacyConflictId(legacy)]);
  expect(localHistory()).toHaveLength(1);
});

it('persists a guest conflict tombstone and refuses an occupied conflict ID', async () => {
  await clearLocalWorkspace(null);
  const legacy: PracticeRecord = { language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  const alias = stableRecordId(legacy); const conflictId = legacyConflictId(legacy);
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy]));
  const other = { ...legacy, recordId: alias, typed: '海' };
  const conflicted = mergePracticeRecords(localHistory(), [], [other]).find((item) => item.legacyIdConflict)!;
  await putWorkspaceValue(null, 'record', conflictId, { ...other, recordId: conflictId });
  await expect(deletePracticeRecords(null, [conflicted])).rejects.toThrow('本机记录清理失败');
  expect(localHistory()).toHaveLength(1);
  await clearLocalWorkspace(null);
  await deletePracticeRecords(null, [conflicted]);
  expect(localHistory()).toHaveLength(0);
  expect(await readWorkspace(null)).toEqual([expect.objectContaining({ id: conflictId, deleted: true, localConflict: true })]);
  await clearLocalWorkspace(null);
});

it('refuses deletion if the content-specific conflict ID is also occupied', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(deletePracticeRecords('alice', [{ ...record, legacyDeletionBlocked: true }])).rejects.toThrow('记录标识冲突');
  expect(fetcher).not.toHaveBeenCalled();
});
