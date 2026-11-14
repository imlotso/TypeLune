// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { allowLocalAccount, blockLocalAccount, clearLocalWorkspace, mergeRemoteWorkspace, putWorkspaceValue, readWorkspace, replaceLocalWorkspace } from '../src/lib/workspace';
import { clearLocalPractice } from '../src/hooks/usePractice';
import { cancelLocalCleanup, finishLocalCleanup, pendingLocalCleanups, prepareLocalCleanup } from '../src/lib/local-account-cleanup';

afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

it('clears only one account and blocks late writes until that account signs in again', async () => {
  await putWorkspaceValue(null, 'favorite', 'guest', { articleId: 'guest' });
  await putWorkspaceValue('alice', 'favorite', 'alice', { articleId: 'alice' });
  await putWorkspaceValue('bob', 'favorite', 'bob', { articleId: 'bob' });
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([{ recordId: 'a', ownerId: 'alice' }, { recordId: 'b', ownerId: 'bob' }, { recordId: 'g', ownerId: null }]));
  localStorage.setItem('cloudtyping.practice.v2.a', JSON.stringify({ recordId: 'a', ownerId: 'alice' }));
  localStorage.setItem('cloudtyping.practice.v2.b', JSON.stringify({ recordId: 'b', ownerId: 'bob' }));
  sessionStorage.setItem('cloudtyping.current-practice.v2', 'a');
  blockLocalAccount('alice');
  await clearLocalWorkspace('alice');
  clearLocalPractice('alice');
  expect(await readWorkspace('alice')).toEqual([]);
  expect((await readWorkspace(null)).map((item) => item.id)).toEqual(['guest']);
  expect((await readWorkspace('bob')).map((item) => item.id)).toEqual(['bob']);
  expect(JSON.parse(localStorage.getItem('cloudtyping.history.v1')!).map((item: { recordId: string }) => item.recordId)).toEqual(['b', 'g']);
  expect(localStorage.getItem('cloudtyping.practice.v2.a')).toBeNull();
  expect(localStorage.getItem('cloudtyping.practice.v2.b')).not.toBeNull();
  expect(sessionStorage.getItem('cloudtyping.current-practice.v2')).toBeNull();
  await expect(putWorkspaceValue('alice', 'favorite', 'late', { articleId: 'late' })).rejects.toThrow();
  await expect(mergeRemoteWorkspace('alice', [{ kind: 'favorite', id: 'late', updatedAt: Date.now(), value: { articleId: 'late' } }], Date.now(), new AbortController().signal)).rejects.toThrow();
  allowLocalAccount('alice');
  expect(await readWorkspace('alice')).toEqual([]);
  await putWorkspaceValue('alice', 'favorite', 'new', { articleId: 'new' });
  expect((await readWorkspace('alice')).map((item) => item.id)).toEqual(['new']);
});

it('replaces only a blocked account workspace with an authoritative server snapshot', async () => {
  await putWorkspaceValue('alice', 'favorite', 'old', { articleId: 'old' });
  await putWorkspaceValue('bob', 'favorite', 'keep', { articleId: 'keep' });
  prepareLocalCleanup('alice');
  await replaceLocalWorkspace('alice', [{ kind: 'favorite', id: 'new', updatedAt: 4, serverRevision: 3, value: { articleId: 'new' } }], 2);
  cancelLocalCleanup('alice');
  expect(await readWorkspace('alice')).toEqual([{ kind: 'favorite', id: 'new', updatedAt: 4, serverRevision: 3, baseUpdatedAt: 4, clientGeneration: 2, value: { articleId: 'new' } }]);
  expect((await readWorkspace('bob')).map((item) => item.id)).toEqual(['keep']);
});

it('retains a retry marker until all local cleanup steps succeed', async () => {
  await putWorkspaceValue('alice', 'favorite', 'alice', { articleId: 'alice' });
  localStorage.setItem('cloudtyping.history.v1', 'invalid-json');
  prepareLocalCleanup('alice');
  await expect(finishLocalCleanup('alice')).rejects.toThrow();
  expect(pendingLocalCleanups()).toEqual(['alice']);
  localStorage.removeItem('cloudtyping.history.v1');
  await finishLocalCleanup('alice');
  expect(pendingLocalCleanups()).toEqual([]);
  expect(await readWorkspace('alice')).toEqual([]);
  allowLocalAccount('alice');
});
