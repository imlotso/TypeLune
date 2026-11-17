import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { test, expect } from './fixtures';
import { chooseTheme } from './appearance';

const screenshots = 'docs/qa/screenshots/2026-11-17-appearance-drafts';
test('draft multiselect confirms once and synchronizes the deletions to another device', async ({ page, browser, baseURL }) => {
  const username = 'bulk_' + Date.now().toString(36), email = username + '@example.test', password = 'bulk-draft-test-password';
  await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } });
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { email, username, password, code } })).ok()).toBe(true);
  await page.goto('/library');
  for (const title of ['背影', '荷塘月色', '从百草园到三味书屋']) {
    await page.getByRole('button', { name: `练习《${title}》`, exact: true }).click();
    await page.getByRole('textbox', { name: '当前行输入', exact: true }).fill('测试输入');
    await page.getByRole('button', { name: '文章库', exact: true }).click();
  }
  await page.getByRole('button', { name: '更多', exact: true }).click();
  await page.getByRole('button', { name: '草稿箱', exact: true }).click();
  await page.getByRole('button', { name: '批量选择', exact: true }).click();
  await page.getByRole('checkbox', { name: '全选草稿', exact: true }).check();
  await page.getByRole('checkbox', { name: '选择《从百草园到三味书屋》', exact: true }).uncheck();
  await expect(page.getByRole('button', { name: '删除所选（2）', exact: true })).toBeEnabled();
  mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: screenshots + '/draft-selection.png', fullPage: true });
  await page.getByRole('button', { name: '删除所选（2）', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('heading', { name: '背影', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '删除所选（2）', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '背影', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '荷塘月色', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '从百草园到三味书屋', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '继续《从百草园到三味书屋》', exact: true })).toBeVisible();
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.filter((item: any) => item.kind === 'draft' && item.deleted).length).toBe(2);
  const second = await browser.newContext({ baseURL, locale: 'zh-CN' });
  try {
    expect((await second.request.post('/api/auth/login', { data: { identifier: username, password } })).ok()).toBe(true);
    const other = await second.newPage(); await other.goto('/drafts');
    await expect(other.getByRole('button', { name: '继续《从百草园到三味书屋》', exact: true })).toBeVisible();
    await expect(other.getByRole('heading', { name: '背影', exact: true })).toHaveCount(0);
    await expect(other.getByRole('heading', { name: '荷塘月色', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '批量选择', exact: true }).click();
    await page.getByRole('checkbox', { name: '全选草稿', exact: true }).check();
    await page.getByRole('button', { name: '删除所选（1）', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByText('暂无草稿', { exact: true })).toBeVisible();
    await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.filter((item: any) => item.kind === 'draft' && item.deleted).length).toBe(3);
    await other.reload(); await expect(other.getByText('暂无草稿', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '练习', exact: true }).click();
    await expect(page.getByTestId('typed-count')).toHaveText('0');
  } finally { await second.close(); }
});

test('appearance groups themes and backgrounds, retrieves native 4K, changes image and persists adaptation off', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ baseURL, locale: 'zh-CN', viewport: { width: 1440, height: 900 }, screen: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  try {
    const data = await sharp('public/assets/lake-default.webp').resize(3840, 2160).webp({ quality: 65 }).toBuffer();
    const queries: URLSearchParams[] = []; const ids = ['aaaaaa', 'bbbbbb', 'cccccc'];
    await page.route('**/api/wallpapers/daily?*', async route => {
      const query = new URL(route.request().url()).searchParams; queries.push(query);
      const id = ids[Math.min(queries.length - 1, 2)];
      await route.fulfill({ json: { background: { image: 'data:image/webp;base64,' + data.toString('base64'), name: 'Wallhaven ' + id, width: 3840, height: 2160, fit: 'cover', positionX: 50, positionY: 50, blur: 0, shade: 25, daily: { id, day: new Date().toISOString().slice(0, 10), kind: 'nature', ...(query.has('width') && { resolution: query.get('width') + 'x' + query.get('height') }) } } } });
    });
    await page.goto('/');
    await page.getByRole('button', { name: '外观', exact: true }).click();
    const appearance = page.getByRole('dialog', { name: '外观', exact: true });
    await appearance.getByRole('button', { name: '夜间', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(appearance.getByRole('button', { name: '夜间', exact: true })).toHaveAttribute('aria-pressed', 'true');
    mkdirSync(screenshots, { recursive: true }); await page.screenshot({ path: screenshots + '/appearance-dark.png', scale: 'css' });
    await appearance.getByRole('button', { name: '日间背景图', exact: true }).click();
    await expect(page.getByRole('button', { name: '上传图片', exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: '显示器自适应', exact: false })).toBeChecked();
    await expect(page.getByText('3840 × 2160', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '获取今日壁纸', exact: true }).click();
    await expect(page.getByRole('link', { name: '图片来源：Wallhaven ↗' })).toHaveAttribute('href', 'https://wallhaven.cc/w/aaaaaa');
    await page.getByRole('button', { name: '换一张', exact: true }).click();
    await expect(page.getByRole('link', { name: '图片来源：Wallhaven ↗' })).toHaveAttribute('href', 'https://wallhaven.cc/w/bbbbbb');
    expect(queries[1].get('exclude')?.split(',')[0]).toBe('aaaaaa'); expect(queries[1].get('width')).toBe('3840'); expect(queries[1].get('height')).toBe('2160');
    await page.getByRole('checkbox', { name: '显示器自适应', exact: false }).uncheck();
    await page.getByRole('button', { name: '换一张', exact: true }).click();
    await expect(page.getByRole('link', { name: '图片来源：Wallhaven ↗' })).toHaveAttribute('href', 'https://wallhaven.cc/w/cccccc');
    expect(queries[2].has('width')).toBe(false); expect(queries[2].get('exclude')?.split(',')[0]).toBe('bbbbbb');
    await page.screenshot({ path: screenshots + '/wallpaper-expanded.png', scale: 'css' });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await chooseTheme(page, 'light');
    await page.reload();
    await expect(page.getByTestId('custom-background-image')).toBeVisible();
    await page.getByRole('button', { name: '外观', exact: true }).click(); await page.getByRole('button', { name: '日间背景图', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: '显示器自适应', exact: false })).not.toBeChecked();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await chooseTheme(page, 'light');
  } finally { await context.close(); }
});

test('English appearance and larger wallpaper editor remain reachable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/?tl=en');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Dark background', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Upload image', exact: true })).toBeInViewport();
  await expect(page.getByRole('checkbox', { name: /Adapt to display/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: screenshots + '/wallpaper-mobile-en.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});
