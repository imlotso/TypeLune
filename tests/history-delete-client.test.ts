// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deleteLocalHistory, localHistory } from '../src/hooks/usePractice';
import { deletePracticeRecords } from '../src/lib/history-delete';
import { legacyConflictId, mergePracticeRecords, normalizeWorkspaceRecord, stableRecordId } from '../src/lib/records';
import { applyAuthoritativeRecordDeletions, clearLocalWorkspace, deleteGuestHistory, mergeRemoteWorkspace, putWorkspaceValue, readWorkspace, saveWorkspaceGeneration } from '../src/lib/workspace';
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

it('uses a bounded local marker when an old status cannot be safely reconstructed on the server', async () => {
  const local: PracticeRecord = { ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, status: 'old-custom-status', typed: '山' };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([local]));
  const cloud = normalizeWorkspaceRecord({ kind: 'record', id: 'old-cloud-id', updatedAt: 1000, value: { ...local, status: 'finished' } })!;
  const [merged] = mergePracticeRecords(localHistory(), [], [cloud]);
  expect(merged.legacyProof).toBeUndefined();
  const marker = legacyConflictId(local);
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    expect(body.ids).toEqual(['old-cloud-id', marker]);
    expect(body.localConflicts).toEqual([marker]);
    expect(body.legacyPairs).toBeUndefined();
    return new Response(JSON.stringify({ ok: true, generation: 1, items: body.ids.map((id: string) => ({ kind: 'record', id, deleted: true, updatedAt: 2000, serverRevision: 1, ...(id === marker && { localConflict: true }) })) }));
  }));
  await deletePracticeRecords('alice', [merged]);
  expect(localHistory()).toEqual([]);
  expect((await readWorkspace('alice')).find((item) => item.id === marker)).toMatchObject({ deleted: true, localConflict: true });
});

it('uses an exempt marker for an unmatched id-less local record', async () => {
  const legacy: PracticeRecord = { ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy]));
  const [record] = mergePracticeRecords(localHistory(), [], []); const marker = legacyConflictId(legacy);
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    expect(body.ids).toEqual([marker]); expect(body.localConflicts).toEqual([marker]);
    return new Response(JSON.stringify({ ok: true, generation: 1, items: [{ kind: 'record', id: marker, deleted: true, localConflict: true, updatedAt: 2000, serverRevision: 1 }] }));
  }));
  await deletePracticeRecords('alice', [record]);
  expect(localHistory()).toEqual([]);
});

it('also deletes a matching cloud record when the legacy alias is already its ID', async () => {
  const legacy: PracticeRecord = { ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy]));
  const alias = stableRecordId(legacy); const marker = legacyConflictId(legacy); const cloud = { ...legacy, recordId: alias };
  await putWorkspaceValue('alice', 'record', alias, cloud);
  const [record] = mergePracticeRecords(localHistory(), [], [cloud]);
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    expect(body.ids).toEqual([alias, marker]); expect(body.localConflicts).toEqual([marker]);
    return new Response(JSON.stringify({ ok: true, generation: 1, items: body.ids.map((id: string) => ({ kind: 'record', id, deleted: true, ...(id === marker && { localConflict: true }), updatedAt: 2000, serverRevision: 1 })) }));
  }));
  await deletePracticeRecords('alice', [record]);
  expect(localHistory()).toEqual([]);
  expect((await readWorkspace('alice')).find((item) => item.id === alias)).toMatchObject({ deleted: true });
});

it('does not delete a guest record that changed after the old copy was selected', async () => {
  await clearLocalWorkspace(null);
  const legacy: PracticeRecord = { ownerId: null, language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy]));
  const [selected] = mergePracticeRecords(localHistory(), [], []);
  const alias = stableRecordId(legacy);
  await putWorkspaceValue(null, 'record', alias, { ...legacy, recordId: alias, typed: '海' });
  await expect(deletePracticeRecords(null, [selected])).rejects.toThrow('记录已更新');
  expect(localHistory()).toHaveLength(1);
  expect((await readWorkspace(null)).find((item) => item.id === alias)).toMatchObject({ value: { typed: '海' } });
  await clearLocalWorkspace(null);
});

it('leaves a guest record intact if its deletion marker is occupied', async () => {
  await clearLocalWorkspace(null);
  const legacy: PracticeRecord = { ownerId: null, language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  const alias = stableRecordId(legacy); const marker = legacyConflictId(legacy);
  await putWorkspaceValue(null, 'record', alias, { ...legacy, recordId: alias });
  await putWorkspaceValue(null, 'record', marker, { ...legacy, recordId: marker, typed: '海' });
  await expect(deleteGuestHistory([alias, marker], [marker], {}, { [alias]: marker })).rejects.toThrow('记录标识已被占用');
  const items = await readWorkspace(null);
  expect(items.find((item) => item.id === alias)).toMatchObject({ value: { typed: '山' } });
  expect(items.find((item) => item.id === marker)).toMatchObject({ value: { typed: '海' } });
  await clearLocalWorkspace(null);
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

it('retires an alternate marker without deleting either occupied record', async () => {
  const legacy: PracticeRecord = { ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy]));
  const alias = stableRecordId(legacy); const base = legacyConflictId(legacy);
  const other = { ...legacy, recordId: alias, typed: '海' }; const occupied = { ...legacy, recordId: base, typed: '风' };
  await putWorkspaceValue('alice', 'record', alias, other); await putWorkspaceValue('alice', 'record', base, occupied);
  const conflicted = mergePracticeRecords(localHistory(), [], [other, occupied]).find((item) => item.legacyIdConflict)!;
  const marker = stableRecordId(conflicted);
  expect(marker).not.toBe(base);
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    expect(body.ids).toEqual([marker]); expect(body.localConflictBases).toEqual([{ id: marker, base }]);
    return new Response(JSON.stringify({ ok: true, generation: 1, items: [{ kind: 'record', id: marker, deleted: true, localConflict: true, localConflictBase: base, updatedAt: 2000, serverRevision: 1 }] }));
  }));
  await deletePracticeRecords('alice', [conflicted]);
  expect(localHistory()).toEqual([]);
  expect((await readWorkspace('alice')).find((item) => item.id === alias)).toMatchObject({ value: { typed: '海' } });
  expect((await readWorkspace('alice')).find((item) => item.id === base)).toMatchObject({ value: { typed: '风' } });
});

it('purges the same conflicting copy when its content-specific tombstone arrives on another device', () => {
  const legacy: PracticeRecord = { ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy, { ...legacy, ownerId: 'bobby' }]));
  deleteLocalHistory('alice', [legacyConflictId(legacy)], [legacyConflictId(legacy)]);
  expect(localHistory()).toHaveLength(1);
  expect(localHistory()[0].ownerId).toBe('bobby');
});

it('purges an id-less copy when another device receives its alternate marker', () => {
  const legacy: PracticeRecord = { ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  const base = legacyConflictId(legacy); const marker = `legacy-conflict-${'b'.repeat(64)}`;
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy, { ...legacy, ownerId: 'bobby' }]));
  deleteLocalHistory('alice', [marker], [marker], { [marker]: base });
  expect(localHistory()).toHaveLength(1); expect(localHistory()[0].ownerId).toBe('bobby');
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
