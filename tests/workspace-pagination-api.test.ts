import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';

// A missing page limit used to make the response exceed Vercel's 4.5 MB limit.
describe('bounded workspace API', () => {
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  afterEach(async () => { await app?.close(); });

  it('returns a complete workspace larger than 4.5 MB through bounded pages and writes', async () => {
    const now = 1_800_000_000_000;
    let code = '';
    app = await createApp({ databasePath: ':memory:', now: () => now, secureCookies: false,
      mailer: { async sendCode(_email, value) { code = value; } } });
    await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'pages@example.com', purpose: 'register' } });
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: {
      email: 'pages@example.com', username: 'pages', password: 'long-password-123', code,
    } });
    expect(registration.statusCode).toBe(200);
    const cookie = registration.cookies[0].name + '=' + registration.cookies[0].value;
    const headers = { cookie, 'x-workspace-protocol': '2', 'x-workspace-capabilities': 'local-conflict-v1' };
    const articles = Array.from({ length: 84 }, (_, index) => {
      const id = `private-${index.toString().padStart(3, '0')}`;
      return { kind: 'article', id, updatedAt: now, baseRevision: 0, value: {
        id, title: id, text: '字'.repeat(20_000), language: 'zh', difficulty: 'beginner', custom: true,
      } };
    });
    for (let offset = 0; offset < articles.length; offset += 10) {
      const response = await app.inject({ method: 'POST', url: '/api/workspace/sync?paged=1', headers, payload: { generation: 1, items: articles.slice(offset, offset + 10) } });
      expect(response.statusCode).toBe(200);
      expect(Buffer.byteLength(response.body)).toBeLessThan(4 * 1024 * 1024);
      expect(response.json()).toMatchObject({ acknowledged: true });
    }
    const deleted = { kind: 'favorite', id: 'deleted', updatedAt: now, deleted: true, baseRevision: 0 };
    expect((await app.inject({ method: 'POST', url: '/api/workspace/sync?paged=1', headers, payload: { generation: 1, items: [deleted] } })).json()).toMatchObject({ acknowledged: true });
    const all: unknown[] = [];
    let cursor: string | null = null;
    let pageCount = 0;
    let totalBytes = 0;
    do {
      const query: URLSearchParams = new URLSearchParams({ paged: '1', ...(cursor && { cursor }) });
      const response = await app.inject({ url: `/api/workspace?${query}`, headers });
      expect(response.statusCode).toBe(200);
      const bytes = Buffer.byteLength(response.body);
      expect(bytes).toBeLessThan(4 * 1024 * 1024);
      totalBytes += bytes;
      const page: { items: unknown[]; nextCursor: string | null } = response.json();
      all.push(...page.items);
      cursor = page.nextCursor;
      expect(++pageCount).toBeLessThan(20);
    } while (cursor);
    expect(pageCount).toBeGreaterThan(1);
    expect(totalBytes).toBeGreaterThan(4.5 * 1024 * 1024);
    expect(all).toEqual([...articles, deleted].map(({ baseRevision: _baseRevision, ...value }) => ({ ...value, serverRevision: 1 })));
    const firstPage = (await app.inject({ url: '/api/workspace?paged=1', headers })).json();
    expect(firstPage.nextCursor).toBeTruthy();
    const changed = { kind: 'favorite', id: 'new-item', updatedAt: now, baseRevision: 0, value: { articleId: 'new-item' } };
    await app.inject({ method: 'POST', url: '/api/workspace/sync?paged=1', headers, payload: { generation: 1, items: [changed] } });
    const obsolete = await app.inject({ url: `/api/workspace?paged=1&cursor=${encodeURIComponent(firstPage.nextCursor)}`, headers });
    expect(obsolete.statusCode).toBe(409);
    expect(obsolete.json().code).toBe('WORKSPACE_CHANGED');
    const stale = { kind: 'favorite', id: 'deleted', updatedAt: now - 1, baseRevision: 0, value: { articleId: 'deleted' } };
    expect((await app.inject({ method: 'POST', url: '/api/workspace/sync?paged=1', headers, payload: { generation: 1, items: [stale] } })).statusCode).toBe(409);
    const unpaged = await app.inject({ url: '/api/workspace', headers });
    expect(unpaged.statusCode).toBe(426);
    expect(unpaged.json().code).toBe('SYNC_PAGINATION_REQUIRED');
    const tooLargeWrite = await app.inject({ method: 'POST', url: '/api/workspace/sync', headers, payload: { generation: 1, items: [{ kind: 'favorite', id: 'blocked', updatedAt: now, baseRevision: 0, value: { articleId: 'blocked' } }] } });
    expect(tooLargeWrite.statusCode).toBe(426);
    const verifiedPage = (await app.inject({ url: '/api/workspace?paged=1', headers })).json();
    expect(verifiedPage.items.some((item: { id: string }) => item.id === 'blocked')).toBe(false);
    expect((await app.inject({ url: '/api/workspace?paged=1&cursor=invalid', headers })).statusCode).toBe(400);
  });
});
