import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';

async function settings(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  return page.getByRole('dialog', { name: '练习设置' });
}

test('applies a named preset and imports settings without losing a parked practice', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByRole('group', { name: '选择语言' }).getByRole('button', { name: 'English' }).click();
  await page.getByLabel('测试时间（分钟）').fill('7');
  let dialog = await settings(page);
  await dialog.getByRole('checkbox', { name: '严格纠错' }).click();
  await expect(dialog.getByRole('checkbox', { name: '严格纠错' })).toBeChecked();
  await dialog.getByRole('button', { name: '练习预设' }).click();
  let presets = page.getByRole('dialog', { name: '练习预设' });
  await presets.getByLabel('预设名称').fill('英语专注');
  await presets.getByRole('button', { name: '保存当前预设' }).click();
  await expect(presets.getByRole('button', { name: '应用 英语专注' })).toBeVisible();
  await presets.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('group', { name: '选择语言' }).getByRole('button', { name: '中文' }).click();
  await page.getByLabel('测试时间（分钟）').fill('5');
  dialog = await settings(page);
  await dialog.getByRole('checkbox', { name: '严格纠错' }).click();
  await expect(dialog.getByRole('checkbox', { name: '严格纠错' })).not.toBeChecked();
  await dialog.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '自定义文字' }).click();
  const custom = page.getByRole('dialog', { name: '自定义练习文字' });
  await custom.getByRole('textbox', { name: '自定义文章内容' }).fill('甲乙丙丁');
  await custom.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('甲乙');
  dialog = await settings(page);
  await dialog.getByRole('button', { name: '练习预设' }).click();
  presets = page.getByRole('dialog', { name: '练习预设' });
  await presets.getByRole('button', { name: '应用 英语专注' }).click();
  await expect(page.getByRole('group', { name: '选择语言' }).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('测试时间（分钟）')).toHaveValue('7');
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '草稿箱' }).click();
  await page.getByRole('button', { name: '继续《自定义文字》' }).click();
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toHaveValue('甲乙');
  await page.getByRole('button', { name: '继续练习' }).click();
  dialog = await settings(page);
  await dialog.getByRole('button', { name: '设置导入／导出' }).click();
  const transfer = page.getByRole('dialog', { name: '练习设置导入／导出' });
  const download = page.waitForEvent('download');
  await transfer.getByRole('button', { name: '导出设置 JSON' }).click();
  const text = await readFile((await (await download).path())!, 'utf8');
  expect(text).not.toContain('甲乙丙丁');
  expect(text).not.toContain('recoveryKey');
  const imported = JSON.parse(text);
  expect(imported.presets).toHaveLength(1);
  imported.settings.language = 'en'; imported.settings.difficulty = 'beginner'; imported.settings.minutes = 9; imported.settings.strict = false;
  await transfer.getByLabel('选择设置 JSON').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":99}') });
  await expect(transfer.getByRole('alert')).toBeVisible();
  await expect(transfer.getByRole('button', { name: '确认导入' })).toHaveCount(0);
  await transfer.getByLabel('选择设置 JSON').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await expect(transfer.getByText(/English · 入门 · 限时 9 分钟/)).toBeVisible();
  await expect.poll(() => transfer.getByLabel('选择设置 JSON').evaluate((element) => (element as HTMLInputElement).files?.[0]?.name)).toBe('valid.json');
  await transfer.getByRole('button', { name: '确认导入' }).click();
  await expect(page.getByLabel('测试时间（分钟）')).toHaveValue('9');
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '草稿箱' }).click();
  await page.getByRole('button', { name: '继续《自定义文字》' }).click();
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toHaveValue('甲乙');
});

test('synchronizes named presets and later edits between account devices', async ({ page, browser, clientIp }) => {
  const email = 'preset_user@example.test'; const password = 'preset-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { email, username: 'preset_user', password, code } })).ok()).toBe(true);
  await page.goto('/');
  const firstSettings = await settings(page);
  await firstSettings.getByRole('button', { name: '练习预设' }).click();
  const first = page.getByRole('dialog', { name: '练习预设' });
  await first.getByLabel('预设名称').fill('跨设备');
  await first.getByRole('button', { name: '保存当前预设' }).click();
  await expect(first.getByRole('button', { name: '应用 跨设备' })).toBeVisible();
  await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { kind: string; value?: { presets?: Array<{ name: string }> } }) =>
    item.kind === 'settings' && item.value?.presets?.some((preset) => preset.name === '跨设备'))).toBe(true);
  const second = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  try {
    expect((await second.request.post('/api/auth/login', { data: { identifier: email, password } })).ok()).toBe(true);
    const other = await second.newPage(); await other.goto('/');
    const otherSettings = await settings(other);
    await otherSettings.getByRole('button', { name: '练习预设' }).click();
    const otherPresets = other.getByRole('dialog', { name: '练习预设' });
    await expect(otherPresets.getByRole('button', { name: '应用 跨设备' })).toBeVisible();
    await otherPresets.getByRole('button', { name: '重命名 跨设备' }).click();
    await otherPresets.getByLabel('新预设名称').fill('已同步');
    await otherPresets.getByRole('button', { name: '保存名称' }).click();
    await expect(otherPresets.getByRole('button', { name: '应用 已同步' })).toBeVisible();
    await expect.poll(async () => (await (await page.request.get('/api/workspace')).json()).items.some((item: { kind: string; value?: { presets?: Array<{ name: string }> } }) =>
      item.kind === 'settings' && item.value?.presets?.some((preset) => preset.name === '已同步'))).toBe(true);
  } finally { await second.close(); }
});

test('preserves a parked draft in IndexedDB when legacy draft storage fails', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '自定义文字' }).click();
  const custom = page.getByRole('dialog', { name: '自定义练习文字' });
  await custom.getByRole('textbox', { name: '自定义文章内容' }).fill('甲乙丙丁');
  await custom.getByRole('button', { name: '使用这段文字' }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('cloudtyping.practice.v2.')) throw new Error('test legacy storage failure');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('textbox', { name: '当前行输入' }).fill('甲乙');
  const dialog = await settings(page);
  await dialog.getByRole('button', { name: '练习预设' }).click();
  const presets = page.getByRole('dialog', { name: '练习预设' });
  await presets.getByLabel('预设名称').fill('本机预设');
  await presets.getByRole('button', { name: '保存当前预设' }).click();
  await presets.getByRole('button', { name: '应用 本机预设' }).click();
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '草稿箱' }).click();
  await page.getByRole('button', { name: '继续《自定义文字》' }).click();
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toHaveValue('甲乙');
});
