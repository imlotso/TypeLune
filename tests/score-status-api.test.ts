import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';

describe('public score status', () => {
  let app: Awaited<ReturnType<typeof createApp>>; let now: number; const codes = new Map<string, string>();
  beforeEach(async () => {
    now = Date.now(); codes.clear();
    app = await createApp({ databasePath: ':memory:', secureCookies: false, now: () => now, adminEmail: 'owner@example.test', mailer: { async sendCode(email, code) { codes.set(email, code); } } });
  });
  afterEach(async () => { await app.close(); });
  async function register(username: string) {
    const email = `${username}@example.test`;
    await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email, purpose: 'register' } });
    const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, username, password: 'test-password-123', code: codes.get(email) } });
    expect(response.statusCode).toBe(200);
    return { id: response.json().user.id as string, headers: { cookie: `session=${response.cookies.find((cookie) => cookie.name === 'session')!.value}` } };
  }
  const post = (url: string, payload: Record<string, unknown>, headers: Record<string, string>) => app.inject({ method: 'POST', url, payload, headers });
  const get = (url: string, headers: Record<string, string>) => app.inject({ method: 'GET', url, headers });
  async function finish(headers: Record<string, string>, count: number) {
    const started = (await post('/api/tests/start', { articleId: 'zh-beginner-1', duration: 60 }, headers)).json();
    now += 2000;
    expect((await post(`/api/tests/${started.id}/pause`, {}, headers)).statusCode).toBe(200);
    expect((await post(`/api/tests/${started.id}/finish`, { typed: started.target.slice(0, count) }, headers)).statusCode).toBe(200);
    return started.id as string;
  }
  it('distinguishes unsubmitted, review, rejected, approved and removed without disclosing internal reasons', async () => {
    const admin = await register('owner'); const reader = await register('reader'); const other = await register('other');
    const rejected = await finish(reader.headers, 4);
    expect((await get(`/api/tests/${rejected}/score-status`, reader.headers)).json()).toMatchObject({ state: 'not_submitted', eligible: true });
    expect((await get('/api/history?limit=100', reader.headers)).json().entries[0].scoreStatus.state).toBe('not_submitted');
    expect((await get(`/api/tests/${rejected}/score-status`, other.headers)).statusCode).toBe(404);
    expect((await post('/api/leaderboard', { attemptId: rejected }, reader.headers)).json().status).toBe('review');
    expect((await get(`/api/tests/${rejected}/score-status`, reader.headers)).json().state).toBe('pending');
    expect((await post('/api/admin/scores/moderate', { ids: [rejected], action: 'reject', reason: '内部风险细节', publicMessage: '请重新练习后提交' }, admin.headers)).statusCode).toBe(200);
    const rejectedStatus = await get(`/api/tests/${rejected}/score-status`, reader.headers);
    expect(rejectedStatus.json()).toMatchObject({ state: 'rejected', message: '请重新练习后提交' });
    expect(rejectedStatus.body).not.toContain('内部风险细节');
    const approved = await finish(reader.headers, 5);
    expect((await post('/api/leaderboard', { attemptId: approved }, reader.headers)).json().status).toBe('review');
    expect((await post('/api/admin/scores/moderate', { ids: [approved], action: 'approve', reason: '内部审核备注' }, admin.headers)).statusCode).toBe(200);
    expect((await get(`/api/tests/${approved}/score-status`, reader.headers)).json().state).toBe('ranked');
    expect((await post('/api/admin/scores/moderate', { ids: [approved], action: 'remove', reason: '内部下架备注' }, admin.headers)).statusCode).toBe(200);
    const history = await get('/api/history?limit=100', reader.headers);
    expect(history.json().entries.find((entry: { recordId: string }) => entry.recordId === approved).scoreStatus.state).toBe('removed');
    expect(history.body).not.toContain('内部下架备注');
  });
  it('reports ineligible and expired results without claiming that they were submitted', async () => {
    const reader = await register('reader');
    const empty = await finish(reader.headers, 0);
    expect((await get(`/api/tests/${empty}/score-status`, reader.headers)).json()).toMatchObject({ state: 'ineligible', eligible: false });
    const valid = await finish(reader.headers, 2);
    now += 600_001;
    expect((await get(`/api/tests/${valid}/score-status`, reader.headers)).json()).toMatchObject({ state: 'not_submitted', expired: true });
    expect((await get(`/api/tests/${valid}/score-status`, { ...reader.headers, 'x-workspace-owner': 'different' })).statusCode).toBe(403);
  });
  it('does not call a lower published result the owner’s displayed overall best', async () => {
    const admin = await register('owner'); const reader = await register('reader');
    const high = await finish(reader.headers, 8);
    await post('/api/leaderboard', { attemptId: high }, reader.headers);
    await post('/api/admin/scores/moderate', { ids: [high], action: 'approve', reason: '核对' }, admin.headers);
    const low = await finish(reader.headers, 2);
    await post('/api/leaderboard', { attemptId: low }, reader.headers);
    await post('/api/admin/scores/moderate', { ids: [low], action: 'approve', reason: '核对' }, admin.headers);
    expect((await get(`/api/tests/${high}/score-status`, reader.headers)).json().state).toBe('ranked');
    expect((await get(`/api/tests/${low}/score-status`, reader.headers)).json().state).toBe('published');
    expect((await post('/api/admin/scores/moderate', { ids: [high], action: 'remove', reason: '核对' }, admin.headers)).statusCode).toBe(200);
    expect((await get(`/api/tests/${low}/score-status`, reader.headers)).json().state).toBe('ranked');
  });
});
