// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { localHistory } from '../src/hooks/usePractice';
import { mergePracticeRecords, normalizeWorkspaceRecord, stableRecordId } from '../src/lib/records';
import type { PracticeRecord, WorkspaceItem } from '../src/lib/models';

const legacy = { ownerId: 'alice', language: 'zh' as const, difficulty: 'beginner' as const, duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山',
  article: { id: 'article', title: '山海', text: '山海', language: 'zh' as const, difficulty: 'beginner' as const, custom: true } };
const item = (id: string): WorkspaceItem => ({ kind: 'record', id, updatedAt: 1000, serverRevision: 1, value: legacy });
afterEach(() => localStorage.clear());

it('matches one id-less local copy to its distinct workspace item without asserting online verification', () => {
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy]));
  const [local] = localHistory(); const alias = stableRecordId(legacy);
  const cloud = normalizeWorkspaceRecord(item('old-cloud-id'))!;
  const records = mergePracticeRecords([local], [], [cloud]);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ recordId: 'old-cloud-id', localOnly: true, legacyLocalIds: [alias] });
  expect(records[0].article?.text).toBe('山海');
  expect(normalizeWorkspaceRecord(item('123e4567-e89b-42d3-a456-426614174000'))).toMatchObject({ localOnly: true });
});

it('does not silently merge ambiguous local copies or an alias used by a different cloud record', () => {
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy]));
  const [local] = localHistory();
  const cloud = normalizeWorkspaceRecord(item('old-cloud-id'))!;
  const duplicate = { ...local, recordId: 'another-local', legacyLocalIds: ['another-local'] };
  expect(mergePracticeRecords([local, duplicate], [], [cloud])).toHaveLength(3);
  const collision: PracticeRecord = { ...legacy, recordId: local.recordId, typed: '海' };
  expect(mergePracticeRecords([local], [], [cloud, collision])).toHaveLength(3);
});

it('does not trust persisted compatibility metadata as an instruction to delete other IDs', () => {
  const forged = { ...legacy, recordId: 'actual', legacyLocalIds: ['unrelated'], legacyWorkspaceId: true, legacyIdConflict: true };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([forged]));
  expect(localHistory()[0]).not.toHaveProperty('legacyLocalIds');
  expect(localHistory()[0]).not.toHaveProperty('legacyIdConflict');
  const cloud = normalizeWorkspaceRecord({ kind: 'record', id: 'actual', updatedAt: 1000, value: forged })!;
  expect(cloud).not.toHaveProperty('legacyLocalIds');
  expect(cloud).not.toHaveProperty('legacyWorkspaceId');
});
