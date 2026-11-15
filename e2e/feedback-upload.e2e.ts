import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { expect, test } from './fixtures';

test('uploads a near-5 MiB image in bounded requests and preserves the form after a failed chunk', async ({ page }) => {
  test.setTimeout(90_000);
  const email = 'large-feedback@example.test'; const password = 'feedback-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { username: 'large_feedback', email, password, code } })).ok()).toBe(true);
  let failed = false; let uploads = 0; let largestRequest = 0;
  await page.route('**/api/feedback/uploads', async (route) => {
    const raw = route.request().postData() || '';
    largestRequest = Math.max(largestRequest, Buffer.byteLength(raw)); uploads++;
    const data = JSON.parse(raw) as { chunkIndex: number };
    if (!failed && data.chunkIndex === 1) { failed = true; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '临时上传失败' }) }); return; }
    await route.continue();
  });
  await page.goto('/feedback');
  await page.getByLabel('标题', { exact: true }).fill('大图反馈');
  await page.getByLabel('详细描述').fill('保留后重试');
  const raw = randomBytes(1300 * 1300 * 3);
  const png = await sharp(raw, { raw: { width: 1300, height: 1300, channels: 3 } }).png().toBuffer();
  expect(png.length).toBeGreaterThan(4.5 * 1024 * 1024);
  expect(png.length).toBeLessThanOrEqual(5 * 1024 * 1024);
  await page.locator('input[type=file]').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: '提交反馈' }).click();
  await expect(page.getByRole('alert')).toHaveText('临时上传失败');
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('大图反馈');
  await expect(page.getByText('large.png')).toBeVisible();
  await page.getByRole('button', { name: '提交反馈' }).click();
  await expect(page.getByText(/编号：/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('img', { name: 'large.png' })).toBeVisible();
  expect(uploads).toBeGreaterThan(7);
  expect(largestRequest).toBeLessThan(2 * 1024 * 1024);
});
