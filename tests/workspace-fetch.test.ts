// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { fetchWorkspace } from '../src/lib/workspace-fetch';

afterEach(() => vi.unstubAllGlobals());
const item = (id: string) => ({ kind: 'favorite', id, updatedAt: 1, serverRevision: 1, value: { articleId: id } });

it('collects a complete workspace before returning it to export or recovery callers', async () => {
  const fetcher = vi.fn(async (_path: string, options?: RequestInit) => {
    const cursor = new Headers(options?.headers).get('X-Workspace-Cursor');
    return new Response(JSON.stringify({ protocol: 2, generation: 2, serverTime: Date.now(), items: [item(cursor ? 'second' : 'first')], nextCursor: cursor ? null : 'page-two' }));
  });
  vi.stubGlobal('fetch', fetcher);
  const snapshot = await fetchWorkspace('reader');
  expect(snapshot.items.map((entry) => entry.id)).toEqual(['first', 'second']);
  expect(snapshot.generation).toBe(2); expect(fetcher).toHaveBeenCalledTimes(2);
});

it('rejects mixed generations or duplicate items across pages', async () => {
  let mixed = true;
  vi.stubGlobal('fetch', vi.fn(async (_path: string, options?: RequestInit) => {
    const cursor = new Headers(options?.headers).get('X-Workspace-Cursor');
    return new Response(JSON.stringify({ protocol: 2, generation: cursor && mixed ? 2 : 1, serverTime: Date.now(), items: [item('same')], nextCursor: cursor ? null : 'page-two' }));
  }));
  await expect(fetchWorkspace('reader')).rejects.toThrow('同步数据已变更');
  mixed = false;
  await expect(fetchWorkspace('reader')).rejects.toThrow('同步数据无法读取');
});
