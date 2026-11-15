import { ensureAdmin, expect, test } from './fixtures';
import type { APIRequestContext } from '@playwright/test';

async function register(request: APIRequestContext, username: string) {
  const email = `${username}@example.test`;
  expect((await request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await request.post('/api/auth/register', { data: { email, username, password: 'account-route-password', code } })).ok()).toBe(true);
}

test('preserves the account route through login and refresh', async ({ page }) => {
  await register(page.request, 'account_route_login');
  expect((await page.request.post('/api/auth/logout', { data: {} })).ok()).toBe(true);
  await page.goto('/account');
  await expect(page.getByText('请先登录')).toBeVisible();
  await page.locator('section').filter({ has: page.getByRole('heading', { name: '账号设置' }) }).getByRole('button', { name: '登录' }).click();
  const login = page.getByRole('dialog', { name: '登录' });
  await login.getByLabel('用户名或邮箱').fill('account_route_login');
  await login.getByLabel('密码', { exact: true }).fill('account-route-password');
  await login.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('dialog', { name: '账号设置' }).getByLabel('公开昵称')).toHaveValue('account_route_login');
  await page.reload();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('dialog', { name: '账号设置' })).toBeVisible();
});

test('protects unsaved account edits on browser back and returns focus after discard', async ({ page }) => {
  await register(page.request, 'account_route_edit');
  await page.goto('/records');
  await page.getByRole('button', { name: 'account_route_edit', exact: true }).click();
  await page.getByRole('menuitem', { name: '账号设置' }).click();
  await expect(page).toHaveURL(/\/account$/);
  const settings = page.getByRole('dialog', { name: '账号设置' });
  await settings.getByLabel('公开昵称').fill('未保存昵称');
  await page.goBack();
  await expect(page).toHaveURL(/\/account$/);
  const confirm = page.getByRole('dialog', { name: '放弃未保存的修改？' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: '继续编辑' }).click();
  await expect(settings.getByLabel('公开昵称')).toHaveValue('未保存昵称');
  await settings.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('dialog', { name: '放弃未保存的修改？' }).getByRole('button', { name: '放弃修改' }).click();
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.getByRole('button', { name: 'account_route_edit', exact: true })).toBeFocused();
  await page.goto('/account');
  await expect(page.getByRole('dialog', { name: '账号设置' }).getByLabel('公开昵称')).toHaveValue('account_route_edit');
});

test('does not leave the account route while a profile update is in flight', async ({ page }) => {
  await register(page.request, 'account_route_busy');
  await page.goto('/records');
  await page.getByRole('button', { name: 'account_route_busy', exact: true }).click();
  await page.getByRole('menuitem', { name: '账号设置' }).click();
  let signal!: () => void; let release!: () => void;
  const requested = new Promise<void>((resolve) => { signal = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/account/profile', async (route) => { try { const response = await route.fetch(); signal(); await gate; await route.fulfill({ response }); } catch { signal(); } });
  try {
    const settings = page.getByRole('dialog', { name: '账号设置' });
    await settings.getByLabel('公开昵称').fill('新昵称');
    await settings.getByRole('button', { name: '保存资料' }).click();
    await requested;
    await expect(settings.getByRole('button', { name: '关闭' })).toBeDisabled();
    await expect(settings.getByLabel('公开昵称')).toBeDisabled();
    await page.goBack();
    await expect(page).toHaveURL(/\/account$/);
    await expect(settings).toBeVisible();
    release();
    await expect(settings.getByText('资料已保存')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/records$/);
    await expect(page.getByRole('button', { name: '新昵称', exact: true })).toBeVisible();
  } finally { release(); }
});


test('keeps administrator account settings in the explicit front-site preview', async ({ page }) => {
  await ensureAdmin(page.request);
  await page.goto('/admin');
  await page.getByRole('button', { name: '预览网站' }).click();
  await page.getByRole('button', { name: 'ci_admin', exact: true }).click();
  await page.getByRole('menuitem', { name: '账号设置' }).click();
  await expect(page).toHaveURL(/\/account$/);
  const settings = page.getByRole('dialog', { name: '账号设置' });
  await expect(settings.getByLabel('公开昵称')).toBeVisible();
  await settings.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: 'ci_admin', exact: true }).click();
  await page.getByRole('menuitem', { name: '返回后台' }).click();
  await expect(page).toHaveURL(/\/admin\?tab=overview$/);
  await expect(page.getByRole('heading', { name: '管理后台' })).toBeVisible();
});
