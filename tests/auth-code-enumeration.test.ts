import { afterEach, expect, it } from 'vitest';
import { createApp } from '../server/app';

let app: Awaited<ReturnType<typeof createApp>> | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

it('applies the same resend cooldown whether a login email exists or not', async () => {
  const messages: Array<{ email: string; code: string }> = [];
  app = await createApp({ databasePath: ':memory:', mailer: { async sendCode(email, code) { messages.push({ email, code }); } } });
  await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'reader@example.test', purpose: 'register' } });
  await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'reader', email: 'reader@example.test', password: 'a-long-password', code: messages[0].code } });
  for (const email of ['reader@example.test', 'unknown@example.test']) {
    const send = () => app!.inject({ method: 'POST', url: '/api/auth/code', payload: { email, purpose: 'login' } });
    expect((await send()).statusCode).toBe(200);
    expect((await send()).statusCode).toBe(429);
  }
  expect(messages.map((message) => message.email)).toEqual(['reader@example.test', 'reader@example.test']);
});
