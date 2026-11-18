import { expect, test } from './fixtures';

async function openSettings(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  return page.getByRole('dialog', { name: '练习设置' });
}
async function customText(page: import('@playwright/test').Page, text: string) {
  await page.getByRole('button', { name: '自定义文字' }).click();
  const dialog = page.getByRole('dialog', { name: '自定义练习文字' });
  await dialog.getByRole('textbox', { name: '自定义文章内容' }).fill(text);
  await dialog.getByRole('button', { name: '使用这段文字' }).click();
}

test('freezes pace through pause, applies a changed target next round and syncs it', async ({ page, browser, clientIp }) => {
  const email = 'pace_user@example.test'; const password = 'pace-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { email, username: 'pace_user', password, code } })).ok()).toBe(true);
  await page.goto('/');
  await customText(page, '山海相望');
  let settings = await openSettings(page);
  await settings.getByRole('checkbox', { name: '启用目标配速' }).check();
  await settings.getByLabel('目标速度（字/分）').fill('60');
  await settings.getByRole('button', { name: '关闭' }).click();
  const pace = page.getByRole('group', { name: '目标配速' });
  await expect(pace).toContainText('目标 60 字/分');
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '暂停练习' }).click();
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { kind: string; value?: { paceTarget?: number } }) =>
    item.kind === 'draft' && item.value?.paceTarget === 60)).toBe(true);
  const paused = await pace.innerText();
  await page.waitForTimeout(700);
  expect(await pace.innerText()).toBe(paused);
  settings = await openSettings(page);
  await settings.getByLabel('目标速度（字/分）').fill('120');
  await settings.getByRole('button', { name: '关闭' }).click();
  await expect(pace).toContainText('目标 60 字/分');
  await page.getByRole('button', { name: '继续练习' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山海相望');
  const result = page.getByRole('dialog', { name: '练习成绩' });
  await expect(result.locator('.result-accuracy > strong')).toBeVisible();
  await expect(result.getByRole('button', { name: '提交到排行榜' })).toHaveCount(0);
  await result.getByRole('button', { name: '再练一次' }).click();
  await expect(pace).toContainText('目标 120 字/分');
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { kind: string; value?: { pace?: { customSpeed?: number } } }) =>
    item.kind === 'settings' && item.value?.pace?.customSpeed === 120)).toBe(true);
  const second = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  try {
    expect((await second.request.post('/api/auth/login', { data: { identifier: email, password } })).ok()).toBe(true);
    const other = await second.newPage(); await other.goto('/');
    const otherSettings = await openSettings(other);
    await expect(otherSettings.getByRole('checkbox', { name: '启用目标配速' })).toBeChecked();
    await expect(otherSettings.getByLabel('目标速度（字/分）')).toHaveValue('120');
  } finally { await second.close(); }
});

test('uses the previous matching practice as a target without inventing a speed', async ({ page }) => {
  await page.goto('/');
  await customText(page, '山海');
  const input = page.getByRole('textbox', { name: '当前行输入' });
  await input.fill('山'); await page.waitForTimeout(1200); await input.fill('山海');
  const result = page.getByRole('dialog', { name: '练习成绩' });
  const speed = Number.parseFloat(await result.locator('.result-speed > strong').innerText());
  expect(speed).toBeGreaterThan(0);
  await result.getByRole('button', { name: '关闭' }).click();
  const settings = await openSettings(page);
  await settings.getByRole('checkbox', { name: '启用目标配速' }).check();
  await settings.getByLabel('配速来源').selectOption('last');
  await settings.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '再练一次', exact: true }).click();
  await expect(page.getByRole('group', { name: '目标配速' })).toContainText(`目标 ${speed} 字/分`);
});

test('keeps practice usable when a previous-result target does not exist', async ({ page }) => {
  await page.goto('/');
  const settings = await openSettings(page);
  await settings.getByRole('checkbox', { name: '启用目标配速' }).check();
  await settings.getByLabel('配速来源').selectOption('best');
  await settings.getByRole('button', { name: '关闭' }).click();
  await expect(page.getByRole('group', { name: '目标配速' })).toContainText('暂无同条件成绩');
  await page.getByRole('textbox', { name: '当前行输入' }).fill('我');
  await expect(page.getByRole('button', { name: '暂停练习' })).toBeVisible();
  await expect(page.getByRole('group', { name: '目标配速' })).toContainText('本轮未启用配速');
});
