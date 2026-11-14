import { expect, test } from './fixtures';

test('shows the failed sync and pending item, then succeeds on retry', async ({ page }) => {
  const email = 'sync_detail@example.test'; const username = 'sync_detail'; const password = 'sync-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { username, email, password, code } })).ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '练习设置' });
  await expect(settings.getByText('已同步')).toBeVisible();
  await expect(settings.getByText(/最近成功同步/)).toBeVisible();
  await settings.getByRole('button', { name: '关闭' }).click();
  await page.route('**/api/workspace/sync', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '测试连接失败' }) }));
  await page.getByRole('button', { name: '文章库' }).click();
  await page.getByRole('button', { name: '收藏《背影》' }).click();
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(settings.getByText('同步失败')).toBeVisible();
  await expect(settings.getByText('测试连接失败')).toBeVisible();
  await expect(settings.getByText('未同步：1 项')).toBeVisible();
  await expect(settings.getByText(/上次读取云端/)).toBeVisible();
  await expect(settings.getByText(/最近成功同步/)).toBeVisible();
  await page.unroute('**/api/workspace/sync');
  await settings.getByRole('button', { name: '立即同步' }).click();
  await expect(settings.getByText('已同步')).toBeVisible();
  await expect(settings.getByText('未同步：1 项')).toHaveCount(0);
});
