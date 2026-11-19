import { ensureAdmin, expect, test } from './fixtures';

test('reflects public site switches while preserving a previously started guest practice', async ({ page, browser, clientIp }) => {
  test.setTimeout(60_000);
  const admin = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  await ensureAdmin(admin.request);
  const initial = await (await admin.request.get('/api/admin/settings/site')).json();
  try {
    await page.goto('/');
    await expect.poll(async () => (await (await page.request.get('/api/site/features')).json()).guestPracticeEnabled).toBe(true);
    const input = page.getByRole('textbox', { name: '当前行输入' });
    const starts: string[] = [];
    page.on('request', (request) => { if (request.url().endsWith('/api/tests/start') && request.method() === 'POST') starts.push(request.url()); });
    const started = page.waitForResponse((response) => response.url().endsWith('/api/tests/start') && response.request().method() === 'POST');
    await input.fill('我');
    expect((await started).status()).toBe(200);
    const paused = page.waitForResponse((response) => response.url().endsWith('/pause') && response.request().method() === 'POST');
    await page.getByRole('button', { name: '暂停练习' }).click();
    expect((await paused).status()).toBe(200);
    await expect(page.getByRole('button', { name: '继续练习' })).toBeVisible();
    const closed = { ...initial.settings, registrationEnabled: false, guestPracticeEnabled: false, guestLeaderboardEnabled: false };
    expect((await admin.request.post('/api/admin/settings/site', { data: { settings: closed, revision: initial.revision } })).ok()).toBe(true);
    await page.reload();
    await expect(page.getByText('游客上榜已关闭。')).toBeVisible();
    await expect(page.getByRole('button', { name: '继续练习' })).toBeVisible();
    const resumed = page.waitForResponse((response) => response.url().endsWith('/resume') && response.request().method() === 'POST');
    await page.getByRole('button', { name: '继续练习' }).click();
    await input.fill('我与');
    expect((await resumed).status()).toBe(200);
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: '结束练习', exact: true }).click();
    await page.getByRole('dialog', { name: '结束本次练习？' }).getByRole('button', { name: '结束并查看成绩' }).click();
    const result = page.getByRole('dialog', { name: '练习成绩' });
    await expect(result).toBeVisible();
    await result.getByLabel('上榜昵称').fill('云朵');
    await expect(result.getByRole('button', { name: '提交到排行榜' })).toBeDisabled();
    await expect(result.getByText('游客上榜已关闭。')).toBeVisible();
    await result.getByRole('button', { name: '再练一次' }).click();
    await expect(page.getByText('游客在线练习已关闭，本轮仅本机保存。')).toBeVisible();
    await page.getByRole('button', { name: '登录', exact: true }).click();
    const login = page.getByRole('dialog', { name: '登录' });
    await expect(login.getByText('当前已关闭注册')).toBeVisible();
    await expect(login.getByRole('button', { name: '创建账号' })).toBeDisabled();
    await login.getByRole('button', { name: '关闭' }).click();
    await input.fill('我');
    await expect(page.getByText('游客在线练习已关闭，已转为本地练习。')).toBeVisible();
    await page.waitForTimeout(250);
    expect(starts).toHaveLength(1);
  } finally {
    const latest = await (await admin.request.get('/api/admin/settings/site')).json();
    await admin.request.post('/api/admin/settings/site', { data: { settings: initial.settings, revision: latest.revision } });
    await admin.close();
  }
});

test('reports unavailable configuration and retries without disabling local practice', async ({ page }) => {
  await page.route('**/api/site/features', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '配置服务不可用' }) }));
  await page.goto('/');
  await expect(page.getByText(/站点配置读取失败/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toBeEnabled();
  await page.unroute('**/api/site/features');
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByText(/站点配置读取失败/)).toBeHidden();
});
