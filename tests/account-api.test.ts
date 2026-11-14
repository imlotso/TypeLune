import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import argon2 from 'argon2';
import { createApp } from '../server/app';

describe('account identity changes', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let codes: Map<string, string>;
  let now: number;
  const password = 'original-password-123';

  beforeEach(async () => {
    codes = new Map(); now = Date.now();
    app = await createApp({ databasePath: ':memory:', secureCookies: false, now: () => now,
      mailer: { async sendCode(email, code) { codes.set(email, code); } } });
  });
  afterEach(async () => { vi.restoreAllMocks(); await app.close(); });

  async function register(username: string) {
    const email = `${username}@example.test`;
    await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email, purpose: 'register' } });
    const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username, email, password, code: codes.get(email) } });
    expect(response.statusCode).toBe(200);
    const user = response.json().user as { id: string; username: string };
    const cookie = `session=${response.cookies.find((item) => item.name === 'session')!.value}`;
    return { user, headers: { cookie, 'x-workspace-owner': user.id }, email };
  }
  const post = (url: string, payload: Record<string, unknown>, headers?: Record<string, string>) => app.inject({ method: 'POST', url, payload, headers });
  const me = (headers: Record<string, string>) => app.inject({ method: 'GET', url: '/api/me', headers });

  it('renames a verified account without changing its ID, email login or workspace', async () => {
    const alice = await register('alice');
    await register('other');
    const item = { kind: 'favorite', id: 'zh-beginner-1', updatedAt: Date.now(), value: { articleId: 'zh-beginner-1' } };
    expect((await post('/api/workspace/sync', { items: [item] }, alice.headers)).statusCode).toBe(200);
    expect((await post('/api/account/username', { username: 'new_name', currentPassword: 'wrong' }, alice.headers)).statusCode).toBe(401);
    expect((await post('/api/account/username', { username: 'a!', currentPassword: password }, alice.headers)).statusCode).toBe(400);
    expect((await post('/api/account/username', { username: 'OTHER', currentPassword: password }, alice.headers)).statusCode).toBe(409);
    const renamed = await post('/api/account/username', { username: 'new_name', currentPassword: password }, alice.headers);
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().user).toMatchObject({ id: alice.user.id, username: 'new_name', email: alice.email, displayName: 'alice' });
    expect((await me(alice.headers)).json().user.username).toBe('new_name');
    expect((await app.inject({ method: 'GET', url: '/api/workspace', headers: alice.headers })).json().items).toEqual([item]);
    expect((await post('/api/auth/login', { identifier: 'alice', password })).statusCode).toBe(401);
    expect((await post('/api/auth/login', { identifier: 'new_name', password })).statusCode).toBe(200);
    expect((await post('/api/auth/login', { identifier: alice.email, password })).statusCode).toBe(200);
  });

  it('changes a password only with correct confirmation and revokes all sessions', async () => {
    const alice = await register('alice'); const other = await register('other');
    const second = await post('/api/auth/login', { identifier: 'alice', password });
    const secondHeaders = { cookie: `session=${second.cookies.find((item) => item.name === 'session')!.value}` };
    const url = '/api/account/password';
    expect((await post(url, { currentPassword: 'wrong', newPassword: 'new-password-123', confirmPassword: 'new-password-123' }, alice.headers)).statusCode).toBe(401);
    expect((await post(url, { currentPassword: password, newPassword: 'short', confirmPassword: 'short' }, alice.headers)).statusCode).toBe(400);
    expect((await post(url, { currentPassword: password, newPassword: 'new-password-123', confirmPassword: 'different-password' }, alice.headers)).statusCode).toBe(400);
    expect((await post(url, { currentPassword: password, newPassword: 'new-password-123', confirmPassword: 'new-password-123' }, { ...other.headers, 'x-workspace-owner': alice.user.id })).statusCode).toBe(403);
    const changed = await post(url, { currentPassword: password, newPassword: 'new-password-123', confirmPassword: 'new-password-123' }, alice.headers);
    expect(changed.statusCode).toBe(200);
    expect(changed.body).not.toContain('new-password-123');
    expect(changed.cookies).toEqual([]);
    expect((await me(alice.headers)).json().user).toBeNull();
    expect((await me(secondHeaders)).json().user).toBeNull();
    expect((await me(other.headers)).json().user.id).toBe(other.user.id);
    expect((await post('/api/auth/login', { identifier: 'alice', password })).statusCode).toBe(401);
    expect((await post('/api/auth/login', { identifier: 'alice', password: 'new-password-123' })).statusCode).toBe(200);
  });

  it('does not rename with a session revoked while its password is being verified', async () => {
    const alice = await register('alice');
    let release!: () => void; let started!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { started = resolve; });
    const original = argon2.verify;
    let first = true;
    vi.spyOn(argon2, 'verify').mockImplementation(async (...args) => {
      if (first) { first = false; started(); await waiting; }
      return original(...args);
    });
    try {
      const rename = post('/api/account/username', { username: 'new_name', currentPassword: password }, alice.headers);
      await entered;
      const changed = await post('/api/account/password', { currentPassword: password, newPassword: 'new-password-123', confirmPassword: 'new-password-123' }, alice.headers);
      expect(changed.statusCode).toBe(200);
      release();
      expect([401, 409]).toContain((await rename).statusCode);
      expect((await post('/api/auth/login', { identifier: 'new_name', password: 'new-password-123' })).statusCode).toBe(401);
      expect((await post('/api/auth/login', { identifier: 'alice', password: 'new-password-123' })).statusCode).toBe(200);
    } finally { release(); }
  });

  it('allows only one concurrent claimant of a username', async () => {
    const alice = await register('alice'); const bob = await register('bobby');
    const responses = await Promise.all([alice, bob].map(({ headers }) => post('/api/account/username', { username: 'shared_name', currentPassword: password }, headers)));
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
  });

  it('keeps a public nickname independent from login and uses its current value on the leaderboard', async () => {
    const alice = await register('alice');
    const start = await post('/api/tests/start', { articleId: 'zh-beginner-1', duration: 60 }, alice.headers);
    const challenge = start.json();
    for (const [length, elapsed] of [[2, 15_000], [4, 15_000], [6, 15_000], [8, 10_000]]) {
      now += elapsed;
      expect((await post(`/api/tests/${challenge.id}/checkpoint`, { typed: challenge.target.slice(0, length) }, alice.headers)).statusCode).toBe(200);
    }
    now += 5_000;
    expect((await post(`/api/tests/${challenge.id}/finish`, { typed: challenge.target.slice(0, 10) }, alice.headers)).statusCode).toBe(200);
    expect((await post('/api/leaderboard', { attemptId: challenge.id }, alice.headers)).json().status).toBe('ranked');
    const board = () => app.inject({ method: 'GET', url: '/api/leaderboard?language=zh&difficulty=beginner&duration=60' });
    expect((await board()).json().entries[0].nickname).toBe('alice');
    expect((await post('/api/account/username', { username: 'new_name', currentPassword: password }, alice.headers)).statusCode).toBe(200);
    expect((await board()).json().entries[0].nickname).toBe('alice');
    expect((await post('/api/account/profile', { displayName: '', avatar: 'cloud' }, alice.headers)).statusCode).toBe(400);
    expect((await post('/api/account/profile', { displayName: '云光', avatar: 'invalid' }, alice.headers)).statusCode).toBe(400);
    const updated = await post('/api/account/profile', { displayName: '云光', avatar: 'star' }, alice.headers);
    expect(updated.statusCode).toBe(200);
    expect(updated.json().user).toMatchObject({ username: 'new_name', displayName: '云光', avatar: 'star' });
    expect((await board()).json().entries[0].nickname).toBe('云光');
    expect((await me(alice.headers)).json().user).toMatchObject({ username: 'new_name', displayName: '云光', avatar: 'star' });
    expect((await post('/api/account/profile', { displayName: '云光', avatar: null }, alice.headers)).json().user.avatar).toBeNull();
  });
});
