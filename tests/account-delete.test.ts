import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import argon2 from 'argon2';
import { createApp } from '../server/app';
import { syncWorkspace } from './workspace-sync-helper';

describe('account deletion', () => {
  let directory: string; let app: Awaited<ReturnType<typeof createApp>>; let codes: Map<string, string>;
  const password = 'deletion-password-123';
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'typing-delete-')); codes = new Map();
    app = await createApp({ databasePath: join(directory, 'test.sqlite'), secureCookies: false, adminEmail: 'admin@example.test',
      mailer: { async sendCode(email, code) { codes.set(email, code); } } });
  });
  afterEach(async () => { vi.restoreAllMocks(); await app.close(); rmSync(directory, { recursive: true, force: true }); });
  const post = (url: string, payload: Record<string, unknown>, headers?: Record<string, string>) => app.inject({ method: 'POST', url, payload, headers });
  const get = (url: string, headers?: Record<string, string>) => app.inject({ method: 'GET', url, headers });
  async function register(username: string) {
    const email = `${username}@example.test`;
    await post('/api/auth/code', { email, purpose: 'register' });
    const result = await post('/api/auth/register', { username, email, password, code: codes.get(email) });
    expect(result.statusCode).toBe(200);
    return { id: result.json().user.id as string, email, headers: { cookie: `session=${result.cookies.find((item) => item.name === 'session')!.value}` } };
  }

  it('removes account data, feedback, scores and sessions while anonymizing related audit entries', async () => {
    const admin = await register('admin'); const alice = await register('alice'); const other = await register('other');
    const second = await post('/api/auth/login', { identifier: alice.email, password });
    const secondHeaders = { cookie: `session=${second.cookies.find((item) => item.name === 'session')!.value}` };
    const now = Date.now();
    const favorite = { kind: 'favorite', id: 'zh-beginner-1', updatedAt: now, value: { articleId: 'zh-beginner-1' } };
    const png = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#aabbcc' } }).png().toBuffer();
    const image = `data:image/png;base64,${png.toString('base64')}`;
    const background = { kind: 'background', id: 'light', updatedAt: now, value: { image, name: 'bg.png', width: 12, height: 12, fit: 'cover', positionX: 50, positionY: 50, blur: 0, shade: 20 } };
    expect((await syncWorkspace(app, alice.headers, [favorite, background])).statusCode).toBe(200);
    const feedback = await post('/api/feedback', { category: 'issue', title: '私人反馈', description: '私人内容', attachments: [{ name: 'private.png', data: image }] }, alice.headers);
    expect(feedback.statusCode).toBe(201);
    expect((await post('/api/auth/code', { email: alice.email, purpose: 'login' })).statusCode).toBe(200);
    const database = new Database(join(directory, 'test.sqlite'));
    database.prepare(`INSERT INTO challenges(id,owner,language,difficulty,duration,target,started_at,finished_at,status,correct,total,accuracy,speed,published,nickname)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('score-1', `u:${alice.id}`, 'zh', 'beginner', 300, '甲', now - 300000, now, 'finished', 1, 1, 100, 1, 1, 'alice');
    database.prepare(`INSERT INTO scores(owner,language,difficulty,duration,nickname,speed,accuracy,correct,created_at,attempt_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(`u:${alice.id}`, 'zh', 'beginner', 300, 'alice', 1, 100, 1, now, 'score-1');
    database.prepare(`INSERT INTO admin_audit(actor_id,actor_name,action,target_type,target_id,target_label,reason,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(admin.id, 'admin', 'user.disable', 'user', alice.id, 'alice', 'alice@example.test', now);
    database.prepare(`INSERT INTO admin_audit(actor_id,actor_name,action,target_type,target_id,target_label,reason,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(admin.id, 'admin', 'score.remove', 'score', 'score-1', 'alice', 'alice@example.test', now);
    database.prepare(`INSERT INTO admin_audit(actor_id,actor_name,action,target_type,target_id,target_label,reason,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(admin.id, 'admin', 'feedback.handle', 'feedback', feedback.json().feedback.id, '私人反馈', 'alice@example.test', now);
    database.close();
    expect((await post('/api/account/delete', { currentPassword: 'wrong' }, alice.headers)).statusCode).toBe(401);
    expect((await post('/api/account/delete', { currentPassword: password }, { ...other.headers, 'x-workspace-owner': alice.id })).statusCode).toBe(403);
    expect((await get(`/api/feedback/${feedback.json().feedback.id}`, alice.headers)).statusCode).toBe(200);
    const result = await post('/api/account/delete', { currentPassword: password }, { ...alice.headers, 'x-workspace-owner': alice.id });
    expect(result.statusCode).toBe(200);
    expect(result.body).not.toContain(password);
    expect((await get('/api/me', alice.headers)).json().user).toBeNull();
    expect((await get('/api/me', secondHeaders)).json().user).toBeNull();
    expect((await post('/api/auth/login', { identifier: alice.email, password })).statusCode).toBe(401);
    expect((await get(`/api/feedback/${feedback.json().feedback.id}`, admin.headers)).statusCode).toBe(404);
    expect((await get('/api/leaderboard?language=zh&difficulty=beginner&duration=300')).json().entries).toEqual([]);
    const check = new Database(join(directory, 'test.sqlite'));
    expect(check.prepare('SELECT COUNT(*) AS count FROM users WHERE id=?').get(alice.id)).toEqual({ count: 0 });
    expect(check.prepare('SELECT COUNT(*) AS count FROM workspace_items WHERE user_id=?').get(alice.id)).toEqual({ count: 0 });
    expect(check.prepare('SELECT COUNT(*) AS count FROM challenges WHERE owner=?').get(`u:${alice.id}`)).toEqual({ count: 0 });
    expect(check.prepare('SELECT COUNT(*) AS count FROM scores WHERE owner=?').get(`u:${alice.id}`)).toEqual({ count: 0 });
    expect(check.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id=?').get(alice.id)).toEqual({ count: 0 });
    expect(check.prepare('SELECT COUNT(*) AS count FROM email_codes WHERE email=?').get(alice.email)).toEqual({ count: 0 });
    expect(check.prepare('SELECT COUNT(*) AS count FROM feedback_attachments').get()).toEqual({ count: 0 });
    expect(JSON.stringify(check.prepare('SELECT * FROM admin_audit').all())).not.toContain('alice@example.test');
    expect(JSON.stringify(check.prepare('SELECT * FROM admin_audit').all())).not.toContain(alice.id);
    expect(JSON.stringify(check.prepare('SELECT * FROM admin_audit').all())).not.toContain(password);
    check.close();
  });

  it('prevents the last active administrator from deleting their account', async () => {
    const admin = await register('admin');
    expect((await post('/api/account/delete', { currentPassword: password }, admin.headers)).statusCode).toBe(409);
    expect((await get('/api/me', admin.headers)).json().user.id).toBe(admin.id);
  });

  it('removes upload staging and alternate legacy mappings only for the deleted account', async () => {
    const alice = await register('alice'); const other = await register('other');
    const marker = `legacy-conflict-${'b'.repeat(64)}`; const base = `legacy-conflict-${'a'.repeat(64)}`;
    const request = { ids: [marker], localConflicts: [marker], localConflictBases: [{ id: marker, base }], expectedRevisions: [{ id: marker, revision: 0 }] };
    const chunk = { requestId: randomUUID(), fileIndex: 0, chunkIndex: 0, chunkCount: 1, name: 'pending.png', mime: 'image/png', totalBytes: 1, digest: 'a'.repeat(64), data: 'AQ==' };
    for (const account of [alice, other]) {
      const headers = { ...account.headers, 'x-workspace-owner': account.id, 'x-workspace-capabilities': 'local-conflict-v2' };
      expect((await post('/api/history/delete', request, headers)).statusCode).toBe(200);
      expect((await post('/api/feedback/uploads', chunk, headers)).statusCode).toBe(200);
    }
    expect((await post('/api/account/delete', { currentPassword: password }, { ...alice.headers, 'x-workspace-owner': alice.id })).statusCode).toBe(200);
    const check = new Database(join(directory, 'test.sqlite'));
    for (const table of ['workspace_legacy_record_aliases', 'workspace_local_conflict_bases', 'feedback_upload_chunks']) {
      expect(check.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE user_id=?`).get(alice.id)).toEqual({ count: 0 });
      expect(check.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE user_id=?`).get(other.id)).toEqual({ count: 1 });
    }
    check.close();
  });

  it('prevents concurrent administrators from both deleting the last active administrator', async () => {
    const first = await register('admin'); const second = await register('second');
    expect((await post(`/api/admin/users/${second.id}/role`, { role: 'admin', reason: '测试角色' }, first.headers)).statusCode).toBe(200);
    const secondLogin = await post('/api/auth/login', { identifier: second.email, password });
    const secondHeaders = { cookie: `session=${secondLogin.cookies.find((item) => item.name === 'session')!.value}` };
    const results = await Promise.all([post('/api/account/delete', { currentPassword: password }, first.headers), post('/api/account/delete', { currentPassword: password }, secondHeaders)]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([200, 409]);
  });

  it('does not delete an account after its password is reset during verification', async () => {
    const alice = await register('alice');
    await post('/api/auth/code', { email: alice.email, purpose: 'reset' });
    let release!: () => void; let started!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { started = resolve; });
    const original = argon2.verify;
    vi.spyOn(argon2, 'verify').mockImplementation(async (...args) => { started(); await waiting; return original(...args); });
    try {
      const pending = post('/api/account/delete', { currentPassword: password }, alice.headers);
      await entered;
      expect((await post('/api/auth/reset', { email: alice.email, password: 'new-password-456', code: codes.get(alice.email) })).statusCode).toBe(200);
      release();
      expect((await pending).statusCode).toBe(401);
      expect((await post('/api/auth/login', { identifier: alice.email, password: 'new-password-456' })).statusCode).toBe(200);
    } finally { release(); }
  });
});
