import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';

test('exports every cloud item when the workspace exceeds one Vercel response', async ({ page }) => {
  test.setTimeout(90_000);
  const email = 'large-workspace@example.test'; const password = 'workspace-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const registration = await page.request.post('/api/auth/register', { data: { username: 'large_workspace', email, password, code } });
  const owner = (await registration.json()).user.id as string;
  const headers = { 'X-Workspace-Owner': owner, 'X-Workspace-Protocol': '2', 'X-Workspace-Paged': '1', 'X-Workspace-Capabilities': 'local-conflict-v1' };
  const items = Array.from({ length: 84 }, (_, index) => {
    const id = `large-${index.toString().padStart(3, '0')}`;
    return { kind: 'article', id, updatedAt: Date.now(), baseRevision: 0, value: { id, title: id, text: '字'.repeat(20_000), language: 'zh', difficulty: 'beginner', custom: true } };
  });
  for (let offset = 0; offset < items.length; offset += 10) {
    const saved = await page.request.post('/api/workspace/sync', { headers, data: { generation: 1, items: items.slice(offset, offset + 10) } });
    expect(saved.ok()).toBe(true);
  }
  let largestPage = 0; let pages = 0;
  await page.route('**/api/workspace', async (route) => {
    const response = await route.fetch(); const bytes = (await response.body()).length;
    largestPage = Math.max(largestPage, bytes); pages++;
    await route.fulfill({ response });
  });
  await page.goto('/account/data');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出个人数据 JSON' }).click();
  const exported = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(exported.data.articles).toHaveLength(84);
  expect(exported.missing).toEqual([]);
  expect(pages).toBeGreaterThan(1);
  expect(largestPage).toBeLessThan(4 * 1024 * 1024);
});
