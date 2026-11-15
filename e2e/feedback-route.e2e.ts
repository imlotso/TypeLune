import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import type { APIRequestContext } from '@playwright/test';

async function register(request: APIRequestContext, username: string) {
  const email = `${username}@example.test`;
  expect((await request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await request.post('/api/auth/register', { data: { email, username, password: 'feedback-password-123', code } })).ok()).toBe(true);
}

test('opens feedback details from the address and rejects another account', async ({ page, browser, baseURL, clientIp }) => {
  await register(page.request, 'feedback_owner');
  const created = await page.request.post('/api/feedback', { data: { requestId: randomUUID(), category: 'issue', title: '仅本人反馈', description: '私密反馈内容', attachments: [] } });
  expect(created.ok()).toBe(true);
  const id = (await created.json()).feedback.id as string;
  const path = `/feedback/${encodeURIComponent(id)}`;
  await page.goto(path);
  await expect(page.getByRole('heading', { name: '仅本人反馈' })).toBeVisible();
  await expect(page.getByText('私密反馈内容')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '仅本人反馈' })).toBeVisible();
  await page.route(`**/api/feedback/${id}`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '暂时无法读取' }) }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('暂时无法读取');
  await page.unroute(`**/api/feedback/${id}`);
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('heading', { name: '仅本人反馈' })).toBeVisible();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(page).toHaveURL(/\/feedback$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole('heading', { name: '仅本人反馈' })).toBeVisible();
  const other = await browser.newContext({ baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  await register(other.request, 'feedback_other');
  const visitor = await other.newPage(); await visitor.goto(path);
  await expect(visitor.getByRole('alert')).toContainText('反馈不存在');
  await expect(visitor.getByText('私密反馈内容')).toHaveCount(0);
  await other.close();
});

test('preserves a feedback detail address through the shared login', async ({ page }) => {
  await register(page.request, 'feedback_login');
  const created = await page.request.post('/api/feedback', { data: { requestId: randomUUID(), category: 'suggestion', title: '登录后的反馈', description: '可以继续查看', attachments: [] } });
  const id = (await created.json()).feedback.id as string;
  expect((await page.request.post('/api/auth/logout', { data: {} })).ok()).toBe(true);
  await page.goto(`/feedback/${encodeURIComponent(id)}`);
  await expect(page.getByText('请先登录')).toBeVisible();
  await page.locator('section.feedback-panel').getByRole('button', { name: '登录' }).click();
  const login = page.getByRole('dialog', { name: '登录' });
  await login.getByLabel('用户名或邮箱').fill('feedback_login');
  await login.getByLabel('密码', { exact: true }).fill('feedback-password-123');
  await login.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/feedback/${id}$`));
  await expect(page.getByRole('heading', { name: '登录后的反馈' })).toBeVisible();
});

test('puts a newly submitted feedback item at its own stable address', async ({ page }) => {
  await register(page.request, 'feedback_route_new');
  await page.goto('/feedback');
  await page.getByLabel('标题', { exact: true }).fill('页面提交反馈');
  await page.getByLabel('详细描述').fill('保存后继续查看');
  await page.getByRole('button', { name: '提交反馈' }).click();
  await expect(page).toHaveURL(/\/feedback\/[^/]+$/);
  await expect(page.getByRole('heading', { name: '页面提交反馈' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('保存后继续查看')).toBeVisible();
});
