import { expect, test } from './fixtures';
import { stableRecordId } from '../src/lib/records';

test('deduplicates and deletes id-less legacy copies across devices without revival', async ({ page, browser, baseURL, clientIp }, testInfo) => {
  const username = 'legacy_records'; const email = `${username}@example.test`; const password = 'legacy-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const registered = await page.request.post('/api/auth/register', { data: { username, email, password, code } });
  const ownerId = (await registered.json()).user.id as string;
  const legacy = { ownerId, language: 'zh' as const, difficulty: 'beginner' as const, duration: 300, speed: 12, accuracy: 100, finishedAt: Date.now() - 1000, typed: '山',
    article: { id: 'old-article', title: '旧版山海', text: '山海', language: 'zh' as const, difficulty: 'beginner' as const, custom: true } };
  const alias = stableRecordId(legacy); const headers = { 'X-Workspace-Owner': ownerId, 'X-Workspace-Protocol': '2' };
  const created = await page.request.post('/api/workspace/sync', { headers, data: { generation: 1, items: [{ kind: 'record', id: 'old-cloud-id', updatedAt: Date.now(), baseRevision: 0, value: legacy }] } });
  expect(created.ok()).toBe(true);
  await page.goto('/');
  await page.evaluate((record) => localStorage.setItem('cloudtyping.history.v1', JSON.stringify([record])), legacy);
  await page.getByRole('button', { name: '我的记录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '旧版山海' })).toHaveCount(1);
  const device = await browser.newContext({ baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  expect((await device.request.post('/api/auth/login', { data: { identifier: username, password } })).ok()).toBe(true);
  const other = await device.newPage(); await other.goto('/');
  await other.evaluate((record) => localStorage.setItem('cloudtyping.history.v1', JSON.stringify([record])), legacy);
  await other.goto('/records');
  await expect(other.getByRole('heading', { name: '旧版山海' })).toHaveCount(1);
  await page.getByRole('button', { name: '删除《旧版山海》' }).click();
  await page.getByRole('dialog', { name: '删除记录' }).getByRole('button', { name: '删除' }).click();
  await expect(page.getByRole('heading', { name: '旧版山海' })).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get('/api/workspace', { headers })).json()).items.filter((item: { kind: string; deleted?: boolean }) => item.kind === 'record' && item.deleted).map((item: { id: string }) => item.id).sort()).toEqual([alias, 'old-cloud-id'].sort());
  await other.reload();
  await expect(other.getByRole('heading', { name: '旧版山海' })).toHaveCount(0);
  await expect.poll(() => other.evaluate(() => JSON.parse(localStorage.getItem('cloudtyping.history.v1') || '[]').length)).toBe(0);
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '个人数据' }).click();
  await expect(page.getByText('旧记录关联标记：1 项，不计入容量上限')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('legacy-alias-capacity.png') });
  const compacted = await page.request.post('/api/workspace/compact', { headers, data: { generation: 1 } });
  expect((await compacted.json()).generation).toBe(2);
  for (const id of [alias, 'old-cloud-id']) {
    const stale = await page.request.post('/api/workspace/sync', { headers, data: { generation: 2, items: [{ kind: 'record', id, updatedAt: Date.now(), baseRevision: 0, value: { ...legacy, ...(id === alias && { recordId: alias }) } }] } });
    expect(stale.status()).toBe(409);
  }
  await device.close();
});
