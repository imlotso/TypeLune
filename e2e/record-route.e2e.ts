import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

async function makeRecord(page: Page) {
  await page.goto('/library');
  await page.getByRole('button', { name: '新建文章' }).click();
  await page.getByRole('dialog').waitFor();
  const guestNotice = page.getByRole('dialog', { name: '游客文章仅保存在本机' });
  if (await guestNotice.isVisible()) await guestNotice.getByRole('button', { name: '我已知晓，继续创建' }).click();
  const editor = page.getByRole('dialog', { name: '新建文章' });
  await editor.getByLabel('标题').fill('私人记录标题');
  await editor.getByLabel('正文').fill('山海');
  await editor.getByRole('button', { name: '保存' }).click();
  await page.getByRole('button', { name: '练习《私人记录标题》' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山海');
  await page.getByRole('dialog', { name: '练习成绩' }).getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '我的记录' }).click();
  await page.getByRole('button', { name: '《私人记录标题》详情' }).click();
  await expect(page).toHaveURL(/\/records\/[^/]+$/);
  return new URL(page.url()).pathname;
}

test('opens a guest record detail directly and supports refresh, back and forward', async ({ page, browser, baseURL }) => {
  const path = await makeRecord(page);
  await expect(page.getByRole('dialog', { name: '练习详情' }).getByText('私人记录标题')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog', { name: '练习详情' }).getByText('私人记录标题')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.getByRole('dialog', { name: '练习详情' })).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole('dialog', { name: '练习详情' })).toBeVisible();
  const other = await browser.newContext({ baseURL });
  const visitor = await other.newPage(); await visitor.goto(path);
  await expect(visitor.getByText('记录未找到')).toBeVisible();
  await expect(visitor.getByText('私人记录标题')).toHaveCount(0);
  await other.close();
});

test('does not expose an account record when another account opens its address', async ({ page, browser, baseURL, clientIp }) => {
  async function register(request: import('@playwright/test').APIRequestContext, username: string) {
    const email = `${username}@example.test`;
    expect((await request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
    const code = (await (await request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
    expect((await request.post('/api/auth/register', { data: { email, username, password: 'record-password-123', code } })).ok()).toBe(true);
  }
  await register(page.request, 'record_owner');
  const path = await makeRecord(page);
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { kind: string; deleted?: boolean }) => item.kind === 'record' && !item.deleted)).toBe(true);
  const other = await browser.newContext({ baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  await register(other.request, 'record_other');
  const visitor = await other.newPage(); await visitor.goto(path);
  await expect(visitor.getByText('记录未找到')).toBeVisible();
  await expect(visitor.getByText('私人记录标题')).toHaveCount(0);
  expect((await visitor.request.get('/api/history?limit=100')).status()).toBe(200);
  await visitor.route('**/api/history?*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '测试不可用' }) }));
  await visitor.goto('/records/unknown');
  await expect(visitor.getByRole('alert')).toContainText('记录尚未完整读取');
  await visitor.unroute('**/api/history?*');
  await visitor.getByRole('button', { name: '重试' }).click();
  await expect(visitor.getByText('记录未找到')).toBeVisible();
  await other.close();
});
