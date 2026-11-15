import { expect, test } from './fixtures';

test('preserves and displays legacy history beyond fifty records after a new practice', async ({ page }) => {
  await page.addInitScript(() => {
    const key = 'cloudtyping.history.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify([...Array.from({ length: 65 }, (_, index) => ({ recordId: `old-${index}`, ownerId: null,
      language: 'zh', difficulty: 'beginner', duration: 300, speed: 30, accuracy: 99, finishedAt: 1_700_000_000_000 + index })),
      { ownerId: null, language: 'zh', difficulty: 'beginner', duration: 300, speed: 25, accuracy: 95, finishedAt: 1_700_000_000_100, article: { id: 'legacy', title: '旧文', text: '山海' } }, { recordId: 'broken' }]));
  });
  await page.goto('/');
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('山海');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山海');
  await page.getByRole('dialog', { name: '练习成绩' }).getByRole('button', { name: '关闭' }).click();
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('cloudtyping.history.v1') || '[]').map((record: { recordId: string }) => record.recordId));
  expect(ids).toHaveLength(68);
  expect(ids).toContain('old-64');
  expect(ids).toContain('broken');
  await page.getByRole('button', { name: '我的记录' }).click();
  for (let index = 0; index < 3; index++) await page.getByRole('button', { name: '加载更多' }).click();
  await expect(page.getByRole('button', { name: /详情$/ })).toHaveCount(67);
  await expect(page.getByText('部分本机旧版记录或文章快照无法完整读取。')).toBeVisible();
  await page.getByRole('button', { name: '《旧文》详情' }).click();
  await expect(page).toHaveURL(/\/records\/guest-[a-f0-9]+$/);
  await page.reload();
  await expect(page.getByRole('dialog', { name: '练习详情' }).getByText('旧文')).toBeVisible();
  await page.getByRole('dialog', { name: '练习详情' }).getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '删除《旧文》' }).click();
  await page.getByRole('dialog', { name: '删除记录' }).getByRole('button', { name: '删除' }).click();
  await expect(page.getByRole('button', { name: '《旧文》详情' })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cloudtyping.history.v1') || '[]').some((item: { article?: { title?: string } }) => item.article?.title === '旧文'))).toBe(false);
});
