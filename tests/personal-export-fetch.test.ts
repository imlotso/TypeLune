// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { collectPersonalExport } from '../src/lib/personal-export-fetch';
import { putWorkspaceValue } from '../src/lib/workspace';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

it('reads all history pages without writing and reports inaccessible feedback', async () => {
  const user = { id: 'user', username: 'reader', email: 'reader@example.test', isAdmin: false };
  await putWorkspaceValue('user', 'favorite', 'article-1', { articleId: 'article-1' });
  const calls: Array<{ path: string; method?: string }> = [];
  const base = { language: 'zh', difficulty: 'beginner', duration: 300, speed: 10, accuracy: 90, finishedAt: 1000 };
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
    calls.push({ path, method: options?.method });
    if (path === '/api/me') return new Response(JSON.stringify({ user }));
    if (path === '/api/workspace') return new Response(JSON.stringify({ items: [], serverTime: Date.now() }));
    if (path === '/api/history?limit=100') return new Response(JSON.stringify({ entries: [{ ...base, recordId: 'one' }], nextCursor: 'second' }));
    if (path === '/api/history?limit=100&cursor=second') return new Response(JSON.stringify({ entries: [{ ...base, recordId: 'two' }], nextCursor: null }));
    if (path.startsWith('/api/feedback')) return new Response(JSON.stringify({ error: '反馈不可用' }), { status: 503 });
    throw new Error(`unexpected path ${path}`);
  }));
  const result = await collectPersonalExport(user);
  expect(result.data.favorites).toEqual([{ articleId: 'article-1' }]);
  expect(result.data.records.map((record) => record.recordId)).toEqual(['one', 'two']);
  expect(result.missing.some((entry) => entry.includes('反馈'))).toBe(true);
  expect(calls.every((call) => !call.method || call.method === 'GET')).toBe(true);
  await expect((await import('../src/lib/workspace')).readWorkspace('user')).resolves.toHaveLength(1);
});
