import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';

describe('workspace deletion and reclamation protocol', () => {
  let app: Awaited<ReturnType<typeof createApp>>; let now: number; let code: string;
  let headers: Record<string, string>;
  const v2 = () => ({ ...headers, 'x-workspace-protocol': '2' });
  const item = (id: string, updatedAt: number, baseRevision: number, deleted = false) => ({ kind: 'favorite', id, updatedAt, baseRevision,
    ...(deleted ? { deleted: true } : { value: { articleId: id } }) });
  beforeEach(async () => {
    now = 1_800_000_000_000; code = '';
    app = await createApp({ databasePath: ':memory:', now: () => now, secureCookies: false, mailer: { async sendCode(_email, value) { code = value; } } });
    await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'reader@example.test', purpose: 'register' } });
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'reader', email: 'reader@example.test', password: 'a-long-password', code } });
    headers = { cookie: `session=${registration.cookies.find((cookie) => cookie.name === 'session')!.value}` };
  });
  afterEach(async () => { await app.close(); });
  const get = () => app.inject({ method: 'GET', url: '/api/workspace', headers: v2() });
  const sync = (generation: number, items: unknown[]) => app.inject({ method: 'POST', url: '/api/workspace/sync', headers: v2(), payload: { generation, items } });

  it('prevents an offline device from restoring a deleted item before and after compaction', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/workspace/sync', headers, payload: { items: [] } })).statusCode).toBe(426);
    const initial = (await get()).json();
    expect(initial).toMatchObject({ protocol: 2, generation: 1 });
    const created = await sync(1, [item('article', now, 0)]);
    expect(created.statusCode).toBe(200);
    const originalRevision = created.json().items[0].serverRevision as number;
    const deleted = await sync(1, [item('article', ++now, originalRevision, true)]);
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().items[0].deleted).toBe(true);
    const stale = await sync(1, [item('article', ++now, originalRevision)]);
    expect(stale.statusCode).toBe(409);
    expect((await get()).json().items[0].deleted).toBe(true);
    const compact = await app.inject({ method: 'POST', url: '/api/workspace/compact', headers: v2(), payload: { generation: 1 } });
    expect(compact.statusCode).toBe(200);
    expect(compact.json()).toMatchObject({ generation: 2, removed: 1 });
    expect((await get()).json().items).toEqual([]);
    const oldDevice = await sync(1, [item('article', ++now, originalRevision)]);
    expect(oldDevice.statusCode).toBe(409);
    expect(oldDevice.json().code).toBe('SYNC_RESYNC_REQUIRED');
    expect((await sync(2, [item('article', ++now, originalRevision)])).statusCode).toBe(409);
    expect((await sync(2, [item('new-article', ++now, 0)])).statusCode).toBe(200);
    expect((await get()).json().items.map((entry: { id: string }) => entry.id)).toEqual(['new-article']);
  });

  it('reclaims item quota without letting a stale batch partially write', async () => {
    for (let batch = 0; batch < 20; batch++) {
      const items = Array.from({ length: 100 }, (_, index) => item(`deleted-${batch * 100 + index}`, now, 0, true));
      expect((await sync(1, items)).statusCode).toBe(200);
    }
    const usage = await app.inject({ method: 'GET', url: '/api/workspace/usage', headers: v2() });
    expect(usage.json()).toMatchObject({ count: 2000, tombstones: 2000, maxItems: 2000, maxBytes: 32 * 1024 * 1024 });
    expect((await sync(1, [item('new', ++now, 0)])).statusCode).toBe(413);
    const compact = await app.inject({ method: 'POST', url: '/api/workspace/compact', headers: v2(), payload: { generation: 1 } });
    expect(compact.json()).toMatchObject({ generation: 2, removed: 2000 });
    expect((await sync(2, [item('new', ++now, 0)])).statusCode).toBe(200);
    const failed = await sync(2, [item('another', ++now, 0), item('new', ++now, 999)]);
    expect(failed.statusCode).toBe(409);
    expect((await get()).json().items.map((entry: { id: string }) => entry.id)).toEqual(['new']);
  });

  it('keeps a deleted online draft unavailable after its workspace tombstone is reclaimed', async () => {
    const draftId = 'draft-online';
    const start = await app.inject({ method: 'POST', url: '/api/tests/start', headers, payload: { articleId: 'zh-beginner-1', duration: 300, draftId } });
    expect(start.statusCode).toBe(200);
    const id = start.json().id as string;
    expect((await sync(1, [{ kind: 'draft', id: draftId, updatedAt: now, deleted: true, baseRevision: 0 }])).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/api/tests/${id}`, headers })).json().code).toBe('DRAFT_DELETED');
    expect((await app.inject({ method: 'POST', url: '/api/workspace/compact', headers: v2(), payload: { generation: 1 } })).statusCode).toBe(200);
    const after = await app.inject({ method: 'GET', url: `/api/tests/${id}`, headers });
    expect(after.statusCode).toBe(409);
    expect(after.json().code).toBe('DRAFT_DELETED');
  });

  it('preserves synchronized mistake states when an older client saves unrelated settings', async () => {
    const settings = { minutes: 5, mode: 'timed', strict: false, autoPause: true, fontSize: 18, lineHeight: 1.6, visibleLines: 4, theme: 'light' };
    const created = await sync(1, [{ kind: 'settings', id: 'preferences', updatedAt: now, baseRevision: 0,
      value: { ...settings, mistakeStates: { 'zh:风': 'mastered' } } }]);
    expect(created.statusCode).toBe(200);
    const revision = created.json().items[0].serverRevision;
    expect((await sync(1, [{ kind: 'settings', id: 'preferences', updatedAt: now + 1, baseRevision: revision, value: { ...settings, mistakeStates: { 'zh:风': 'invalid' } } }])).statusCode).toBe(400);
    const oldClient = await sync(1, [{ kind: 'settings', id: 'preferences', updatedAt: ++now, baseRevision: revision, value: { ...settings, minutes: 10 } }]);
    expect(oldClient.statusCode).toBe(200);
    expect(oldClient.json().items[0].value).toMatchObject({ minutes: 10, mistakeStates: { 'zh:风': 'mastered' } });
  });

  it('retains sample truncation through older-client draft and record updates', async () => {
    const article = { id: 'private', title: '短文', text: '山海', language: 'zh', difficulty: 'beginner', custom: true };
    const draft = { id: 'draft', recordId: 'round', article, typed: '山', elapsedMs: 1000, backspaces: 0, duration: 300, mode: 'timed', strict: false, offset: 0, offline: true, savedAt: now };
    const record = { recordId: 'round', language: 'zh', difficulty: 'beginner', duration: 300, speed: 10, accuracy: 90, finishedAt: now };
    const created = await sync(1, [
      { kind: 'draft', id: draft.id, updatedAt: now, baseRevision: 0, value: { ...draft, mistakesTruncated: true } },
      { kind: 'record', id: record.recordId, updatedAt: now, baseRevision: 0, value: { ...record, mistakesTruncated: true } },
    ]);
    expect(created.statusCode).toBe(200);
    const revisions = new Map(created.json().items.map((entry: { id: string; serverRevision: number }) => [entry.id, entry.serverRevision]));
    const updated = await sync(1, [
      { kind: 'draft', id: draft.id, updatedAt: now + 1, baseRevision: revisions.get(draft.id), value: { ...draft, typed: '山海' } },
      { kind: 'record', id: record.recordId, updatedAt: now + 1, baseRevision: revisions.get(record.recordId), value: { ...record, speed: 11 } },
    ]);
    expect(updated.statusCode).toBe(200);
    expect(updated.json().items.every((entry: { value: { mistakesTruncated?: boolean } }) => entry.value.mistakesTruncated === true)).toBe(true);
  });
});
