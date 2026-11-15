import { expect, test } from './fixtures';
import { readFile } from 'node:fs/promises';

test('clears only the current account on this browser and restores cloud data on a later login', async ({ page, context, browser, clientIp }) => {
  const email = 'cleanup_user@example.test'; const username = 'cleanup_user'; const password = 'cleanup-password-123';
  await page.goto('/');
  await page.getByRole('button', { name: '文章库' }).click();
  await page.getByRole('button', { name: '收藏《背影》' }).click();
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const registration = await page.request.post('/api/auth/register', { data: { username, email, password, code } });
  expect(registration.ok()).toBe(true);
  const ownerId = (await registration.json()).user.id as string;
  await page.reload();
  await page.getByRole('button', { name: '文章库' }).click();
  await page.getByRole('button', { name: '收藏《荷塘月色》' }).click();
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { id: string; deleted?: boolean }) => item.id === 'zh-beginner-2' && !item.deleted)).toBe(true);
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('button', { name: username, exact: true })).toBeVisible();
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '个人数据' }).click();
  await page.getByRole('button', { name: '清除此设备数据' }).click();
  const dialog = page.getByRole('dialog', { name: '退出登录' });
  await expect(dialog.getByRole('checkbox', { name: '同时清除此设备的账号数据' })).toBeChecked();
  await dialog.getByRole('checkbox', { name: '确认清除本机数据' }).check();
  await expect(dialog.getByRole('button', { name: '确认退出' })).toBeEnabled({ timeout: 10_000 });
  await dialog.getByRole('button', { name: '确认退出' }).click();
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
  await expect(page.getByText('已退出并清除此设备的账号数据')).toBeVisible();
  await expect(second.getByRole('button', { name: '登录', exact: true })).toBeVisible();
  const stored = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cloudtyping-workspace', 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const read = (owner: string) => new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction('items').objectStore('items').index('owner').getAll(owner);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const result = { account: await read(`user:${id}`), guest: await read('guest') }; db.close(); return result;
  }, ownerId);
  expect(stored.account).toHaveLength(0);
  expect(stored.guest.some((item) => (item as { id: string }).id === 'zh-beginner-1')).toBe(true);
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  expect((await other.request.post('/api/auth/login', { data: { identifier: username, password } })).ok()).toBe(true);
  expect((await (await other.request.get('/api/workspace')).json()).items.some((item: { id: string }) => item.id === 'zh-beginner-2')).toBe(true);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const login = page.getByRole('dialog', { name: '登录' });
  await login.getByLabel('用户名或邮箱').fill(username);
  await login.getByLabel('密码', { exact: true }).fill(password);
  await login.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('button', { name: '文章库' }).click();
  await expect(page.getByRole('button', { name: '收藏《荷塘月色》' })).toHaveAttribute('aria-pressed', 'true');
  await other.close(); await second.close();
});

test('requires an explicit choice for unsynced data before clearing the account cache', async ({ page }) => {
  const email = 'cleanup_pending@example.test'; const username = 'cleanup_pending'; const password = 'cleanup-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { username, email, password, code } })).ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '练习设置' });
  await expect(settings.getByText('已同步')).toBeVisible();
  await settings.getByRole('button', { name: '关闭' }).click();
  await page.route('**/api/workspace/sync', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '测试连接失败' }) }));
  await page.getByRole('button', { name: '文章库' }).click();
  await page.getByRole('button', { name: '收藏《背影》' }).click();
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(settings.getByText('同步失败')).toBeVisible();
  await settings.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '退出登录' }).click();
  const dialog = page.getByRole('dialog', { name: '退出登录' });
  await dialog.getByRole('checkbox', { name: '同时清除此设备的账号数据' }).check();
  await expect(dialog.getByText(/1 项资料尚未同步/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: '确认退出' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '导出个人数据' })).toBeVisible();
  await page.unroute('**/api/workspace/sync');
  await dialog.getByRole('button', { name: '立即同步' }).click();
  await expect(dialog.getByText(/1 项资料尚未同步/)).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: '确认清除本机数据' }).check();
  await dialog.getByRole('button', { name: '确认退出' }).click();
  await expect(page.getByText('已退出并清除此设备的账号数据')).toBeVisible();
});

