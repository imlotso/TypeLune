import { expect, test } from './fixtures';

test('opens local history, drafts, mistakes, statistics and article library on first navigation while offline', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toBeEnabled();
  await context.setOffline(true);
  await page.getByRole('button', { name: '我的记录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的记录', exact: true })).toBeVisible();
  for (const [control, heading] of [['草稿箱', '练习草稿'], ['错字本', '错字本'], ['统计', '练习统计']]) {
    await page.getByRole('button', { name: '更多', exact: true }).click();
    await page.getByRole('button', { name: control, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: '文章库', exact: true }).click();
  await expect(page.getByRole('heading', { name: '文章库', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看《背影》' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('keeps navigation available when an online-only page chunk cannot load', async ({ page }) => {
  await page.route('**/assets/RankingView-*.js', route => route.abort('failed'));
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toBeEnabled();
  await page.getByRole('button', { name: '排行榜', exact: true }).click();
  await expect(page.getByText('页面加载失败', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '重新载入', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '练习', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toBeEnabled();
});
