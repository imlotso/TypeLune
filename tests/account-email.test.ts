import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import argon2 from 'argon2';
import { createApp } from '../server/app';

describe('changing the bound email', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let now: number;
  let failDelivery: boolean;
  let messages: Array<{ email: string; code: string; purpose: string }>;
  const password = 'original-password-123';
  beforeEach(async () => {
    now = 1_800_000_000_000; messages = []; failDelivery = false;
    app = await createApp({ databasePath: ':memory:', now: () => now, secureCookies: false, codeSecret: 'test-secret-kept-out-of-production',
      mailer: { async sendCode(email, code, purpose) { if (failDelivery) throw new Error('delivery failure'); messages.push({ email, code, purpose }); } } });
  });
  afterEach(async () => { vi.restoreAllMocks(); await app.close(); });
  const post = (url: string, payload: Record<string, unknown>, headers?: Record<string, string>) => app.inject({ method: 'POST', url, payload, headers });
  async function register(username: string) {
    const email = `${username}@example.test`;
    await post('/api/auth/code', { email, purpose: 'register' });
    const response = await post('/api/auth/register', { email, username, password, code: messages.at(-1)!.code });
    const user = response.json().user as { id: string };
    return { user, email, headers: { cookie: `session=${response.cookies.find((cookie) => cookie.name === 'session')!.value}`, 'x-workspace-owner': user.id } };
  }
  const requestCode = (headers: Record<string, string>, email: string, currentPassword = password) => post('/api/account/email/code', { email, currentPassword }, headers);
  const confirm = (headers: Record<string, string>, email: string, code: string) => post('/api/account/email/confirm', { email, code }, headers);

  it('keeps the old email until verification and invalidates all sessions after the atomic change', async () => {
    const alice = await register('alice'); const bob = await register('bobby');
    const second = await post('/api/auth/login', { identifier: 'alice', password });
    const secondHeaders = { cookie: `session=${second.cookies.find((item) => item.name === 'session')!.value}` };
    expect((await requestCode(alice.headers, 'bad-email')).statusCode).toBe(400);
    expect((await requestCode(alice.headers, 'new@example.test', 'wrong')).statusCode).toBe(401);
    expect((await requestCode(alice.headers, bob.email)).statusCode).toBe(409);
    expect((await requestCode(alice.headers, 'new@example.test')).statusCode).toBe(200);
    expect(messages.at(-1)).toMatchObject({ email: 'new@example.test', purpose: 'change-email' });
    const code = messages.at(-1)!.code;
    expect((await confirm(alice.headers, 'new@example.test', '000000' === code ? '000001' : '000000')).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: alice.headers })).json().user.email).toBe(alice.email);
    expect((await post('/api/auth/login', { identifier: alice.email, password })).statusCode).toBe(200);
    const changed = await confirm(alice.headers, 'new@example.test', code);
    expect(changed.statusCode).toBe(200);
    expect(changed.body).not.toContain(code);
    expect(changed.cookies).toEqual([]);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: alice.headers })).json().user).toBeNull();
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: secondHeaders })).json().user).toBeNull();
    expect((await post('/api/auth/login', { identifier: alice.email, password })).statusCode).toBe(401);
    expect((await post('/api/auth/login', { identifier: 'new@example.test', password })).statusCode).toBe(200);
    expect((await confirm(alice.headers, 'new@example.test', code)).statusCode).toBe(401);
  });

  it('binds codes to the account and target, rejects expiry, and leaves the old email intact', async () => {
    const alice = await register('alice'); const bob = await register('bobby');
    await requestCode(alice.headers, 'new@example.test');
    const code = messages.at(-1)!.code;
    expect((await confirm(bob.headers, 'new@example.test', code)).statusCode).toBe(400);
    expect((await confirm(alice.headers, 'other@example.test', code)).statusCode).toBe(400);
    now += 10 * 60_000 + 1;
    expect((await confirm(alice.headers, 'new@example.test', code)).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: alice.headers })).json().user.email).toBe(alice.email);
  });

  it('reports mail delivery failure and permits a retry without changing the account', async () => {
    const alice = await register('alice');
    failDelivery = true;
    expect((await requestCode(alice.headers, 'new@example.test')).statusCode).toBe(503);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: alice.headers })).json().user.email).toBe(alice.email);
    failDelivery = false;
    expect((await requestCode(alice.headers, 'new@example.test')).statusCode).toBe(200);
    expect((await requestCode(alice.headers, 'new@example.test')).statusCode).toBe(429);
  });

  it('allows only one account to claim the same new email concurrently', async () => {
    const alice = await register('alice'); const bob = await register('bobby');
    await requestCode(alice.headers, 'new@example.test'); const aliceCode = messages.at(-1)!.code;
    await requestCode(bob.headers, 'new@example.test'); const bobCode = messages.at(-1)!.code;
    const results = await Promise.all([confirm(alice.headers, 'new@example.test', aliceCode), confirm(bob.headers, 'new@example.test', bobCode)]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([200, 409]);
    const remaining = results[0].statusCode === 409 ? alice : bob;
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: remaining.headers })).json().user.email).toBe(remaining.email);
  });

  it('bounds outstanding target codes and frees expired slots', async () => {
    const alice = await register('alice');
    for (let index = 0; index < 5; index++) expect((await requestCode(alice.headers, `target${index}@example.test`)).statusCode).toBe(200);
    expect((await requestCode(alice.headers, 'target5@example.test')).statusCode).toBe(429);
    now += 10 * 60_000 + 1;
    expect((await requestCode(alice.headers, 'target5@example.test')).statusCode).toBe(200);
  });

  it('does not issue a code when the session is revoked during password verification', async () => {
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
      const pending = requestCode(alice.headers, 'new@example.test');
      await entered;
      expect((await post('/api/account/password', { currentPassword: password, newPassword: 'changed-password-123', confirmPassword: 'changed-password-123' }, alice.headers)).statusCode).toBe(200);
      release();
      expect((await pending).statusCode).toBe(401);
      expect(messages.some((message) => message.email === 'new@example.test')).toBe(false);
    } finally { release(); }
  });
});
