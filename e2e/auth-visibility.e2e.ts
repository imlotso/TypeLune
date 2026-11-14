import { expect, test } from './fixtures';

test('password controls keep a stable field name and mouse selection across visibility changes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '登录' });
  const password = dialog.locator('input[autocomplete="current-password"]');
  await password.fill('sample-password');
  await password.focus();
  await password.evaluate((input: HTMLInputElement) => input.setSelectionRange(2, 6));
  await dialog.getByRole('button', { name: '显示密码' }).click();
  await expect(dialog.getByRole('textbox', { name: '密码', exact: true })).toBeVisible();
  await expect(password).toHaveValue('sample-password');
  await expect(password).toBeFocused();
  expect(await password.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([2, 6]);
  await dialog.getByRole('button', { name: '隐藏密码' }).click();
  await expect(password).toHaveAttribute('type', 'password');
});
