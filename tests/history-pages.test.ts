import { afterEach, expect, it, vi } from 'vitest';
import { readPagedHistory } from '../src/lib/history';

afterEach(() => vi.unstubAllGlobals());
const summary = (recordId: string) => ({ recordId, language: 'zh', difficulty: 'beginner', duration: 300, speed: 10, accuracy: 90, finishedAt: 1000 });
it('reads every page with an account-bound request and retains pages received before a failure', async () => {
  const requests: Array<{ url: string; owner: string | null }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    requests.push({ url, owner: new Headers(options?.headers).get('X-Workspace-Owner') });
    if (url === '/api/history?limit=100') return new Response(JSON.stringify({ entries: [summary('one')], nextCursor: 'next' }));
    return new Response(JSON.stringify({ error: '第二页不可用' }), { status: 503 });
  }));
  const received: unknown[] = [];
  await expect(readPagedHistory('alice', { onPage: (entries) => received.push(...entries) })).rejects.toThrow('第二页不可用');
  expect(received).toEqual([summary('one')]);
  expect(requests).toEqual([{ url: '/api/history?limit=100', owner: 'alice' }, { url: '/api/history?limit=100&cursor=next', owner: 'alice' }]);
});

it('reads all pages and rejects a repeated cursor instead of silently reporting complete history', async () => {
  const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('cursor=')
    ? { entries: [summary('two')], nextCursor: null }
    : { entries: [summary('one')], nextCursor: 'next' })));
  vi.stubGlobal('fetch', fetcher);
  expect((await readPagedHistory('alice')).map((record) => record.recordId)).toEqual(['one', 'two']);
  fetcher.mockImplementation(async () => new Response(JSON.stringify({ entries: [summary('one')], nextCursor: 'next' })));
  await expect(readPagedHistory('alice')).rejects.toThrow('历史分页无法继续');
});

it('reports malformed history without treating missing score values as zero', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ entries: [{ ...summary('bad'), speed: null }], nextCursor: null }))));
  await expect(readPagedHistory('alice')).rejects.toThrow('历史数据无法读取');
});
