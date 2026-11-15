import { expect, test } from './fixtures';

test('opens help and policy content without losing an active practice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '自定义文字' }).click();
  await page.getByRole('textbox', { name: '自定义文章内容' }).fill('甲乙丙丁');
  await page.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('甲乙');
  await page.getByRole('button', { name: '使用帮助' }).click();
  await expect(page.getByRole('heading', { name: '使用帮助' })).toBeVisible();
  await expect(page.getByText(/首次输入/)).toBeVisible();
  await expect(page.getByText(/WPM/)).toBeVisible();
  await page.getByRole('button', { name: '隐私政策' }).click();
  await expect(page.getByRole('heading', { name: '隐私政策' })).toBeVisible();
  await expect(page.getByText(/反馈截图/)).toBeVisible();
  await expect(page.getByText('版本：1.0 · 生效日期：2026-11-15')).toBeVisible();
  await page.getByRole('button', { name: '关于与联系' }).click();
  await expect(page.getByText('运营主体：www.sitetalk.net')).toBeVisible();
  await expect(page.getByRole('link', { name: 'admin@imlotso.com' })).toHaveAttribute('href', 'mailto:admin@imlotso.com');
  await page.getByRole('button', { name: '服务条款' }).click();
  await expect(page.getByRole('heading', { name: '服务条款' })).toBeVisible();
  await page.getByRole('button', { name: 'TypeFlow 首页' }).click();
  await expect(page.getByTestId('typed-count')).toHaveText('2');
  await expect(page.getByRole('button', { name: '继续练习' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
