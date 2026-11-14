import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app';
import { stableRecordId } from '../src/lib/records';

describe('history deletion and score withdrawal', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let now: number; const codes = new Map<string, string>();
  beforeEach(async () => {
    now = Date.now(); codes.clear();
    app = await createApp({ databasePath: ':memory:', secureCookies: false, now: () => now, mailer: { async sendCode(email, code) { codes.set(email, code); } } });
  });
  afterEach(async () => { await app.close(); });
  async function register(name: string) {
    const email = `${name}@example.test`;
    await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email, purpose: 'register' } });
    const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: name, email, password: 'password-123456', code: codes.get(email) } });
    const user = response.json().user as { id: string };
    return { id: user.id, headers: { cookie: `session=${response.cookies.find((cookie) => cookie.name === 'session')!.value}`, 'x-workspace-owner': user.id, 'x-workspace-protocol': '2' } };
  }
  const post = (url: string, payload: Record<string, unknown>, headers: Record<string, string>) => app.inject({ method: 'POST', url, payload, headers });
  async function complete(headers: Record<string, string>) {
    const start = await post('/api/tests/start', { articleId: 'zh-beginner-1', duration: 60 }, headers);
    expect(start.statusCode).toBe(200);
    const challenge = start.json();
    for (const [length, elapsed] of [[2, 15_000], [4, 15_000], [6, 15_000], [8, 10_000]]) {
      now += elapsed; expect((await post(`/api/tests/${challenge.id}/checkpoint`, { typed: challenge.target.slice(0, length) }, headers)).statusCode).toBe(200);
    }
    now += 5_000;
    expect((await post(`/api/tests/${challenge.id}/finish`, { typed: challenge.target.slice(0, 10) }, headers)).statusCode).toBe(200);
    expect((await post('/api/leaderboard', { attemptId: challenge.id }, headers)).json().status).toBe('ranked');
    return challenge as { id: string; target: string };
  }
  it('withdraws only the owner’s score and prevents stale record resurrection after compaction', async () => {
    const alice = await register('alice'); const bob = await register('bobby');
    const attempt = await complete(alice.headers);
    const record = { recordId: attempt.id, language: 'zh', difficulty: 'beginner', duration: 60, speed: 10, accuracy: 100, finishedAt: now };
    const created = await post('/api/workspace/sync', { generation: 1, items: [{ kind: 'record', id: attempt.id, updatedAt: now, baseRevision: 0, value: record }] }, alice.headers);
    expect(created.statusCode).toBe(200);
    const revision = created.json().items[0].serverRevision;
    const board = () => app.inject('/api/leaderboard?language=zh&difficulty=beginner&duration=60');
    expect((await board()).json().entries).toHaveLength(1);
    expect((await post('/api/history/delete', { ids: [attempt.id] }, { ...bob.headers, 'x-workspace-owner': alice.id })).statusCode).toBe(403);
    expect((await post('/api/history/delete', { ids: [attempt.id] }, bob.headers)).statusCode).toBe(200);
    expect((await board()).json().entries).toHaveLength(1);
    const repeated = await Promise.all([post('/api/history/delete', { ids: [attempt.id] }, alice.headers), post('/api/history/delete', { ids: [attempt.id] }, alice.headers)]);
    expect(repeated.map((response) => response.statusCode)).toEqual([200, 200]);
    expect((await board()).json().entries).toEqual([]);
    expect((await app.inject({ url: '/api/history?limit=100', headers: alice.headers })).json().entries).toEqual([]);
    expect((await app.inject({ url: '/api/workspace', headers: alice.headers })).json().items).toEqual([expect.objectContaining({ id: attempt.id, deleted: true })]);
    expect((await post('/api/workspace/sync', { generation: 1, items: [{ kind: 'record', id: attempt.id, updatedAt: ++now, baseRevision: revision, value: record }] }, alice.headers)).statusCode).toBe(409);
    expect((await post('/api/workspace/compact', { generation: 1 }, alice.headers)).json()).toMatchObject({ removed: 1, generation: 2 });
    expect((await post('/api/workspace/sync', { generation: 1, items: [{ kind: 'record', id: attempt.id, updatedAt: ++now, baseRevision: revision, value: record }] }, alice.headers)).json().code).toBe('SYNC_RESYNC_REQUIRED');
    expect((await post('/api/workspace/sync', { generation: 2, items: [{ kind: 'record', id: attempt.id, updatedAt: ++now, baseRevision: 0, value: record }] }, alice.headers)).statusCode).toBe(409);
    expect((await post('/api/tests/start', { clientId: attempt.id, articleId: 'zh-beginner-1', duration: 60 }, alice.headers)).statusCode).toBe(409);
    expect((await post('/api/leaderboard', { attemptId: attempt.id }, alice.headers)).statusCode).toBe(404);
  });

  it('requires an owned online result and keeps retries idempotent for guests', async () => {
    const start = await app.inject({ method: 'POST', url: '/api/tests/start', payload: { articleId: 'zh-beginner-1', duration: 60 } });
    const guest = { cookie: `guest=${start.cookies.find((cookie) => cookie.name === 'guest')!.value}`, 'x-workspace-owner': 'guest' };
    const attempt = start.json();
    now += 60_000;
    expect((await post(`/api/tests/${attempt.id}/finish`, { typed: attempt.target.slice(0, 2) }, guest)).statusCode).toBe(200);
    expect((await post('/api/history/delete', { ids: [attempt.id], expectedOnlineIds: [attempt.id] }, { 'x-workspace-owner': 'guest' })).statusCode).toBe(409);
    const payload = { ids: [attempt.id], expectedOnlineIds: [attempt.id] };
    expect((await post('/api/history/delete', payload, guest)).statusCode).toBe(200);
    expect((await post('/api/history/delete', payload, guest)).statusCode).toBe(200);
    const recovery = await post('/api/tests/recover', { clientId: attempt.id, articleId: 'zh-beginner-1', target: attempt.target, duration: 60, mode: 'timed', strict: false, elapsedMs: 0 }, guest);
    expect(recovery.statusCode).toBe(409);
    expect(recovery.json().code).toBe('SCORE_FINALIZED');
  });
  it('cannot recreate an account’s old online attempt after account deletion', async () => {
    const alice = await register('alice');
    const id = randomUUID(); const recoveryKey = 'a'.repeat(43);
    const start = await post('/api/tests/start', { clientId: id, recoveryKey, articleId: 'zh-beginner-1', duration: 60 }, alice.headers);
    expect(start.statusCode).toBe(200);
    expect((await post('/api/account/delete', { currentPassword: 'password-123456' }, alice.headers)).statusCode).toBe(200);
    const guest = { 'x-workspace-owner': 'guest' };
    const recovery = await post('/api/tests/recover', { clientId: id, recoveryKey, articleId: 'zh-beginner-1', target: start.json().target,
      duration: 60, mode: 'timed', strict: false, elapsedMs: 0 }, guest);
    expect(recovery.statusCode).toBe(409);
    expect(recovery.json().code).toBe('SCORE_FINALIZED');
  });
  it('does not withdraw a score when its required tombstone cannot fit', async () => {
    const alice = await register('alice');
    const completed = await complete(alice.headers);
    for (let batch = 0; batch < 20; batch++) {
      const items = Array.from({ length: 100 }, (_, index) => { const id = `favorite-${batch * 100 + index}`; return { kind: 'favorite', id, updatedAt: now, baseRevision: 0, value: { articleId: id } }; });
      expect((await post('/api/workspace/sync', { generation: 1, items }, alice.headers)).statusCode).toBe(200);
    }
    const removed = await post('/api/history/delete', { ids: [completed.id], expectedOnlineIds: [completed.id] }, alice.headers);
    expect(removed.statusCode).toBe(413);
    expect((await app.inject({ url: '/api/history?limit=100', headers: alice.headers })).json().entries.map((item: { recordId: string }) => item.recordId)).toContain(completed.id);
    expect((await app.inject('/api/leaderboard?language=zh&difficulty=beginner&duration=60')).json().entries).toHaveLength(1);
  });
  it('rejects a batch containing an active challenge without partially deleting completed scores', async () => {
    const alice = await register('alice');
    const completed = await complete(alice.headers);
    const active = (await post('/api/tests/start', { articleId: 'zh-beginner-1', duration: 60 }, alice.headers)).json();
    expect((await post('/api/history/delete', { ids: [completed.id, active.id] }, alice.headers)).statusCode).toBe(409);
    expect((await app.inject({ url: '/api/history?limit=100', headers: alice.headers })).json().entries.map((item: { recordId: string }) => item.recordId)).toContain(completed.id);
    expect((await app.inject('/api/leaderboard?language=zh&difficulty=beginner&duration=60')).json().entries).toHaveLength(1);
    expect((await post('/api/history/delete', { ids: [] }, alice.headers)).statusCode).toBe(400);
  });
  it('allows alias tombstones for 100 selected legacy records, with a bounded request size', async () => {
    const alice = await register('alice');
    const ids = Array.from({ length: 200 }, (_, index) => `legacy-${index}`);
    const removed = await post('/api/history/delete', { ids }, alice.headers);
    expect(removed.statusCode).toBe(200);
    expect(removed.json().items).toHaveLength(200);
    expect((await post('/api/history/delete', { ids: [...ids, 'extra'] }, alice.headers)).statusCode).toBe(400);
  });
  it('deletes a verified legacy pair at full quota and refuses a forged quota exemption', async () => {
    const alice = await register('alice');
    const legacy = { ownerId: alice.id, language: 'zh' as const, difficulty: 'beginner' as const, duration: 300, speed: 12, accuracy: 100, finishedAt: now };
    const alias = stableRecordId(legacy);
    for (let batch = 0; batch < 20; batch++) {
      const items = Array.from({ length: 100 }, (_, index) => {
        const id = `full-${batch * 100 + index}`;
        return batch === 19 && index === 99
          ? { kind: 'record', id: 'old-cloud-id', updatedAt: now, baseRevision: 0, value: legacy }
          : { kind: 'favorite', id, updatedAt: now, baseRevision: 0, value: { articleId: id } };
      });
      expect((await post('/api/workspace/sync', { generation: 1, items }, alice.headers)).statusCode).toBe(200);
    }
    const forged = 'guest-0000000000000000';
    expect((await post('/api/history/delete', { ids: ['old-cloud-id', forged], legacyPairs: [{ id: 'old-cloud-id', alias: forged }] }, alice.headers)).statusCode).toBe(413);
    const removed = await post('/api/history/delete', { ids: ['old-cloud-id', alias], legacyPairs: [{ id: 'old-cloud-id', alias }] }, alice.headers);
    expect(removed.statusCode).toBe(200);
    expect(removed.json().items.map((item: { id: string }) => item.id).sort()).toEqual([alias, 'old-cloud-id'].sort());
    const usage = (await app.inject({ url: '/api/workspace/usage', headers: alice.headers })).json();
    expect(usage).toMatchObject({ count: 2000, tombstones: 1, aliasTombstones: 1 });
    const compacted = await post('/api/workspace/compact', { generation: 1 }, alice.headers);
    expect(compacted.json()).toMatchObject({ removed: 2, generation: 2 });
    expect((await app.inject({ url: '/api/workspace/usage', headers: alice.headers })).json().count).toBe(1999);
    expect((await post('/api/workspace/sync', { generation: 2, items: [{ kind: 'record', id: alias, updatedAt: ++now, baseRevision: 0, value: { ...legacy, recordId: alias } }] }, alice.headers)).statusCode).toBe(409);
  });
  it('never grants another account an exemption based on a legacy record it does not own', async () => {
    const alice = await register('alice'); const bob = await register('bobby');
    const legacy = { ownerId: alice.id, language: 'zh' as const, difficulty: 'beginner' as const, duration: 300, speed: 12, accuracy: 100, finishedAt: now };
    const alias = stableRecordId(legacy);
    expect((await post('/api/workspace/sync', { generation: 1, items: [{ kind: 'record', id: 'old-cloud-id', updatedAt: now, baseRevision: 0, value: legacy }] }, alice.headers)).statusCode).toBe(200);
    expect((await post('/api/history/delete', { ids: ['old-cloud-id', alias], legacyPairs: [{ id: 'old-cloud-id', alias }] }, bob.headers)).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/workspace/usage', headers: bob.headers })).json()).toMatchObject({ count: 2, aliasTombstones: 0 });
    expect((await app.inject({ url: '/api/workspace', headers: alice.headers })).json().items[0]).toMatchObject({ id: 'old-cloud-id', value: legacy });
  });
});
