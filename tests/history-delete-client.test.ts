// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { deleteLocalHistory } from '../src/hooks/usePractice';
import { stableRecordId } from '../src/lib/records';
import { applyAuthoritativeRecordDeletions, clearLocalWorkspace, mergeRemoteWorkspace, putWorkspaceValue, readWorkspace, saveWorkspaceGeneration } from '../src/lib/workspace';
import type { PracticeRecord, WorkspaceItem } from '../src/lib/models';

const record: PracticeRecord = { recordId: 'round', ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000 };
beforeEach(async () => { localStorage.clear(); await clearLocalWorkspace('alice'); saveWorkspaceGeneration('alice', 1); });
afterEach(async () => { await clearLocalWorkspace('alice'); localStorage.clear(); });
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
