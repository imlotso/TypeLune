import { test, expect, ensureAdmin } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { defaultSettings, type WorkspaceItem } from '../src/lib/models';

const password = 'locale-disposable-test-password';
async function register(request: APIRequestContext, username: string) {
  const email = `${username}@example.test`;
  expect((await request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const result = await request.post('/api/auth/register', { data: { email, username, password, code } });
  expect(result.ok()).toBe(true);
  return (await result.json()).user.id as string;
}
const headers = (owner: string) => ({ 'X-Workspace-Owner': owner, 'X-Workspace-Protocol': '2' });
async function cloud(request: APIRequestContext, owner: string) {
  const result = await request.get('/api/workspace', { headers: headers(owner) });
  expect(result.ok()).toBe(true);
  return await result.json() as { items: WorkspaceItem[]; generation: number; serverTime: number };
}
async function preference(request: APIRequestContext, owner: string) {
  return (await cloud(request, owner)).items.find(item => item.kind === 'settings' && item.id === 'preferences')?.value as typeof defaultSettings | undefined;
}
async function seed(request: APIRequestContext, owner: string, uiLocale: 'zh' | 'en' | 'auto', minutes = 9) {
  const current = await cloud(request, owner);
  const old = current.items.find(item => item.kind === 'settings' && item.id === 'preferences');
  const result = await request.post('/api/workspace/sync', { headers: headers(owner), data: { generation: current.generation,
    items: [{ kind: 'settings', id: 'preferences', updatedAt: Math.max(current.serverTime, (old?.updatedAt ?? 0) + 1), baseRevision: old?.serverRevision ?? 0,
      value: { ...defaultSettings, ...old?.value as object, uiLocale, minutes } }] } });
  expect(result.ok()).toBe(true);
}
async function openSettings(page: Page, en = false) {
  await page.getByRole('button', { name: en ? 'More' : '更多', exact: true }).click();
  await page.getByRole('button', { name: en ? 'Settings' : '设置', exact: true }).click();
  return page.getByRole('dialog', { name: en ? 'Practice settings' : '练习设置', exact: true });
}
const workspaceUrl = /\/api\/workspace(?:\/sync)?$/;
const failedSync = { status: 503, contentType: 'application/json', body: JSON.stringify({ error: '测试连接失败' }) };

test('account language follows two independent browsers and both settings entries', async ({ page, browser, baseURL, clientIp }) => {
  const owner = await register(page.request, 'locale_two_browsers');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'locale_two_browsers', exact: true })).toBeVisible();
  const dialog = await openSettings(page);
  await expect(dialog.getByText('已同步', { exact: true })).toBeVisible();
  await dialog.getByRole('combobox', { name: '界面语言', exact: true }).selectOption('en');
  await expect(page.getByRole('dialog', { name: 'Practice settings' }).getByRole('combobox', { name: 'Interface language', exact: true })).toHaveValue('en');
  await expect.poll(async () => (await preference(page.request, owner))?.uiLocale).toBe('en');
  mkdirSync('docs/qa/screenshots/2026-11-16-account-language', { recursive: true });
  await page.screenshot({ path: 'docs/qa/screenshots/2026-11-16-account-language/desktop-practice-settings-en.png' });
  await page.getByRole('dialog', { name: 'Practice settings' }).getByRole('button', { name: 'Close', exact: true }).click();
  const accountButton = await page.getByRole('button', { name: 'locale_two_browsers', exact: true }).boundingBox();
  expect(accountButton).not.toBeNull();
  expect(accountButton!.x + accountButton!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(page.getByRole('group', { name: 'Practice language' }).getByRole('button', { name: 'Chinese', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/account');
  const account = page.getByRole('dialog', { name: 'Account settings', exact: true });
  await expect(account.getByRole('combobox', { name: 'Interface language', exact: true })).toHaveValue('en');
  await page.screenshot({ path: 'docs/qa/screenshots/2026-11-16-account-language/desktop-account-language-en.png' });

  const second = await browser.newContext({ baseURL, locale: 'zh-CN', viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  try {
    expect((await second.request.post('/api/auth/login', { data: { identifier: 'locale_two_browsers', password } })).ok()).toBe(true);
    const mobile = await second.newPage();
    await mobile.goto('/account');
    const form = mobile.getByRole('dialog', { name: 'Account settings', exact: true });
    await expect(form.getByRole('combobox', { name: 'Interface language', exact: true })).toHaveValue('en');
    expect(await mobile.evaluate(() => localStorage.getItem('typelune.ui-locale.v1'))).toBeNull();
    await mobile.screenshot({ path: 'docs/qa/screenshots/2026-11-16-account-language/mobile-account-language-en.png' });
    await form.getByRole('combobox', { name: 'Interface language', exact: true }).selectOption('zh');
    await expect.poll(async () => (await preference(second.request, owner))?.uiLocale).toBe('zh');
    await page.reload();
    await expect(page.getByRole('dialog', { name: '账号设置' }).getByRole('combobox', { name: '界面语言', exact: true })).toHaveValue('zh');
    await page.screenshot({ path: 'docs/qa/screenshots/2026-11-16-account-language/desktop-account-language-zh.png' });
  } finally { await second.close(); }
});

test.describe('automatic account language', () => {
  test.use({ locale: 'en-US' });
  test('a new account follows the browser without writing and explicit changes retain active input', async ({ page }) => {
    const owner = await register(page.request, 'locale_auto_browser');
    let writes = 0;
    page.on('request', request => { if (request.url().endsWith('/api/workspace/sync')) writes++; });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'locale_auto_browser', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Interface language: English. Switch to 中文' })).toBeEnabled();
    expect(writes).toBe(0);
    expect((await preference(page.request, owner))?.uiLocale).toBeUndefined();
    const input = page.getByRole('textbox', { name: 'Current line input', exact: true });
    await input.fill('test');
    await page.getByRole('button', { name: 'Interface language: English. Switch to 中文' }).click();
    await expect(page.getByRole('textbox', { name: '当前行输入', exact: true })).toHaveValue('test');
    await expect.poll(async () => (await preference(page.request, owner))?.uiLocale).toBe('zh');
    const dialog = await openSettings(page);
    await dialog.getByRole('combobox', { name: '界面语言', exact: true }).selectOption('auto');
    const englishDialog = page.getByRole('dialog', { name: 'Practice settings', exact: true });
    await expect(englishDialog.getByRole('combobox', { name: 'Interface language', exact: true })).toHaveValue('auto');
    await expect.poll(async () => (await preference(page.request, owner))?.uiLocale).toBe('auto');
    await englishDialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(input).toHaveValue('test');
    await expect(page.getByRole('group', { name: 'Practice language' }).getByRole('button', { name: 'Chinese', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
});

test('slow initial cloud settings do not upload browser defaults over the account', async ({ page }) => {
  const owner = await register(page.request, 'locale_slow_cloud');
  await seed(page.request, owner, 'en', 9);
  let release!: () => void, requested!: () => void;
  const seen = new Promise<void>(resolve => { requested = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  page.on('request', request => { if (request.url().endsWith('/api/workspace/sync')) writes++; });
  await page.route('**/api/workspace', async route => { const response = await route.fetch(); requested(); await gate; await route.fulfill({ response }); });
  try {
    await page.goto('/'); await seen;
    await expect(page.getByRole('button', { name: '界面语言：中文，切换为 English' })).toBeDisabled();
    expect(writes).toBe(0);
    release();
    await expect(page.getByRole('button', { name: 'Interface language: English. Switch to 中文' })).toBeEnabled();
    const saved = await preference(page.request, owner);
    expect(saved).toMatchObject({ uiLocale: 'en', minutes: 9 });
    expect(writes).toBe(0);
  } finally { release(); }
});

test('cached offline language survives reload, retries, and refuses a competing cloud revision', async ({ page }) => {
  const owner = await register(page.request, 'locale_offline');
  await seed(page.request, owner, 'zh', 9);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'locale_offline', exact: true })).toBeVisible();
  const toggle = page.getByRole('button', { name: '界面语言：中文，切换为 English' });
  await expect(toggle).toBeEnabled();
  await page.route(workspaceUrl, route => route.fulfill(failedSync));
  await toggle.click();
  let dialog = await openSettings(page, true);
  await expect(dialog.getByText('Sync failed', { exact: true })).toBeVisible();
  await page.reload();
  dialog = await openSettings(page, true);
  await expect(dialog.getByRole('combobox', { name: 'Interface language', exact: true })).toHaveValue('en');
  await page.unroute(workspaceUrl);
  await dialog.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(dialog.getByText('Synced', { exact: true })).toBeVisible();
  expect(await preference(page.request, owner)).toMatchObject({ uiLocale: 'en', minutes: 9 });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.route(workspaceUrl, route => route.fulfill(failedSync));
  await page.getByRole('button', { name: 'Interface language: English. Switch to 中文' }).click();
  dialog = await openSettings(page);
  await expect(dialog.getByText('同步失败', { exact: true })).toBeVisible();
  // Independent server-side change represents a second device. Browser interception does not affect APIRequestContext.
  await seed(page.request, owner, 'auto', 7);
  await page.unroute(workspaceUrl);
  await dialog.getByRole('button', { name: '立即同步', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '处理同步冲突' })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: '界面语言', exact: true })).toHaveValue('zh');
  await expect(dialog.getByRole('combobox', { name: '界面语言', exact: true })).toBeDisabled();
  expect(await preference(page.request, owner)).toMatchObject({ uiLocale: 'auto', minutes: 7 });
});

test('a first-device sync failure cannot save an unknown account over cloud preferences', async ({ page }) => {
  const owner = await register(page.request, 'locale_no_cache');
  await seed(page.request, owner, 'en', 11);
  let writes = 0;
  page.on('request', request => { if (request.url().endsWith('/api/workspace/sync')) writes++; });
  await page.route(workspaceUrl, route => route.fulfill(failedSync));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'locale_no_cache', exact: true })).toBeVisible();
  const dialog = await openSettings(page);
  await expect(dialog.getByText('同步失败', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: '界面语言', exact: true })).toBeDisabled();
  expect(writes).toBe(0);
  expect(await preference(page.request, owner)).toMatchObject({ uiLocale: 'en', minutes: 11 });
  await page.unroute(workspaceUrl);
  await dialog.getByRole('button', { name: '立即同步', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Practice settings' }).getByRole('combobox', { name: 'Interface language', exact: true })).toHaveValue('en');
  expect(writes).toBe(0);
});

test('identity change ignores a delayed former account and restores the separate guest language', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '界面语言：中文，切换为 English' }).click();
  const owner = await register(page.request, 'locale_old_owner');
  await seed(page.request, owner, 'en');
  let release!: () => void, requested!: () => void;
  const seen = new Promise<void>(resolve => { requested = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/workspace', async route => {
    if (route.request().headers()['x-workspace-owner'] !== owner) return route.continue();
    try { const response = await route.fetch(); requested(); await gate; await route.fulfill({ response }); } catch { requested(); }
  });
  try {
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await seen;
    expect((await page.request.post('/api/auth/logout', { data: {} })).ok()).toBe(true);
    const other = await register(page.request, 'locale_new_owner');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('button', { name: 'locale_new_owner', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '界面语言：中文，切换为 English' })).toBeEnabled();
    release();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    expect((await preference(page.request, other))?.uiLocale).toBeUndefined();
    expect((await page.request.post('/api/auth/logout', { data: {} })).ok()).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await page.evaluate(() => localStorage.getItem('typelune.ui-locale.v1'))).toBe('en');
  } finally { release(); }
});

