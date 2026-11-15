import { readFile } from 'node:fs/promises';
import { ensureAdmin, expect, test } from './fixtures';

test('exports and permanently deletes a test account while revoking its other session', async ({ page, browser, clientIp }) => {
  const email = 'delete_user@example.test'; const username = 'delete_user'; const password = 'delete-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const registration = await page.request.post('/api/auth/register', { data: { username, email, password, code } });
  expect(registration.ok()).toBe(true);
  const ownerId = (await registration.json()).user.id as string;
  const favorite = { kind: 'favorite', id: 'zh-beginner-1', updatedAt: Date.now(), value: { articleId: 'zh-beginner-1' } };
  expect((await page.request.post('/api/workspace/sync', { headers: { 'X-Workspace-Protocol': '2' }, data: { generation: 1, items: [{ ...favorite, baseRevision: 0 }] } })).ok()).toBe(true);
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  expect((await other.request.post('/api/auth/login', { data: { identifier: username, password } })).ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '账号设置' }).click();
  const dialog = page.getByRole('dialog', { name: '账号设置' });
  await dialog.locator('summary').filter({ hasText: '注销账号' }).click();
  await expect(dialog.getByText(/离线设备副本无法即时清除/)).toBeVisible();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '导出个人数据' }).click();
  const exported = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(exported.account.id).toBe(ownerId);
  expect(exported.data.favorites).toContainEqual({ articleId: 'zh-beginner-1' });
  await dialog.getByLabel('当前密码（注销）', { exact: true }).fill(password);
  await dialog.getByRole('checkbox', { name: '我了解注销无法恢复' }).check();
  await dialog.getByRole('button', { name: '永久注销账号' }).click();
  await expect(page.getByText('账号已注销，本机账号数据已清理')).toBeVisible();
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
  expect((await (await other.request.get('/api/me')).json()).user).toBeNull();
  expect((await other.request.post('/api/auth/login', { data: { identifier: email, password } })).status()).toBe(401);
  const local = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cloudtyping-workspace', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const values = await new Promise<unknown[]>((resolve, reject) => { const request = db.transaction('items').objectStore('items').index('owner').getAll(`user:${id}`); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); return values;
  }, ownerId);
  expect(local).toHaveLength(0);
  await other.close();
});

test('the last administrator cannot delete their account', async ({ page }) => {
  await ensureAdmin(page.request);
  await page.goto('/');
  await page.getByRole('button', { name: '预览网站' }).click();
  await page.getByRole('button', { name: 'ci_admin', exact: true }).click();
  await page.getByRole('menuitem', { name: '账号设置' }).click();
  const dialog = page.getByRole('dialog', { name: '账号设置' });
  await dialog.locator('summary').filter({ hasText: '注销账号' }).click();
  await dialog.getByLabel('当前密码（注销）', { exact: true }).fill('ci-password-123');
  await dialog.getByRole('checkbox', { name: '我了解注销无法恢复' }).check();
  await dialog.getByRole('button', { name: '永久注销账号' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('至少保留一个启用的管理员账号');
  expect((await (await page.request.get('/api/me')).json()).user.isAdmin).toBe(true);
});

test('does not claim success after a lost deletion response and retains a cleanup retry across reload', async ({ page }) => {
  const email = 'delete_lost@example.test'; const username = 'delete_lost'; const password = 'delete-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { username, email, password, code } })).ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '账号设置' }).click();
  const dialog = page.getByRole('dialog', { name: '账号设置' });
  await dialog.locator('summary').filter({ hasText: '注销账号' }).click();
  await dialog.getByLabel('当前密码（注销）', { exact: true }).fill(password);
  await dialog.getByRole('checkbox', { name: '我了解注销无法恢复' }).check();
  await page.route('**/api/account/delete', async (route) => { expect((await route.fetch()).status()).toBe(200); await route.abort('failed'); });
  await dialog.getByRole('button', { name: '永久注销账号' }).click();
  await expect(page.getByText('注销结果无法确认，请重新登录确认，或重试清理本机数据')).toBeVisible();
  await expect(page.getByText('账号已注销，本机账号数据已清理')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: '重试清理' }).click();
  await expect(page.getByText('本机账号数据已清理')).toBeVisible();
  expect((await page.request.post('/api/auth/login', { data: { identifier: email, password } })).status()).toBe(401);
});
