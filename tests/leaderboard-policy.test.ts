import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';

describe('leaderboard policy and board visibility', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let now: number;
  const codes = new Map<string, string>();
  const guest = { 'x-workspace-owner': 'guest', cookie: `guest=${randomBytes(32).toString('base64url')}` };
  let admin: Record<string, string>; let reader: Record<string, string>;
  const password = 'test-password-123';
  const post = (url: string, payload: object, headers?: Record<string, string>) => app.inject({ method: 'POST', url, payload, headers });
  const get = (url: string, headers?: Record<string, string>) => app.inject({ url, headers });
  async function register(username: string) {
    const email = `${username}@example.test`;
    expect((await post('/api/auth/code', { email, purpose: 'register' })).statusCode).toBe(200);
    const response = await post('/api/auth/register', { email, username, password, code: codes.get(email) });
    expect(response.statusCode).toBe(200);
    return { cookie: `session=${response.cookies.find((item) => item.name === 'session')!.value}`, 'x-workspace-owner': response.json().user.id as string };
  }
  async function complete(headers: Record<string, string>) {
    const started = await post('/api/tests/start', { articleId: 'zh-beginner-1', duration: 60 }, headers);
    expect(started.statusCode).toBe(200);
    const { id, target } = started.json() as { id: string; target: string };
    for (const [increment, length] of [[15_000, 2], [15_000, 4], [15_000, 6], [10_000, 8]]) {
      now += increment;
      expect((await post(`/api/tests/${id}/checkpoint`, { typed: target.slice(0, length) }, headers)).statusCode).toBe(200);
    }
    now += 5000;
    expect((await post(`/api/tests/${id}/finish`, { typed: target.slice(0, 8) }, headers)).json().status).toBe('finished');
    return id;
  }
  const board = (kind: 'guest' | 'user', headers?: Record<string, string>) =>
    get(`/api/leaderboard?language=zh&difficulty=beginner&duration=60&board=${kind}`, headers);
  beforeEach(async () => {
    now = 1_800_000_000_000; codes.clear();
    app = await createApp({ databasePath: ':memory:', secureCookies: false, now: () => now, adminEmail: 'owner@example.test',
      mailer: { async sendCode(email, code) { codes.set(email, code); } } });
    admin = await register('owner'); reader = await register('reader');
  });
  afterEach(async () => { await app.close(); });

  it('requires the visitor prefix and reviews guest scores before showing them on the guest board', async () => {
    const id = await complete(guest);
    expect((await post('/api/leaderboard', { attemptId: id, nickname: '云朵' }, guest)).statusCode).toBe(400);
    expect((await post('/api/leaderboard', { attemptId: id, nickname: 'visitor-云朵' }, guest)).json()).toEqual({ status: 'review' });
    expect((await board('guest')).json().entries).toEqual([]);
    expect((await get('/api/admin/scores?status=pending', admin)).json().entries).toEqual([expect.objectContaining({ id, reasons: expect.arrayContaining(['guest_policy']) })]);
    expect((await post('/api/admin/scores/moderate', { ids: [id], action: 'approve', reason: '核对完成' }, admin)).statusCode).toBe(200);
    expect((await board('guest')).json().entries).toEqual([expect.objectContaining({ attemptId: id, nickname: 'visitor-云朵' })]);
    expect((await board('user')).json().entries).toEqual([]);
  });

  it('publishes clean registered-user scores by default and allows administrators to reject them', async () => {
    const id = await complete(reader);
    expect((await post('/api/leaderboard', { attemptId: id }, reader)).json()).toEqual({ status: 'ranked' });
    expect((await board('user')).json().entries).toEqual([expect.objectContaining({ attemptId: id, nickname: 'reader' })]);
    expect((await board('guest')).json().entries).toEqual([]);
    expect((await post('/api/admin/scores/moderate', { ids: [id], action: 'reject', reason: '重新核对', publicMessage: '请重新练习' }, admin)).statusCode).toBe(200);
    expect((await board('user')).json().entries).toEqual([]);
    expect((await get(`/api/tests/${id}/score-status`, reader)).json()).toMatchObject({ state: 'rejected', message: '请重新练习' });
  });

  it('allows review policies to change without bypassing the existing risk checks', async () => {
    const config = (await get('/api/admin/settings/site', admin)).json();
    expect((await post('/api/admin/settings/site', { settings: { ...config.settings, guestReviewRequired: false, userReviewRequired: true }, revision: config.revision }, admin)).statusCode).toBe(200);
    const cleanGuest = await complete(guest);
    expect((await post('/api/leaderboard', { attemptId: cleanGuest, nickname: 'visitor-clean' }, guest)).json()).toEqual({ status: 'ranked' });
    const cleanUser = await complete(reader);
    expect((await post('/api/leaderboard', { attemptId: cleanUser }, reader)).json()).toEqual({ status: 'review' });
    const started = (await post('/api/tests/start', { articleId: 'zh-beginner-1', duration: 60 }, guest)).json();
    now += 2000;
    expect((await post(`/api/tests/${started.id}/pause`, {}, guest)).statusCode).toBe(200);
    expect((await post(`/api/tests/${started.id}/finish`, { typed: started.target.slice(0, 2) }, guest)).statusCode).toBe(200);
    expect((await post('/api/leaderboard', { attemptId: started.id, nickname: 'visitor-paused' }, guest)).json()).toEqual({ status: 'review' });
    const pending = (await get('/api/admin/scores?status=pending', admin)).json().entries;
    expect(pending.find((row: { id: string }) => row.id === started.id).reasons).toContain('paused_session');
    expect(pending.find((row: { id: string }) => row.id === cleanUser).reasons).toContain('user_policy');
  });

  it('honors an administrator display window without deleting published results', async () => {
    const id = await complete(reader);
    expect((await post('/api/leaderboard', { attemptId: id }, reader)).statusCode).toBe(200);
    const config = (await get('/api/admin/settings/site', admin)).json();
    expect((await post('/api/admin/settings/site', { settings: { ...config.settings, leaderboardDisplayDays: 1 }, revision: config.revision }, admin)).statusCode).toBe(200);
    now += 2 * 86_400_000;
    expect((await board('user')).json().entries).toEqual([]);
    expect((await get(`/api/tests/${id}/score-status`, reader)).json()).toMatchObject({ state: 'published', message: '已超出当前排行榜展示期限' });
    const current = (await get('/api/admin/settings/site', admin)).json();
    expect((await post('/api/admin/settings/site', { settings: { ...current.settings, leaderboardDisplayDays: 0 }, revision: current.revision }, admin)).statusCode).toBe(200);
    expect((await board('user')).json().entries).toEqual([expect.objectContaining({ attemptId: id })]);
  });
});
