import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { expect, test } from './fixtures';

async function completePrivateEnglish(page: import('@playwright/test').Page) {
  const title = 'A long private title '.repeat(8).trim();
  await page.goto('/');
  await page.getByRole('button', { name: '文章库' }).click();
  await page.getByRole('button', { name: '新建文章' }).click();
  await page.getByRole('dialog').waitFor();
  const guestNotice = page.getByRole('dialog', { name: '游客文章仅保存在本机' });
  if (await guestNotice.isVisible()) await guestNotice.getByRole('button', { name: '我已知晓，继续创建' }).click();
  const editor = page.getByRole('dialog', { name: '新建文章' });
  await editor.getByLabel('标题').fill(title);
  await editor.getByLabel('语言').selectOption('en');
  await editor.getByLabel('正文').fill('cloud');
  await editor.getByRole('button', { name: '保存' }).click();
  await page.getByRole('button', { name: `练习《${title}》` }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('cloud');
  const result = page.getByRole('dialog', { name: '练习成绩' });
  await result.getByRole('button', { name: '分享成绩' }).click();
  return { title, dialog: page.getByRole('dialog', { name: '分享成绩' }) };
}

test('downloads a private-by-default image and supports optional title, nickname and copy fallback', async ({ page }) => {
  const { title, dialog } = await completePrivateEnglish(page);
  await expect(dialog.getByRole('checkbox', { name: '显示昵称' })).not.toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: '显示文章标题' })).not.toBeChecked();
  const preview = dialog.getByRole('img', { name: /成绩卡预览/ });
  await expect(preview).not.toHaveAttribute('aria-label', new RegExp(title));
  let download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载图片' }).click();
  const first = await readFile((await (await download).path())!);
  expect(await sharp(first).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
  await dialog.getByRole('checkbox', { name: '显示昵称' }).check();
  await dialog.getByLabel('昵称', { exact: true }).fill('云朵');
  await dialog.getByRole('checkbox', { name: '显示文章标题' }).check();
  download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载图片' }).click();
  const second = await readFile((await (await download).path())!);
  expect(first.equals(second)).toBe(false);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await dialog.getByRole('button', { name: '复制图片' }).click();
  await expect(dialog.getByRole('alert')).toContainText('下载');
  await expect(dialog.getByRole('button', { name: '下载图片' })).toBeEnabled();
});

test('copies a real PNG to the clipboard when the browser supports it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { dialog } = await completePrivateEnglish(page);
  await dialog.getByRole('button', { name: '复制图片' }).click();
  await expect(dialog.getByText('图片已复制')).toBeVisible();
  const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((item) => item.types));
  expect(types).toContain('image/png');
});
