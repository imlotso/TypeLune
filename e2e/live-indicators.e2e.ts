import { expect, test } from './fixtures';

test('independently hides live metrics, keeps full results and synchronizes settings', async ({ page, browser, clientIp }) => {
  const email = 'indicators@example.test'; const password = 'indicator-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { email, username: 'indicators', password, code } })).ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: 'English', exact: true }).first().click();
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('cloud');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '练习设置' });
  await settings.getByRole('checkbox', { name: '显示速度' }).uncheck();
  await settings.getByRole('button', { name: '关闭' }).click();
  await expect(page.getByTestId('remaining-time')).toBeVisible();
  await expect(page.locator('.status-row').getByText(/准确率/)).toBeVisible();
  await expect(page.locator('.status-row').getByRole('group', { name: '英文速度' })).toHaveCount(0);
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await settings.getByRole('checkbox', { name: '显示计时' }).uncheck();
  await settings.getByRole('checkbox', { name: '显示准确率' }).uncheck();
  await settings.getByRole('button', { name: '进入专注' }).click();
  await expect(page.locator('.status-row')).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { kind: string; value?: Record<string, unknown> }) =>
    item.kind === 'settings' && item.value?.showTimer === false && item.value?.showSpeed === false && item.value?.showAccuracy === false)).toBe(true);
  await page.getByRole('textbox', { name: '当前行输入' }).fill('cloud');
  const result = page.getByRole('dialog', { name: '练习成绩' });
  const english = result.getByRole('group', { name: '英文速度' });
  await expect(english.locator('.english-speed-value').nth(0)).toContainText('WPM');
  await expect(english.locator('.english-speed-value').nth(1)).toContainText('字符/分钟');
  const accuracy = result.locator('.result-accuracy');
  await expect(accuracy.locator('.result-hero-label')).toHaveText('准确率');
  await expect(accuracy.getByText('100%', { exact: true })).toBeVisible();
  await expect(result.getByText('有效用时', { exact: true })).toBeVisible();

  const second = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  try {
    expect((await second.request.post('/api/auth/login', { data: { identifier: email, password } })).ok()).toBe(true);
    const other = await second.newPage(); await other.goto('/');
    await expect(other.locator('.status-row')).toHaveCount(0);
    await other.getByRole('button', { name: '更多' }).click();
    await other.getByRole('button', { name: '设置', exact: true }).click();
    const otherSettings = other.getByRole('dialog', { name: '练习设置' });
    await expect(otherSettings.getByRole('checkbox', { name: '显示速度' })).not.toBeChecked();
    await expect(otherSettings.getByRole('checkbox', { name: '显示计时' })).not.toBeChecked();
    await otherSettings.getByRole('checkbox', { name: '显示速度' }).check();
    await otherSettings.getByRole('button', { name: '关闭' }).click();
    await expect(other.locator('.status-row').getByText(/字 \/ 分钟/)).toBeVisible();
    await expect(other.getByTestId('remaining-time')).toHaveCount(0);
  } finally { await second.close(); }
});