test('administration and its front-site account settings use the same saved preference', async ({ page }) => {
  await ensureAdmin(page.request);
  await page.goto('/admin?tab=overview');
  await expect(page.getByRole('button', { name: '界面语言：中文，切换为 English' })).toBeEnabled();
  await page.getByRole('button', { name: '界面语言：中文，切换为 English' }).click();
  await page.getByRole('button', { name: 'Preview site', exact: true }).click();
  await page.getByRole('button', { name: 'ci_admin', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Account settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Account settings', exact: true });
  await expect(dialog.getByRole('combobox', { name: 'Interface language', exact: true })).toHaveValue('en');
  await expect(dialog.getByText('Synced', { exact: true })).toBeVisible();
  await page.reload();
  // Session restoration deliberately reopens the independent admin shell.
  // Preview is explicit, but the saved interface preference survives both shells.
  await expect(page.getByRole('main', { name: 'Administration workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Preview site', exact: true }).click();
  await page.getByRole('button', { name: 'ci_admin', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Account settings', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Interface language', exact: true })).toHaveValue('en');
  await dialog.getByRole('combobox', { name: 'Interface language', exact: true }).selectOption('zh');
  const chinese = page.getByRole('dialog', { name: '账号设置', exact: true });
  await expect(chinese.getByText('已同步', { exact: true })).toBeVisible();
  await chinese.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: 'ci_admin', exact: true }).click();
  await page.getByRole('menuitem', { name: '返回后台', exact: true }).click();
  await expect(page.getByRole('main', { name: '管理工作区' })).toBeVisible();
  await expect(page.getByRole('button', { name: '界面语言：中文，切换为 English' })).toBeEnabled();
});
