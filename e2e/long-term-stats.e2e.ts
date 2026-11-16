import { expect, test } from './fixtures';

test('separates practice conditions and opens records from the trend', async ({ page }) => {
  await page.goto('/library');
  await page.getByRole('button', { name: '新建文章' }).click();
  await page.getByRole('dialog').waitFor();
  const guestNotice = page.getByRole('dialog', { name: '游客文章仅保存在本机' });
  if (await guestNotice.isVisible()) await guestNotice.getByRole('button', { name: '我已知晓，继续创建' }).click();
  const editor = page.getByRole('dialog', { name: '新建文章' });
  await editor.getByLabel('标题').fill('统计文章');
  await editor.getByLabel('正文').fill('山海');
  await editor.getByRole('button', { name: '保存' }).click();
  await page.getByRole('button', { name: '练习《统计文章》' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山海');
  let result = page.getByRole('dialog', { name: '练习成绩' });
  await result.getByRole('button', { name: '再练一次' }).click();
  await page.getByLabel('测试时间（分钟）').fill('6');
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山海');
  result = page.getByRole('dialog', { name: '练习成绩' });
  await result.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '统计', exact: true }).click();
  await expect(page.getByRole('region', { name: /同条件统计/ })).toHaveCount(2);
  await expect(page.getByText('速度和准确率按同条件每次练习等权平均')).toBeVisible();
  await page.getByLabel('统计时长').selectOption('360');
  const group = page.getByRole('region', { name: /同条件统计/ });
  await expect(group).toHaveCount(1);
  await expect(group).toContainText('6 分钟');
  await group.getByRole('button', { name: /查看记录/ }).click();
  await expect(page).toHaveURL(/\/records\/[^/]+$/);
  await expect(page.getByRole('dialog', { name: '练习详情' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/stats$/);
  await page.getByLabel('统计时间范围').selectOption('custom');
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await page.getByLabel('开始日期').fill(today);
  await page.getByLabel('结束日期').fill(today);
  await expect(page.getByRole('region', { name: /同条件统计/ })).toHaveCount(2);
});

test('uses every history page, deduplicates IDs and exposes older trend points', async ({ page }) => {
  const username = 'stats_pages'; const email = `${username}@example.test`;
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { email, username, password: 'stats-password-123', code } })).ok()).toBe(true);
  const now = Date.now();
  const record = (index: number) => ({ recordId: `stats-${index}`, language: 'zh', difficulty: 'beginner', duration: 300, speed: 30, accuracy: 90,
    finishedAt: now - index * 86_400_000, elapsedMs: index === 100 ? undefined : 60_000, mode: 'timed', strict: false,
    article: { id: 'fixture', title: '统计样本', text: '山海', language: 'zh', difficulty: 'beginner', custom: true }, typed: '山海' });
  await page.route('**/api/history?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(route.request().url().includes('cursor=')
    ? { entries: [record(99), record(100)], nextCursor: null } : { entries: Array.from({ length: 100 }, (_, index) => record(index)), nextCursor: 'next-page' }) }));
  await page.goto('/stats');
  // Select filters after the authenticated account replaces the guest workspace.
  await expect(page.getByRole('button', { name: new RegExp(username) })).toBeVisible();
  await page.getByLabel('统计时间范围').selectOption('all');
  await expect(page.locator('dl').filter({ hasText: '练习次数' }).locator('div').filter({ hasText: '练习次数' }).locator('dd')).toHaveText('101');
  await expect(page.getByText('1 条记录缺少有效用时')).toBeVisible();
  await expect(page.getByText('统计基于已读取的记录')).toHaveCount(0);
  const group = page.getByRole('region', { name: /同条件统计/ });
  await expect(group.getByRole('button', { name: '上一页' })).toBeEnabled();
  await group.getByRole('button', { name: '上一页' }).click();
  await expect(group.getByRole('button', { name: /查看记录/ })).toHaveCount(30);
});
