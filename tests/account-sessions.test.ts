import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import argon2 from 'argon2';
import { createApp } from '../server/app';

describe('account sessions', () => {
  let app: Awaited<ReturnType<typeof createApp>>; let now: number; let codes: Map<string, string>;
  const password = 'session-password-123';
  beforeEach(async () => {
    now = 1_800_000_000_000; codes = new Map();
    app = await createApp({ databasePath: ':memory:', now: () => now, secureCookies: false,
      mailer: { async sendCode(email, code) { codes.set(email, code); } } });
  });
  afterEach(async () => { vi.restoreAllMocks(); await app.close(); });
  const post = (url: string, payload: Record<string, unknown>, headers?: Record<string, string>) => app.inject({ method: 'POST', url, payload, headers });
  const get = (url: string, headers?: Record<string, string>) => app.inject({ method: 'GET', url, headers });
  async function register(username: string) {
    const email = `${username}@example.test`;
    await post('/api/auth/code', { email, purpose: 'register' });
    const result = await post('/api/auth/register', { username, email, password, code: codes.get(email) }, { 'user-agent': 'TestBrowser Linux' });
    const user = result.json().user as { id: string };
    return { id: user.id, cookie: `session=${result.cookies.find((cookie) => cookie.name === 'session')!.value}` };
  }
  async function login(username: string, agent: string) {
    const result = await post('/api/auth/login', { identifier: username, password }, { 'user-agent': agent });
    return { cookie: `session=${result.cookies.find((cookie) => cookie.name === 'session')!.value}` };
  }
  it('lists only the account sessions and revokes an individual session or all others', async () => {
    const alice = await register('alice'); const bob = await register('bobby');
    const second = await login('alice', 'Mozilla/5.0 (Windows NT 10.0) Chrome/123.0');
    const third = await login('alice', 'Mozilla/5.0 (Linux; Android 14) Chrome/123.0');
    const headers = { cookie: alice.cookie, 'x-workspace-owner': alice.id };
    const response = await get('/api/account/sessions', headers);
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(alice.cookie.slice(8));
    const sessions = response.json().sessions as Array<{ id: string; current: boolean; device: string; createdAt: number; lastActiveAt: number }>;
    expect(sessions).toHaveLength(3);
    expect(sessions.filter((session) => session.current)).toHaveLength(1);
    expect(sessions.some((session) => session.device.includes('Windows'))).toBe(true);
    expect(sessions.every((session) => session.createdAt === now)).toBe(true);
    const current = sessions.find((session) => session.current)!;
    const other = sessions.find((session) => !session.current)!;
    expect((await get('/api/account/sessions', { cookie: bob.cookie, 'x-workspace-owner': alice.id })).statusCode).toBe(403);
    expect((await post('/api/account/sessions/revoke', { id: other.id }, { cookie: bob.cookie })).statusCode).toBe(404);
    expect((await post('/api/account/sessions/revoke', { id: other.id }, headers)).statusCode).toBe(200);
    expect((await get('/api/account/sessions', headers)).json().sessions).toHaveLength(2);
    const another = [second, third];
    expect((await Promise.all(another.map((value) => get('/api/me', value)))).filter((result) => result.json().user === null)).toHaveLength(1);
    expect((await post('/api/account/sessions/revoke-others', {}, headers)).statusCode).toBe(200);
    for (const session of another) expect((await get('/api/me', session)).json().user).toBeNull();
    now += 61_000;
    await get('/api/me', headers);
    expect((await get('/api/account/sessions', headers)).json().sessions[0].lastActiveAt).toBe(now);
    expect((await post('/api/account/sessions/revoke', { id: current.id }, headers)).json()).toMatchObject({ current: true });
    expect((await get('/api/me', headers)).json().user).toBeNull();
  });

  it('does not let an already-started login recreate a session after revoking other devices', async () => {
    const alice = await register('alice');
    let release!: () => void; let started!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { started = resolve; });
    const original = argon2.verify;
    vi.spyOn(argon2, 'verify').mockImplementation(async (...args) => { started(); await waiting; return original(...args); });
    try {
      const pending = post('/api/auth/login', { identifier: 'alice', password });
      await entered;
      expect((await post('/api/account/sessions/revoke-others', {}, { cookie: alice.cookie })).statusCode).toBe(200);
      release();
      expect((await pending).statusCode).toBe(401);
      expect((await get('/api/account/sessions', { cookie: alice.cookie })).json().sessions).toHaveLength(1);
    } finally { release(); }
  });
});