test('warns for an independent legacy record even when the workspace reports synced', async ({ page }, testInfo) => {
  const email = 'cleanup_legacy@example.test'; const username = 'cleanup_legacy'; const password = 'cleanup-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const registration = await page.request.post('/api/auth/register', { data: { username, email, password, code } });
  const ownerId = (await registration.json()).user.id as string;
  await page.goto('/');
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '练习设置' });
  await expect(settings.getByText('已同步')).toBeVisible();
  await settings.getByRole('button', { name: '关闭' }).click();
  await page.evaluate((id) => localStorage.setItem('cloudtyping.history.v1', JSON.stringify([{ recordId: 'legacy-only', ownerId: id, language: 'zh', difficulty: 'beginner', duration: 300, speed: 10, accuracy: 100, finishedAt: 1000 }])), ownerId);
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '退出登录' }).click();
  const dialog = page.getByRole('dialog', { name: '退出登录' });
  await dialog.getByRole('checkbox', { name: '同时清除此设备的账号数据' }).check();
  await expect(dialog.getByText(/1 项本机练习资料未确认同步/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: '导出个人数据' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '确认退出' })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('legacy-warning-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('legacy-warning-mobile.png') });
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '导出本机资料' }).click();
  const exported = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(exported.data.localRecoveryCopies.records).toContainEqual(expect.objectContaining({ recordId: 'legacy-only' }));
  await expect(dialog.getByText('已导出本机资料；不包含云端资料')).toBeVisible();
  await dialog.getByRole('checkbox', { name: '确认放弃未同步资料' }).check();
  await dialog.getByRole('button', { name: '确认退出' }).click();
  await expect(page.getByText('已退出并清除此设备的账号数据')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cloudtyping.history.v1'))).not.toContain('legacy-only');
});

test('preserves local data if an older tab writes while logout is in flight', async ({ page }) => {
  const email = 'cleanup_race@example.test'; const username = 'cleanup_race'; const password = 'cleanup-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const registration = await page.request.post('/api/auth/register', { data: { username, email, password, code } });
  const ownerId = (await registration.json()).user.id as string;
  await page.goto('/');
  await page.getByRole('button', { name: '文章库' }).click();
  await page.getByRole('button', { name: '收藏《背影》' }).click();
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { id: string; deleted?: boolean }) => item.id === 'zh-beginner-1' && !item.deleted)).toBe(true);
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '个人数据' }).click();
  await page.getByRole('button', { name: '清除此设备数据' }).click();
  const dialog = page.getByRole('dialog', { name: '退出登录' });
  await dialog.getByRole('checkbox', { name: '确认清除本机数据' }).check();
  let release!: () => void; let received!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  const called = new Promise<void>((resolve) => { received = resolve; });
  await page.route('**/api/auth/logout', async (route) => { const response = await route.fetch(); received(); await hold; await route.fulfill({ response }); });
  await dialog.getByRole('button', { name: '确认退出' }).click();
  await called;
  await page.evaluate((id) => localStorage.setItem('cloudtyping.history.v1', JSON.stringify([{ recordId: 'late-copy', ownerId: id, language: 'zh', difficulty: 'beginner', duration: 300, speed: 10, accuracy: 100, finishedAt: 1000 }])), ownerId);
  release();
  await expect(page.getByText(/本机资料在清理期间发生变化，未清除/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cloudtyping.history.v1'))).toContain('late-copy');
  const accountCount = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cloudtyping-workspace', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const count = await new Promise<number>((resolve, reject) => { const request = db.transaction('items').objectStore('items').index('owner').count(`user:${id}`); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); return count;
  }, ownerId);
  expect(accountCount).toBeGreaterThan(0);
});

test('recognizes a fully synchronized local practice record before cleanup', async ({ page }) => {
  const email = 'cleanup_synced_record@example.test'; const username = 'cleanup_synced_record'; const password = 'cleanup-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { username, email, password, code } })).ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByLabel('自定义文章内容').fill('山海');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山海');
  await page.getByRole('dialog', { name: '练习成绩' }).getByRole('button', { name: '关闭' }).click();
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { kind: string; deleted?: boolean }) => item.kind === 'record' && !item.deleted)).toBe(true);
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '练习设置' });
  await settings.getByRole('button', { name: '立即同步' }).click();
  await expect(settings.getByText('已同步')).toBeVisible();
  await settings.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '退出登录' }).click();
  const dialog = page.getByRole('dialog', { name: '退出登录' });
  await dialog.getByRole('checkbox', { name: '同时清除此设备的账号数据' }).check();
  await expect(dialog.getByText(/本机练习资料未确认同步/)).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: '确认清除本机数据' }).check();
  await dialog.getByRole('button', { name: '确认退出' }).click();
  await expect(page.getByText('已退出并清除此设备的账号数据')).toBeVisible();
});

test('retains the account workspace if an older tab writes to IndexedDB during logout', async ({ page }) => {
  const email = 'cleanup_idb_race@example.test'; const username = 'cleanup_idb_race'; const password = 'cleanup-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const registration = await page.request.post('/api/auth/register', { data: { username, email, password, code } });
  const ownerId = (await registration.json()).user.id as string;
  await page.goto('/');
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '个人数据' }).click();
  await page.getByRole('button', { name: '清除此设备数据' }).click();
  const dialog = page.getByRole('dialog', { name: '退出登录' });
  await dialog.getByRole('checkbox', { name: '确认清除本机数据' }).check();
  let release!: () => void; let received!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  const called = new Promise<void>((resolve) => { received = resolve; });
  await page.route('**/api/auth/logout', async (route) => { const response = await route.fetch(); received(); await hold; await route.fulfill({ response }); });
  await dialog.getByRole('button', { name: '确认退出' }).click(); await called;
  await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cloudtyping-workspace', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('items', 'readwrite');
      transaction.objectStore('items').put({ owner: `user:${id}`, kind: 'favorite', id: 'late-item', updatedAt: Date.now(), value: { articleId: 'late-item' } });
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, ownerId);
  release();
  await expect(page.getByText(/本机资料在清理期间发生变化，未清除/)).toBeVisible();
  const retained = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cloudtyping-workspace', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const value = await new Promise<unknown>((resolve, reject) => { const request = db.transaction('items').objectStore('items').get([`user:${id}`, 'favorite', 'late-item']); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); return value;
  }, ownerId);
  expect(retained).toMatchObject({ id: 'late-item', value: { articleId: 'late-item' } });
});

