import { expect, test } from './fixtures';

test('compares a new result with previous matching rounds without comparing it to itself', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '自定义文字' }).click();
  const editor = page.getByRole('dialog', { name: '自定义练习文字' });
  await editor.getByRole('textbox', { name: '自定义文章内容' }).fill('山海');
  await editor.getByRole('button', { name: '使用这段文字' }).click();
  let input = page.getByRole('textbox', { name: '当前行输入' });
  await input.fill('山');
  await page.waitForTimeout(1200);
  await input.fill('山错');
  let result = page.getByRole('dialog', { name: '练习成绩' });
  await expect(result.getByText('暂无此前同条件成绩')).toBeVisible();
  await expect(result.getByText('仅本机记录')).toBeVisible();
  await result.getByRole('button', { name: '再练一次' }).click();
  input = page.getByRole('textbox', { name: '当前行输入' });
  await input.fill('山海');
  result = page.getByRole('dialog', { name: '练习成绩' });
  const comparison = result.getByLabel('个人最佳与比较');
  await expect(comparison.getByText(/提高 \+/)).toBeVisible();
  await expect(comparison.getByText(/近 1 次平均/)).toBeVisible();
  await expect(comparison.getByText(/准确率 \+50 个百分点/)).toBeVisible();
});

test('compares account results using paginated server history and marks an offline comparison as partial', async ({ page }) => {
  const email = 'personal_best@example.test';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  expect((await page.request.post('/api/auth/register', { data: { email, username: 'personal_best', password: 'best-password-123', code } })).ok()).toBe(true);
  await page.goto('/');
  async function finishRound(value: string) {
    const start = page.waitForResponse((response) => response.url().endsWith('/api/tests/start') && response.request().method() === 'POST');
    await page.getByRole('textbox', { name: '当前行输入' }).fill(value);
    expect((await start).status()).toBe(200);
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: '结束练习', exact: true }).click();
    await page.getByRole('dialog', { name: '结束本次练习？' }).getByRole('button', { name: '结束并查看成绩' }).click();
    return page.getByRole('dialog', { name: '练习成绩' });
  }
  let result = await finishRound('我');
  await expect(result.getByText('暂无此前同条件成绩')).toBeVisible();
  await result.getByRole('button', { name: '再练一次' }).click();
  result = await finishRound('我与父亲');
  let comparison = result.getByLabel('个人最佳与比较');
  await expect(comparison.getByText(/近 1 次平均/)).toBeVisible();
  await expect(comparison.getByText(/提高 \+/)).toBeVisible();
  await expect(comparison.getByText('基于已读取的记录')).toHaveCount(0);
  await result.getByRole('button', { name: '再练一次' }).click();
  await page.route('**/api/history?*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '历史暂不可用' }) }));
  result = await finishRound('我与父亲不');
  comparison = result.getByLabel('个人最佳与比较');
  await expect(comparison.getByText('基于已读取的记录')).toBeVisible();
  await expect(comparison.getByText(/近 2 次平均/)).toBeVisible();
});
