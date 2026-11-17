import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { ensureAdmin, expect, test } from './fixtures';
const screenshots = 'docs/qa/screenshots/2026-11-16-seo-performance-security';

test('serves both language variants and current public article bodies without JavaScript', async ({ browser, clientIp }) => {
  const setup = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  await ensureAdmin(setup.request); const initial = await (await setup.request.get('/api/admin/settings/seo')).json();
  expect((await setup.request.post('/api/admin/settings/seo', { data: { settings: { ...initial.settings, siteUrl: 'https://typing.example' }, revision: initial.revision } })).ok()).toBe(true);
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  try {
    const page = await context.newPage();
    await page.goto('/help?tl=en'); await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
    await expect(page.locator('link[rel="alternate"][hreflang="zh-CN"]')).toHaveCount(1);
    await page.goto('/articles/zh-beginner-1?tl=en'); await expect(page.getByRole('heading', { name: '背影', exact: true })).toBeVisible();
    await expect(page.locator('article')).toHaveAttribute('lang', 'zh-CN'); await expect(page.locator('article')).toContainText('我与父亲');
    const sitemap = await (await context.request.get('/sitemap.xml')).text(); expect(sitemap).toContain('?tl=en'); expect(sitemap).toContain('?tl=zh-CN'); expect(sitemap).not.toMatch(/\/users|\/account|\/records/);
    await page.goto('/help?tl=zh-CN'); await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN'); await expect(page.getByRole('heading', { name: '账号', exact: true })).toBeVisible();
  } finally { const latest = await (await setup.request.get('/api/admin/settings/seo')).json(); await setup.request.post('/api/admin/settings/seo', { data: { settings: initial.settings, revision: latest.revision } }); await context.close(); await setup.close(); }
});

test('keeps explicit language URLs coherent during SPA navigation and language switching without losing practice', async ({ page }) => {
  await page.goto('/?tl=en'); await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Custom text', exact: true }).click();
  await page.getByRole('textbox', { name: 'Custom article content' }).fill('abcdefghi'); await page.getByRole('button', { name: 'Use this text', exact: true }).click();
  await page.getByRole('textbox', { name: 'Current line input' }).fill('ab');
  await page.getByRole('button', { name: 'Interface language: English. Switch to 中文', exact: true }).click();
  await expect(page).toHaveURL(/\?tl=zh-CN$/); await expect(page.getByRole('textbox', { name: '当前行输入' })).toHaveValue('ab');
  await page.getByRole('button', { name: '文章库', exact: true }).click(); await expect(page).toHaveURL(/\/library\?tl=zh-CN$/);
  await page.goBack(); await expect(page).toHaveURL(/\/\?tl=zh-CN$/); await expect(page.getByRole('textbox', { name: '当前行输入' })).toHaveValue('ab');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
});

test('manages bilingual SEO, images and sitemap controls in administration with persisted public output', async ({ page, browser, clientIp }) => {
  test.setTimeout(60_000); mkdirSync(screenshots, { recursive: true });
  await ensureAdmin(page.request);
  const initial = await (await page.request.get('/api/admin/settings/seo')).json();
  try {
    await page.goto('/admin?tab=seo'); await expect(page.getByLabel('正式网站地址', { exact: true })).toBeVisible();
    await page.getByLabel('正式网站地址', { exact: true }).fill('https://typing.example');
    await page.getByRole('combobox', { name: '编辑语言', exact: true }).selectOption('en');
    await page.getByLabel('首页标题', { exact: true }).fill('Managed English typing');
    await page.getByRole('textbox', { name: '网站描述', exact: true }).fill('Persisted bilingual typing practice');
    await page.getByLabel('Google Search Console', { exact: true }).fill('public-google-token');
    const png = await sharp({ create: { width: 256, height: 128, channels: 4, background: '#5a529b' } }).png().toBuffer();
    await page.getByLabel('网站 Logo', { exact: true }).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    const html = await (await page.request.get('/?tl=en')).text(); expect(html).toContain('<title>Managed English typing</title>'); expect(html).toContain('public-google-token'); expect(html).toContain('hreflang="en"');
    await page.screenshot({ path: screenshots + '/admin-seo-desktop.png', fullPage: true });
    await page.getByLabel('启用 Sitemap', { exact: true }).uncheck(); await page.getByRole('button', { name: '保存', exact: true }).click(); await expect.poll(async () => (await page.request.get('/sitemap.xml')).status()).toBe(404);
    await page.reload(); await expect(page.getByLabel('启用 Sitemap', { exact: true })).not.toBeChecked();
    const guest = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'en-US', extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
    try {
      const visitor = await guest.newPage(); await visitor.goto('/?tl=en'); await expect(visitor).toHaveTitle('Managed English typing');
      await expect(visitor.locator('.brand-logo')).toHaveAttribute('src', /\/api\/site\/seo\/images\/logo/);
      await visitor.screenshot({ path: screenshots + '/english-public.png', fullPage: true });
    } finally { await guest.close(); }
  } finally {
    const latest = await (await page.request.get('/api/admin/settings/seo')).json();
    expect((await page.request.post('/api/admin/settings/seo', { data: { settings: initial.settings, revision: latest.revision } })).ok()).toBe(true);
  }
});
