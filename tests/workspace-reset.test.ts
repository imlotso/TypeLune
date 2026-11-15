// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { resetWorkspaceFromCloud } from '../src/lib/workspace-recovery';
import { pendingLocalCleanups } from '../src/lib/local-account-cleanup';
import { allowLocalAccount, putWorkspaceValue, readWorkspace, readWorkspaceGeneration, saveWorkspaceGeneration } from '../src/lib/workspace';

afterEach(() => { allowLocalAccount('alice'); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });
it('preserves local data on a failed fetch and replaces it only after an explicit reset', async () => {
  await putWorkspaceValue('alice', 'favorite', 'old', { articleId: 'old' });
  await putWorkspaceValue('bob', 'favorite', 'keep', { articleId: 'keep' });
  saveWorkspaceGeneration('alice', 1);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  await expect(resetWorkspaceFromCloud('alice')).rejects.toThrow();
  expect((await readWorkspace('alice')).map((item) => item.id)).toEqual(['old']);
  expect(pendingLocalCleanups()).toEqual([]);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ protocol: 2, generation: 2, serverTime: Date.now(), items: [
    { kind: 'favorite', id: 'remote', updatedAt: 5, serverRevision: 1, value: { articleId: 'remote' } },
  ] }))));
  await resetWorkspaceFromCloud('alice');
  expect((await readWorkspace('alice')).map((item) => item.id)).toEqual(['remote']);
  expect((await readWorkspace('bob')).map((item) => item.id)).toEqual(['keep']);
  expect(readWorkspaceGeneration('alice')).toBe(2);
  expect(pendingLocalCleanups()).toEqual([]);
});

it('keeps all local data if a later workspace page fails during reset', async () => {
  await putWorkspaceValue('alice', 'favorite', 'old', { articleId: 'old' });
  saveWorkspaceGeneration('alice', 1);
  vi.stubGlobal('fetch', vi.fn(async (_path: string, options?: RequestInit) => {
    const cursor = new Headers(options?.headers).get('X-Workspace-Cursor');
    if (cursor) return new Response(JSON.stringify({ error: '暂时不可用' }), { status: 503 });
    return new Response(JSON.stringify({ protocol: 2, generation: 2, serverTime: Date.now(), nextCursor: 'page-two', items: [
      { kind: 'favorite', id: 'remote', updatedAt: 5, serverRevision: 1, value: { articleId: 'remote' } },
    ] }));
  }));
  await expect(resetWorkspaceFromCloud('alice')).rejects.toThrow('暂时不可用');
  expect((await readWorkspace('alice')).map((item) => item.id)).toEqual(['old']);
  expect(readWorkspaceGeneration('alice')).toBe(1);
  expect(pendingLocalCleanups()).toEqual([]);
});
