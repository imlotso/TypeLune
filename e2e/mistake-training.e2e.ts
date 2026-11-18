import { expect, test } from './fixtures';

async function completeWithCorrectedMistake(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('春风细雨');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  const input = page.getByRole('textbox', { name: '当前行输入' });
  await input.fill('村');
  await input.fill('春风细雨');
  await expect(page.getByRole('dialog', { name: '练习成绩' })).toBeVisible();
}

test('practices corrected mistakes as an independent personal drill with the selected repetitions', async ({ page }) => {
  await page.goto('/');
  const before = (await (await page.request.get('/api/leaderboard?language=zh&difficulty=beginner&duration=300')).json()).entries.length as number;
  await completeWithCorrectedMistake(page);
  const result = page.getByRole('dialog', { name: '练习成绩' });
  await expect(result.locator('.result-accuracy > strong')).toHaveText('100%');
  await result.getByRole('tab', {name:'错字',exact:true}).click();
  await result.getByLabel('重复次数').fill('2');
  await result.getByRole('button', { name: '练习本轮错字' }).click();
  await expect(page.getByRole('heading', { name: '本轮错字专项' })).toBeVisible();
  const source = page.getByLabel('当前文章：本轮错字专项');
  await expect(source).toContainText('春风细雨');
  const input = page.getByRole('textbox', { name: '当前行输入' });
  await input.fill('春风细雨');
  await page.getByRole('button', { name: '我的记录' }).click();
  await expect(page.getByRole('heading', { name: '自定义文字' })).toBeVisible();
  expect((await (await page.request.get('/api/leaderboard?language=zh&difficulty=beginner&duration=300')).json()).entries).toHaveLength(before);
});

test('synchronizes mastered and restored mistake states between independent account devices', async ({ page, browser, clientIp }) => {
  const email = 'mistakes@example.test'; const password = 'mistake-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { email, username: 'mistakes', password, code } })).ok()).toBe(true);
  await page.goto('/');
  await completeWithCorrectedMistake(page);
  await page.getByRole('dialog', { name: '练习成绩' }).getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '错字本' }).click();
  const row = page.getByRole('checkbox', { name: '春' }).locator('..').locator('..').locator('..');
  await row.getByRole('button', { name: '标记已掌握' }).click();
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { kind: string; value?: { mistakeStates?: Record<string, string> } }) => item.kind === 'settings' && item.value?.mistakeStates?.['zh:春'] === 'mastered')).toBe(true);
  const second = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  try {
    expect((await second.request.post('/api/auth/login', { data: { identifier: email, password } })).ok()).toBe(true);
    const other = await second.newPage(); await other.goto('/');
    await other.getByRole('button', { name: '更多' }).click();
    await other.getByRole('button', { name: '错字本' }).click();
    await other.getByLabel('状态').selectOption('mastered');
    const restored = other.getByRole('checkbox', { name: '春' }).locator('..').locator('..').locator('..');
    await restored.getByRole('button', { name: '取消掌握' }).click();
    await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { kind: string; value?: { mistakeStates?: Record<string, string> } }) => item.kind === 'settings' && !item.value?.mistakeStates?.['zh:春'])).toBe(true);
  } finally { await second.close(); }
});
