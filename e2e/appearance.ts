import { expect, type Page } from '@playwright/test';

export async function chooseTheme(page: Page, theme: 'light' | 'dark') {
  await page.getByRole('button', { name: /^(外观|Appearance)$/ }).click();
  const dialog = page.getByRole('dialog', { name: /^(外观|Appearance)$/ });
  await dialog.getByRole('button', { name: theme === 'dark' ? /^(夜间|Dark)$/ : /^(日间|Light)$/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await dialog.getByRole('button', { name: /^(关闭|Close)$/ }).click();
}
