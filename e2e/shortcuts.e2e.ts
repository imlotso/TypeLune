import { expect, test } from './fixtures';

test('supports keyboard and searchable commands without interrupting IME or losing progress', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('甲乙丙丁');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  const input = page.getByRole('textbox', { name: '当前行输入' });
  await input.fill('甲乙');
  await input.dispatchEvent('compositionstart');
  await page.keyboard.press('Alt+p');
  await expect(page.getByRole('button', { name: '暂停练习' })).toBeVisible();
  await input.dispatchEvent('compositionend', { data: '' });
  await page.keyboard.press('Alt+p');
  await expect(page.getByRole('button', { name: '继续练习' })).toBeVisible();
  await page.keyboard.press('Alt+p');
  await expect(page.getByRole('button', { name: '暂停练习' })).toBeVisible();
  await page.keyboard.press('Alt+r');
  const confirm = page.getByRole('dialog', { name: '重新开始本次练习？' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: '继续当前练习' }).click();
  await expect(input).toHaveValue('甲乙');
  await expect(page.getByRole('button', { name: '暂停练习' })).toBeVisible();
  await page.keyboard.press('Control+Shift+2');
  await expect(page.getByRole('heading', { name: '文章库' })).toBeVisible();
  await page.keyboard.press('Alt+k');
  let palette = page.getByRole('dialog', { name: '功能面板' });
  await expect(palette.getByRole('searchbox', { name: '搜索功能' })).toBeFocused();
  await palette.getByRole('searchbox', { name: '搜索功能' }).fill('我的记录');
  await palette.getByRole('button', { name: /我的记录/ }).click();
  await expect(page.getByRole('heading', { name: '我的记录' })).toBeVisible();
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '草稿箱' }).click();
  await page.getByRole('button', { name: '继续《自定义文字》' }).click();
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toHaveValue('甲乙');
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '练习设置' });
  await settings.getByRole('checkbox', { name: '启用快捷键' }).uncheck();
  await settings.getByRole('button', { name: '关闭' }).click();
  await page.keyboard.press('Alt+k');
  await expect(page.getByRole('dialog', { name: '功能面板' })).toHaveCount(0);
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '功能面板', exact: true }).click();
  palette = page.getByRole('dialog', { name: '功能面板' });
  await expect(palette.getByText('快捷键已关闭')).toBeVisible();
  await expect(palette.getByText('Alt+K')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '更多' })).toBeFocused();
});

test('synchronizes the shortcut preference without removing the clickable command panel', async ({ page, browser, clientIp }) => {
  const email = 'shortcuts@example.test'; const password = 'shortcut-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { email, username: 'shortcuts', password, code } })).ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '练习设置' });
  await settings.getByRole('checkbox', { name: '启用快捷键' }).uncheck();
  await settings.getByRole('button', { name: '关闭' }).click();
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { kind: string; value?: { shortcutsEnabled?: boolean } }) =>
    item.kind === 'settings' && item.value?.shortcutsEnabled === false)).toBe(true);
  const second = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  try {
    expect((await second.request.post('/api/auth/login', { data: { identifier: email, password } })).ok()).toBe(true);
    const other = await second.newPage(); await other.goto('/');
    await other.getByRole('button', { name: '更多' }).click();
    await other.getByRole('button', { name: '设置', exact: true }).click();
    const otherSettings = other.getByRole('dialog', { name: '练习设置' });
    await expect(otherSettings.getByRole('checkbox', { name: '启用快捷键' })).not.toBeChecked();
    await otherSettings.getByRole('button', { name: '快捷键与功能' }).click();
    await expect(other.getByRole('dialog', { name: '功能面板' }).getByText('快捷键已关闭')).toBeVisible();
  } finally { await second.close(); }
});

test('allows navigation from focus mode without trapping the user in that layout', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('dialog', { name: '练习设置' }).getByRole('button', { name: '进入专注' }).click();
  await expect(page.getByRole('button', { name: '退出专注' })).toBeVisible();
  await page.getByRole('button', { name: '功能面板', exact: true }).click();
  await page.getByRole('dialog', { name: '功能面板' }).getByRole('button', { name: /文章库/ }).click();
  await expect(page.getByRole('heading', { name: '文章库' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '主要导航' })).toBeVisible();
});
