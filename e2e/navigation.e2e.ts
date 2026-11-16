import { ensureAdmin, expect, test } from './fixtures';

test('opens main routes directly, survives refresh and reports invalid addresses', async ({ page }) => {
  for (const [path, title] of [['/library', '文章库'], ['/rankings', '排行榜'], ['/records', '我的记录'], ['/drafts', '练习草稿'], ['/mistakes', '错字本'], ['/stats', '练习统计'], ['/help', '使用帮助'], ['/privacy', '隐私政策']] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(path);
  }
  await page.goto('/account/data');
  await expect(page.getByText('请先登录')).toBeVisible();
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: '页面未找到' })).toBeVisible();
});

test('protects active practice when navigating and supports browser back and forward', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('山海相望');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山');
  await page.getByRole('button', { name: '文章库' }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('heading', { name: '文章库' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: '继续练习' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toHaveValue('山');
  await page.goForward();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('heading', { name: '文章库' })).toBeVisible();
});

test('protects an unsaved article editor when the browser goes back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '文章库' }).click();
  await page.getByRole('button', { name: '新建文章' }).click();
  await page.getByRole('dialog').waitFor();
  const guestNotice = page.getByRole('dialog', { name: '游客文章仅保存在本机' });
  if (await guestNotice.isVisible()) await guestNotice.getByRole('button', { name: '我已知晓，继续创建' }).click();
  const editor = page.getByRole('dialog', { name: '新建文章' });
  await editor.getByLabel('标题').fill('尚未保存');
  await page.goBack();
  await expect(page).toHaveURL(/\/library$/);
  const confirmation = page.getByRole('dialog', { name: '放弃未保存的修改？' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: '继续编辑' }).click();
  await expect(page.getByRole('dialog', { name: '新建文章' }).getByLabel('标题')).toHaveValue('尚未保存');
  await page.getByRole('dialog', { name: '新建文章' }).getByRole('button', { name: '取消' }).click();
  await page.getByRole('dialog', { name: '放弃未保存的修改？' }).getByRole('button', { name: '放弃修改' }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toBeVisible();
});

test('keeps a signed-in user on a direct private route after refresh', async ({ page }) => {
  const email = 'navigation_user@example.test'; const password = 'navigation-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { email, username: 'navigation_user', password, code } })).ok()).toBe(true);
  await page.goto('/account/data');
  await expect(page.getByRole('heading', { name: '个人数据', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出个人数据' })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/account\/data$/);
  await expect(page.getByRole('button', { name: '导出个人数据' })).toBeVisible();
});

test('dismisses a dialog on forward navigation without losing the forward entry', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '文章库' }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: '自定义文字' }).click();
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog', { name: '自定义练习文字' })).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('heading', { name: '文章库' })).toBeVisible();
});


test('retains the requested private page after signing in', async ({ page }) => {
  const email = 'navigation_login@example.test'; const password = 'navigation-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { email, username: 'navigation_login', password, code } })).ok()).toBe(true);
  expect((await page.request.post('/api/auth/logout', { data: {} })).ok()).toBe(true);
  await page.goto('/account/data');
  await page.locator('section').filter({ has: page.getByRole('heading', { name: '个人数据' }) }).getByRole('button', { name: '登录' }).click();
  const login = page.getByRole('dialog', { name: '登录' });
  await login.getByLabel('用户名或邮箱').fill('navigation_login');
  await login.getByLabel('密码', { exact: true }).fill(password);
  await login.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/account\/data$/);
  await expect(page.getByRole('button', { name: '导出个人数据' })).toBeVisible();
});

test('keeps the administrator shell separate from explicit front-site preview', async ({ page }) => {
  await ensureAdmin(page.request);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: '管理后台' })).toBeVisible();
  await page.getByRole('button', { name: '预览网站' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: '文章库' }).click();
  await expect(page).toHaveURL(/\/library$/);
  await page.getByRole('button', { name: 'ci_admin', exact: true }).click();
  await page.getByRole('menuitem', { name: '返回后台' }).click();
  await expect(page).toHaveURL(/\/admin\?tab=overview$/);
  await expect(page.getByRole('heading', { name: '管理后台' })).toBeVisible();
});

test('keeps the current page and input if saving a draft fails during browser back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '文章库' }).click();
  await page.getByRole('button', { name: '练习', exact: true }).click();
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('山海相望');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('cloudtyping.practice.v2.')) throw new Error('storage blocked');
      return original.call(this, key, value);
    };
    IDBDatabase.prototype.transaction = function () { throw new Error('storage blocked'); };
  });
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toHaveValue('山');
  await expect(page.getByText('无法保存进度')).toBeVisible();
});

