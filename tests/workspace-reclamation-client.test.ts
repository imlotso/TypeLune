// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { workspaceRecoveryReason } from '../src/lib/workspace';
import type { WorkspaceItem } from '../src/lib/models';

it('requires recovery for an older generation without modifying the local data', () => {
  const local: WorkspaceItem[] = [{ kind: 'favorite', id: 'a', updatedAt: 1, serverRevision: 1, baseUpdatedAt: 1, clientGeneration: 1, value: { articleId: 'a' } }];
  expect(workspaceRecoveryReason(local, [], 1, 2)).toBe('generation');
  expect(local[0].value).toEqual({ articleId: 'a' });
  expect(workspaceRecoveryReason([], [], 1, 2)).toBeNull();
});

it('distinguishes an unchanged offline copy from an unsynced edit when a remote deletion arrives', () => {
  const old: WorkspaceItem = { kind: 'favorite', id: 'a', updatedAt: 1, serverRevision: 1, baseUpdatedAt: 1, clientGeneration: 1, value: { articleId: 'a' } };
  const deletion: WorkspaceItem = { kind: 'favorite', id: 'a', updatedAt: 2, serverRevision: 2, deleted: true };
  expect(workspaceRecoveryReason([old], [deletion], 1, 1)).toBeNull();
  expect(workspaceRecoveryReason([{ ...old, updatedAt: 3 }], [deletion], 1, 1)).toBe('conflict');
  expect(workspaceRecoveryReason([{ ...old, serverRevision: undefined, baseUpdatedAt: undefined }], [deletion], 1, 1)).toBe('conflict');
});

it('rejects an unversioned local write from an older client after protocol migration', () => {
  const oldClientWrite: WorkspaceItem = { kind: 'favorite', id: 'old', updatedAt: 3, value: { articleId: 'old' } };
  expect(workspaceRecoveryReason([oldClientWrite], [], 2, 2)).toBe('conflict');
  expect(workspaceRecoveryReason([{ ...oldClientWrite, clientGeneration: 2 }], [], 2, 2)).toBeNull();
});
