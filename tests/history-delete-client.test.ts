// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deleteLocalHistory, localHistory } from '../src/hooks/usePractice';
import { deletePracticeRecords } from '../src/lib/history-delete';
import { mergePracticeRecords, normalizeWorkspaceRecord, stableRecordId } from '../src/lib/records';
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

it('does not delete another record when a synthetic legacy ID collides', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(deletePracticeRecords('alice', [{ ...record, legacyIdConflict: true }])).rejects.toThrow('记录标识冲突');
  expect(fetcher).not.toHaveBeenCalled();
});
