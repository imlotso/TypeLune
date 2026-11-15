import { expect, test } from './fixtures';

test('does not restore a completed draft in a second tab while the first is finalizing', async ({ page, context }) => {
  let signal!: () => void; let release!: () => void;
  const requested = new Promise<void>((resolve) => { signal = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/tests/*/finish', async (route) => {
    try { const response = await route.fetch(); signal(); await gate; await route.fulfill({ response }); }
    catch { signal(); }
  });
  try {
    await page.goto('/');
    const input = page.getByRole('textbox', { name: '当前行输入' });
    await input.fill('我');
    await expect(page.getByRole('button', { name: '暂停练习' })).toBeEnabled();
    await page.waitForTimeout(1100);
    await page.getByRole('button', { name: '结束练习', exact: true }).click();
    await page.getByRole('dialog', { name: '结束本次练习？' }).getByRole('button', { name: '结束并查看成绩' }).click();
    await requested;
    const other = await context.newPage();
    await other.goto('/');
    await expect(other.getByRole('textbox', { name: '当前行输入' })).toBeEnabled();
    await other.waitForTimeout(300);
    await expect(other.getByRole('dialog', { name: '练习成绩' })).toHaveCount(0);
    release();
    await expect(page.getByRole('dialog', { name: '练习成绩' })).toBeVisible();
    await expect(other.getByRole('dialog', { name: '练习成绩' })).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cloudtyping.history.v1') || '[]').length)).toBe(1);
    await other.close();
  } finally { release(); }
});