test('preserves an unmarked same-origin history entry if draft saving blocks Back', async ({ page }) => {
  await page.goto('/library');
  await page.evaluate(() => { history.replaceState({ foreign: 'preserve' }, '', '/library'); history.pushState(null, '', '/'); location.reload(); });
  await expect(page).toHaveURL(/\/$/);
  const supported = await page.evaluate(() => typeof (window as Window & { navigation?: { currentEntry?: { index?: number } } }).navigation?.currentEntry?.index === 'number');
  test.skip(!supported, 'Navigation API entry indices are unavailable in this browser');
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('山海相望');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山');
  await page.evaluate(() => {
    const context = window as Window & { restoreStorage?: () => void };
    const setItem = Storage.prototype.setItem; const transaction = IDBDatabase.prototype.transaction;
    context.restoreStorage = () => { Storage.prototype.setItem = setItem; IDBDatabase.prototype.transaction = transaction; };
    Storage.prototype.setItem = function (key: string, value: string) { if (key.startsWith('cloudtyping.practice.v2.')) throw new Error('storage blocked'); return setItem.call(this, key, value); };
    IDBDatabase.prototype.transaction = function () { throw new Error('storage blocked'); };
  });
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('无法保存进度')).toBeVisible();
  await page.evaluate(() => (window as Window & { restoreStorage?: () => void }).restoreStorage?.());
  await page.goBack();
  await expect(page).toHaveURL(/\/library$/);
  expect(await page.evaluate(() => history.state?.foreign)).toBe('preserve');
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
});

test('preserves an unmarked same-origin forward entry when draft saving fails', async ({ page }) => {
  await page.goto('/');
  const supported = await page.evaluate(() => typeof (window as Window & { navigation?: { currentEntry?: { index?: number } } }).navigation?.currentEntry?.index === 'number');
  test.skip(!supported, 'Navigation API entry indices are unavailable in this browser');
  await page.evaluate(() => { history.pushState({ foreign: 'forward' }, '', '/library'); history.back(); });
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('山海相望');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山');
  await page.evaluate(() => {
    const context = window as Window & { restoreStorage?: () => void };
    const setItem = Storage.prototype.setItem; const transaction = IDBDatabase.prototype.transaction;
    context.restoreStorage = () => { Storage.prototype.setItem = setItem; IDBDatabase.prototype.transaction = transaction; };
    Storage.prototype.setItem = function (key: string, value: string) { if (key.startsWith('cloudtyping.practice.v2.')) throw new Error('storage blocked'); return setItem.call(this, key, value); };
    IDBDatabase.prototype.transaction = function () { throw new Error('storage blocked'); };
  });
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('无法保存进度')).toBeVisible();
  await page.evaluate(() => (window as Window & { restoreStorage?: () => void }).restoreStorage?.());
  await page.goForward();
  await expect(page).toHaveURL(/\/library$/);
  expect(await page.evaluate(() => history.state?.foreign)).toBe('forward');
});

test('keeps unmarked history entries intact without Navigation API when draft storage fails', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'navigation', { value: undefined, configurable: true }); });
  await page.goto('/library');
  await page.evaluate(() => { history.replaceState({ foreign: 'preserve' }, '', '/library'); history.pushState(null, '', '/'); location.reload(); });
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('山海相望');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山');
  await page.evaluate(() => {
    const context = window as Window & { restoreStorage?: () => void };
    const setItem = Storage.prototype.setItem; const transaction = IDBDatabase.prototype.transaction;
    context.restoreStorage = () => { Storage.prototype.setItem = setItem; IDBDatabase.prototype.transaction = transaction; };
    Storage.prototype.setItem = function (key: string, value: string) { if (key.startsWith('cloudtyping.practice.v2.')) throw new Error('storage blocked'); return setItem.call(this, key, value); };
    IDBDatabase.prototype.transaction = function () { throw new Error('storage blocked'); };
  });
  await page.goBack();
  await expect(page.getByText('无法保存进度')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toHaveValue('山');
  expect(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; })).toBe(true);
  const warning = page.waitForEvent('dialog');
  const refresh = page.reload({ timeout: 3000 }).catch(() => null);
  const unload = await warning;
  expect(unload.type()).toBe('beforeunload');
  await unload.dismiss();
  await refresh;
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toHaveValue('山');
  await expect(page).toHaveURL(/\/library$/);
  expect(await page.evaluate(() => history.state?.foreign)).toBe('preserve');
  await page.evaluate(() => (window as Window & { restoreStorage?: () => void }).restoreStorage?.());
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/library$/);
  expect(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; })).toBe(false);
  expect(await page.evaluate(() => history.state?.foreign)).toBe('preserve');
  await expect(page.getByRole('heading', { name: '文章库' })).toBeVisible();
});

test('keeps an unmarked forward entry without Navigation API when draft saving fails', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'navigation', { value: undefined, configurable: true }); });
  await page.goto('/');
  await page.evaluate(() => { history.pushState({ foreign: 'forward' }, '', '/library'); history.back(); });
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('山海相望');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山');
  await page.evaluate(() => {
    const context = window as Window & { restoreStorage?: () => void };
    const setItem = Storage.prototype.setItem; const transaction = IDBDatabase.prototype.transaction;
    context.restoreStorage = () => { Storage.prototype.setItem = setItem; IDBDatabase.prototype.transaction = transaction; };
    Storage.prototype.setItem = function (key: string, value: string) { if (key.startsWith('cloudtyping.practice.v2.')) throw new Error('storage blocked'); return setItem.call(this, key, value); };
    IDBDatabase.prototype.transaction = function () { throw new Error('storage blocked'); };
  });
  await page.goForward();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByText('无法保存进度')).toBeVisible();
  expect(await page.evaluate(() => history.state?.foreign)).toBe('forward');
  await page.evaluate(() => (window as Window & { restoreStorage?: () => void }).restoreStorage?.());
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/library$/);
  expect(await page.evaluate(() => history.state?.foreign)).toBe('forward');
});