test('recognizes a synchronized paused draft before clearing the account cache', async ({ page }) => {
  const email = 'cleanup_synced_draft@example.test'; const username = 'cleanup_synced_draft'; const password = 'cleanup-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { username, email, password, code } })).ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByLabel('自定义文章内容').fill('山海相逢');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山');
  await page.getByRole('button', { name: '暂停练习' }).click();
  await expect(page.getByRole('button', { name: '继续练习' })).toBeEnabled();
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { kind: string; deleted?: boolean; value?: { typed?: string } }) => item.kind === 'draft' && !item.deleted && item.value?.typed === '山')).toBe(true);
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '练习设置' });
  await settings.getByRole('button', { name: '立即同步' }).click();
  await expect(settings.getByText('已同步')).toBeVisible();
  await settings.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '退出登录' }).click();
  const dialog = page.getByRole('dialog', { name: '退出登录' });
  await dialog.getByRole('checkbox', { name: '同时清除此设备的账号数据' }).check();
  await expect(dialog.getByText(/本机练习资料未确认同步/)).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: '确认清除本机数据' }).check();
  await dialog.getByRole('button', { name: '确认退出' }).click();
  await expect(page.getByText('已退出并清除此设备的账号数据')).toBeVisible();
});

test('rechecks a late local workspace change before revoking the session', async ({ page }) => {
  const email = 'cleanup_before_logout@example.test'; const username = 'cleanup_before_logout'; const password = 'cleanup-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const registration = await page.request.post('/api/auth/register', { data: { username, email, password, code } });
  const ownerId = (await registration.json()).user.id as string;
  await page.goto('/');
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '个人数据' }).click();
  await page.getByRole('button', { name: '清除此设备数据' }).click();
  const dialog = page.getByRole('dialog', { name: '退出登录' });
  await dialog.getByRole('checkbox', { name: '确认清除本机数据' }).check();
  let logoutRequests = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/auth/logout')) logoutRequests++; });
  await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cloudtyping-workspace', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => { const transaction = db.transaction('items', 'readwrite'); transaction.objectStore('items').put({ owner: `user:${id}`, kind: 'favorite', id: 'just-added', updatedAt: Date.now(), value: { articleId: 'just-added' } }); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  }, ownerId);
  await dialog.getByRole('button', { name: '确认退出' }).click();
  await expect(dialog.getByText('本机资料已变化或有新的未同步项目，请重新检查')).toBeVisible();
  expect(logoutRequests).toBe(0);
  expect((await (await page.request.get('/api/me')).json()).user.id).toBe(ownerId);
});

test('keeps a workspace changed between the final check and the deletion transaction', async ({ page }) => {
  const email = 'cleanup_final_race@example.test'; const username = 'cleanup_final_race'; const password = 'cleanup-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const registration = await page.request.post('/api/auth/register', { data: { username, email, password, code } });
  const ownerId = (await registration.json()).user.id as string;
  await page.goto('/');
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '个人数据' }).click();
  await page.getByRole('button', { name: '清除此设备数据' }).click();
  const dialog = page.getByRole('dialog', { name: '退出登录' });
  await dialog.getByRole('checkbox', { name: '确认清除本机数据' }).check();
  await page.route('**/api/auth/logout', async (route) => {
    const response = await route.fetch();
    await page.evaluate((id) => {
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
        if (args[0] === 'items' && args[1] === 'readwrite') {
          IDBDatabase.prototype.transaction = original;
          const late = original.call(this, 'items', 'readwrite');
          late.objectStore('items').put({ owner: `user:${id}`, kind: 'favorite', id: 'late-final', updatedAt: 42, value: { articleId: 'late-final' } });
        }
        return original.apply(this, args);
      };
    }, ownerId);
    await route.fulfill({ response });
  });
  await dialog.getByRole('button', { name: '确认退出' }).click();
  await expect(page.getByText(/本机资料在清理期间发生变化，未清除/)).toBeVisible();
  const kept = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const q = indexedDB.open('cloudtyping-workspace', 1); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
    const item = await new Promise<unknown>((resolve, reject) => { const q = db.transaction('items').objectStore('items').get([`user:${id}`, 'favorite', 'late-final']); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
    db.close(); return item;
  }, ownerId);
  expect(kept).toMatchObject({ id: 'late-final' });
});
