import { expect, test } from './fixtures';

test('opens and shares a public article, preserves attribution and starts practice', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/library');
  await page.getByRole('button', { name: '查看《背影》' }).click();
  await expect(page).toHaveURL(/\/articles\/zh-beginner-1$/);
  await expect(page.getByRole('heading', { name: '背影', exact: true })).toBeVisible();
  await expect(page.getByText('朱自清', { exact: true })).toBeVisible();
  await expect(page.getByText('公共领域', { exact: true })).toBeVisible();
  await expect(page.locator('.public-article-text')).toContainText('我与父亲');
  const url = page.url();
  await page.getByRole('button', { name: '复制链接' }).click();
  await expect(page.getByText('链接已复制')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await page.getByRole('button', { name: '复制链接' }).click();
  await expect(page.getByText('无法复制，请手动选择链接')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '文章链接' })).toHaveValue(url);
  await page.reload();
  await expect(page.getByRole('heading', { name: '背影', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '练习', exact: true }).last().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: '背影', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/articles\/zh-beginner-1$/);
  await expect(page.getByRole('heading', { name: '背影', exact: true })).toBeVisible();
});

test('does not expose private articles through a public link and reports catalog errors', async ({ page }) => {
  await page.goto('/library');
  await page.getByRole('button', { name: '新建文章' }).click();
  await page.getByRole('dialog').waitFor();
  const guestNotice = page.getByRole('dialog', { name: '游客文章仅保存在本机' });
  if (await guestNotice.isVisible()) await guestNotice.getByRole('button', { name: '我已知晓，继续创建' }).click();
  const editor = page.getByRole('dialog', { name: '新建文章' });
  await editor.getByLabel('标题').fill('私人文章');
  await editor.getByLabel('正文').fill('不能公开的文字');
  await editor.getByRole('button', { name: '保存' }).click();
  const id = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cloudtyping-workspace', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const items = await new Promise<Array<{ id: string; kind: string }>>((resolve, reject) => { const request = db.transaction('items').objectStore('items').index('owner').getAll('guest'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); return items.find((item) => item.kind === 'article')!.id;
  });
  await page.goto(`/articles/${encodeURIComponent(id)}`);
  await expect(page.getByRole('heading', { name: '文章未找到' })).toBeVisible();
  await expect(page.getByText('不能公开的文字')).toHaveCount(0);
  await page.route('**/api/articles', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '测试不可用' }) }));
  await page.goto('/articles/unknown-public-id');
  await expect(page.getByRole('alert')).toContainText('文章暂不可用');
  await page.unroute('**/api/articles');
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.getByRole('heading', { name: '文章未找到' })).toBeVisible();
});

test('parks an unfinished practice before opening and starting a shared article', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('山海相望');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('山');
  await page.getByRole('button', { name: '文章库' }).click();
  await page.getByRole('button', { name: '查看《背影》' }).click();
  await page.getByRole('button', { name: '练习', exact: true }).last().click();
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '草稿箱' }).click();
  await page.getByRole('button', { name: '继续《自定义文字》' }).click();
  await expect(page.getByRole('textbox', { name: '当前行输入' })).toHaveValue('山');
  await expect(page.getByRole('button', { name: '继续练习' })).toBeVisible();
});
