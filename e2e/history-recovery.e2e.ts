import { expect, test } from './fixtures';

test('recovers an interrupted public result from its history detail', async ({ page }) => {
  let offline = true;
  await page.route('**/api/tests/start', (route) => route.abort('failed'));
  await page.route('**/api/tests/recover', (route) => offline ? route.abort('failed') : route.continue());
  await page.goto('/');
  await page.getByRole('textbox', { name: '当前行输入' }).fill('我');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '结束练习', exact: true }).click();
  await page.getByRole('dialog', { name: '结束本次练习？' }).getByRole('button', { name: '结束并查看成绩' }).click();
  const result = page.getByRole('dialog', { name: '练习成绩' });
  await expect(result.getByText('可恢复提交')).toBeVisible();
  await result.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '我的记录' }).click();
  await page.getByRole('button', { name: '《背影》详情' }).click();
  const detail = page.getByRole('dialog', { name: '练习详情' });
  await expect(detail.getByRole('button', { name: '恢复成绩' })).toBeVisible();
  offline = false;
  await detail.getByRole('button', { name: '恢复成绩' }).click();
  await expect(result.getByRole('button', { name: '提交到排行榜' })).toBeVisible();
  await result.getByRole('textbox', { name: '上榜昵称' }).fill('历史恢复');
  await result.getByRole('button', { name: '提交到排行榜' }).click();
  await expect(result.getByText('已提交，待复核。')).toBeVisible();
});

test('explains why a personal practice cannot be restored for ranking', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('山海');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山海');
  await page.getByRole('dialog', { name: '练习成绩' }).getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '我的记录' }).click();
  await page.getByRole('button', { name: '《自定义文字》详情' }).click();
  const detail = page.getByRole('dialog', { name: '练习详情' });
  await expect(detail.getByText('无法恢复：个人练习不参与排行')).toBeVisible();
  await expect(detail.getByRole('button', { name: '恢复成绩' })).toHaveCount(0);
});

test('rechecks ownership when another tab takes the recovery lease', async ({ page }) => {
  await page.route('**/api/tests/start', (route) => route.abort('failed'));
  await page.route('**/api/tests/recover', (route) => route.abort('failed'));
  await page.goto('/');
  await page.getByRole('textbox', { name: '当前行输入' }).fill('我');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '结束练习', exact: true }).click();
  await page.getByRole('dialog', { name: '结束本次练习？' }).getByRole('button', { name: '结束并查看成绩' }).click();
  await page.getByRole('dialog', { name: '练习成绩' }).getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '我的记录' }).click();
  await page.getByRole('button', { name: '《背影》详情' }).click();
  const detail = page.getByRole('dialog', { name: '练习详情' });
  await expect(detail.getByRole('button', { name: '恢复成绩' })).toBeVisible();
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => name.startsWith('cloudtyping.practice.v2.') && JSON.parse(localStorage.getItem(name)!).completed)!;
    const draft = JSON.parse(localStorage.getItem(key)!); draft.leaseOwner = 'other-tab'; draft.leaseAt = Date.now();
    localStorage.setItem(key, JSON.stringify(draft));
  });
  await detail.getByRole('button', { name: '恢复成绩' }).click();
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.getByRole('alert')).toContainText('进度正在其他页面使用');
});

test('recovers a matching synchronized result on another account device', async ({ page, browser, baseURL, clientIp }) => {
  const username = 'history_recovery_member'; const email = `${username}@example.test`; const password = 'history-recovery-password';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { username, email, password, code } })).ok()).toBe(true);
  await page.route('**/api/tests/start', (route) => route.abort('failed'));
  await page.route('**/api/tests/recover', (route) => route.abort('failed'));
  await page.goto('/');
  await page.getByRole('textbox', { name: '当前行输入' }).fill('我');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '结束练习', exact: true }).click();
  await page.getByRole('dialog', { name: '结束本次练习？' }).getByRole('button', { name: '结束并查看成绩' }).click();
  await expect(page.getByRole('dialog', { name: '练习成绩' }).getByText('可恢复提交')).toBeVisible();
  await expect.poll(async () => {
    const items = (await (await page.request.get('/api/workspace')).json()).items as Array<{ kind: string; deleted?: boolean; value?: { typed?: string } }>;
    return items.some((item) => item.kind === 'record' && !item.deleted && item.value?.typed === '我') && items.some((item) => item.kind === 'draft' && !item.deleted && item.value?.typed === '我');
  }, { timeout: 15_000 }).toBe(true);
  const other = await browser.newContext({ baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  expect((await other.request.post('/api/auth/login', { data: { identifier: username, password } })).ok()).toBe(true);
  const reader = await other.newPage(); await reader.goto('/records');
  await reader.getByRole('button', { name: '《背影》详情' }).click();
  const detail = reader.getByRole('dialog', { name: '练习详情' });
  await expect(detail.getByRole('button', { name: '恢复成绩' })).toBeVisible();
  await detail.getByRole('button', { name: '恢复成绩' }).click();
  const result = reader.getByRole('dialog', { name: '练习成绩' });
  await expect(result.getByRole('button', { name: '提交到排行榜' })).toBeVisible();
  await result.getByRole('button', { name: '提交到排行榜' }).click();
  await expect(result.getByText('已提交，待复核。')).toBeVisible();
  await other.close();
});
