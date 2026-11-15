import { createHash } from 'node:crypto';
import { test as base } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

export { expect } from '@playwright/test';

export async function ensureAdmin(request: APIRequestContext) {
  const email = 'admin@example.test'; const password = 'ci-password-123';
  let response = await request.post('/api/auth/login', { data: { identifier: email, password } });
  if (!response.ok()) {
    const sent = await request.post('/api/auth/code', { data: { email, purpose: 'register' } });
    if (!sent.ok()) throw new Error(`Test admin verification request failed: ${sent.status()}`);
    const code = (await (await request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
    response = await request.post('/api/auth/register', { data: { username: 'ci_admin', email, password, code } });
  }
  if (!response.ok() || !(await response.json()).user.isAdmin) throw new Error('Test administrator could not be initialized');
}

export const test = base.extend<{ clientIp: string }>({
  clientIp: [async ({ context }, use, testInfo) => {
    const bytes = createHash('sha256').update(`${testInfo.testId}:${testInfo.retry}`).digest();
    const clientIp = `10.${bytes[0]}.${bytes[1]}.${bytes[2]}`;
    await context.setExtraHTTPHeaders({ 'X-Forwarded-For': clientIp });
    await use(clientIp);
  }, { auto: true }],
});
