import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

// Run against the isolated e2e server serving an older client build; never use
// this verification against a production server or a real account.
const baseURL = process.env.TYPING_LEGACY_TEST_URL;
if (!baseURL || !/^http:\/\/127\.0\.0\.1:\d+$/u.test(baseURL)) throw new Error('Set TYPING_LEGACY_TEST_URL to the isolated local test server');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL });
const page = await context.newPage();
try {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const email = `old-client-${suffix}@example.test`; const username = `old${suffix}`; const password = 'old-client-password-123';
  let response = await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } });
  if (!response.ok()) throw new Error(`code request: ${response.status()}`);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  response = await page.request.post('/api/auth/register', { data: { username, email, password, code } });
  if (!response.ok()) throw new Error(`register: ${response.status()}`);
  const owner = (await response.json()).user.id;
  await page.goto('/');
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '练习设置' });
  await expect(settings.getByText('已同步')).toBeVisible({ timeout: 15000 });
  const legacy = { ownerId: owner, language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 99, finishedAt: 1000, typed: '山' };
  await page.evaluate((record) => localStorage.setItem('cloudtyping.history.v1', JSON.stringify([record])), legacy);
  const id = `legacy-conflict-${'a'.repeat(64)}`;
  response = await page.request.post('/api/history/delete', { headers: { 'X-Workspace-Owner': owner }, data: { ids: [id], localConflicts: [id] } });
  if (!response.ok()) throw new Error(`conflict deletion: ${response.status()}`);
  const rejected = page.waitForResponse((entry) => entry.url().endsWith('/api/workspace/sync') && entry.status() === 426, { timeout: 15000 });
  await settings.getByRole('checkbox', { name: '显示速度' }).uncheck();
  const failure = await rejected;
  if ((await failure.json()).code !== 'SYNC_CLIENT_UPDATE_REQUIRED') throw new Error('wrong failure code');
  await expect(settings.getByText(/同步版本过旧/)).toBeVisible();
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('cloudtyping.history.v1') || '[]'));
  if (kept.length !== 1 || kept[0].typed !== '山') throw new Error('legacy local record was lost');
  if (process.env.TYPING_LEGACY_SCREENSHOT) await page.screenshot({ path: process.env.TYPING_LEGACY_SCREENSHOT });
  console.log('Old client displayed the upgrade warning after HTTP 426 and kept its local record.');
} finally { await context.close(); await browser.close(); }
