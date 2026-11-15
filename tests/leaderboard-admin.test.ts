import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';

describe('administrator leaderboard date management', () => {
  let directory: string; let app: Awaited<ReturnType<typeof createApp>>; let db: Database.Database;
  let admin: Record<string, string>; let user: Record<string, string>; let userId: string;
  const codes = new Map<string, string>(); const from = 1_800_000_000_000; const to = from + 86_400_000;
  const post = (url: string, payload: object, headers?: Record<string, string>) => app.inject({ method: 'POST', url, payload, headers });
  const get = (url: string, headers?: Record<string, string>) => app.inject({ url, headers });
  async function register(username: string) {
    const email = `${username}@example.test`;
    await post('/api/auth/code', { email, purpose: 'register' });
    const response = await post('/api/auth/register', { username, email, password: 'test-password-123', code: codes.get(email) });
    expect(response.statusCode).toBe(200);
    const id = response.json().user.id as string;
    return { id, headers: { cookie: `session=${response.cookies.find((item) => item.name === 'session')!.value}`, 'x-workspace-owner': id } };
  }
  function insert(id: string, owner: string, finishedAt: number, status = 'finished') {
    db.prepare(`INSERT INTO challenges(id,owner,language,difficulty,duration,target,started_at,finished_at,status,correct,total,accuracy,speed,published,nickname,article_id)
      VALUES (?,?,'zh','beginner',60,'私人原文',?,?,?,8,8,100,8,1,?,'zh-beginner-1')`).run(id, owner, finishedAt - 60_000, finishedAt, status, `visitor-${id}`);
  }
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'typing-rank-admin-')); codes.clear();
    app = await createApp({ databasePath: join(directory, 'db.sqlite'), secureCookies: false, adminEmail: 'owner@example.test', now: () => to + 1000,
      mailer: { async sendCode(email, code) { codes.set(email, code); } } });
    const first = await register('owner'); const second = await register('reader'); admin = first.headers; user = second.headers; userId = second.id;
    db = new Database(join(directory, 'db.sqlite'));
    insert('before', 'g:before', from - 1); insert('start', 'g:start', from); insert('last', 'g:last', to - 1);
    insert('after', 'g:after', to); insert('member', `u:${userId}`, from + 1000); insert('pending', 'g:pending', from + 2000, 'review');
  });
  afterEach(async () => { db.close(); await app.close(); rmSync(directory, { recursive: true, force: true }); });
  const filter = { from, to, board: 'guest' };

  it('filters inclusive start and exclusive end and prevents non-admin bulk operations', async () => {
    const list = await get(`/api/admin/scores?status=published&board=guest&from=${from}&to=${to}`, admin);
    expect(list.statusCode).toBe(200);
    expect(list.json().entries.map((row: { id: string }) => row.id).sort()).toEqual(['last', 'start']);
    expect(list.body).not.toContain('私人原文');
    expect((await post('/api/admin/scores/cleanup/preview', filter, user)).statusCode).toBe(403);
    expect((await post('/api/admin/scores/cleanup', { ...filter, count: 2, digest: 'a'.repeat(64), reason: '整理' }, user)).statusCode).toBe(403);
    expect((await post('/api/admin/scores/cleanup/preview', { ...filter, from: to }, admin)).statusCode).toBe(400);
  });

  it('rejects a stale preview and removes exactly the confirmed public matches without deleting history', async () => {
    const preview = await post('/api/admin/scores/cleanup/preview', filter, admin);
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ count: 2, digest: expect.stringMatching(/^[a-f0-9]{64}$/) });
    insert('new', 'g:new', from + 3000);
    const stale = await post('/api/admin/scores/cleanup', { ...filter, ...preview.json(), reason: '按日期整理' }, admin);
    expect(stale.statusCode).toBe(409);
    expect((db.prepare("SELECT COUNT(*) AS count FROM challenges WHERE ranking_removed=1").get() as { count: number }).count).toBe(0);
    const current = (await post('/api/admin/scores/cleanup/preview', filter, admin)).json();
    const request = { ...filter, ...current, reason: '按日期整理', publicMessage: '排行榜已整理' };
    const results = await Promise.all([post('/api/admin/scores/cleanup', request, admin), post('/api/admin/scores/cleanup', request, admin)]);
    expect(results.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect((db.prepare('SELECT id FROM challenges WHERE ranking_removed=1 ORDER BY id').all() as Array<{ id: string }>).map((row) => row.id)).toEqual(['last', 'new', 'start']);
    expect((db.prepare('SELECT COUNT(*) AS count FROM challenges').get() as { count: number }).count).toBe(7);
    expect((await get(`/api/admin/scores?status=published&board=guest&from=${from}&to=${to}`, admin)).json().total).toBe(0);
    expect((await get(`/api/admin/scores?status=published&board=user&from=${from}&to=${to}`, admin)).json().total).toBe(1);
    expect((await get('/api/admin/audit?targetType=score', admin)).json().entries).toEqual([expect.objectContaining({ action: 'score.bulk_remove', reason: expect.stringContaining('按日期整理') })]);
  });
});
