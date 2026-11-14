import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { expect, test } from './fixtures';

test('downloads personal JSON and CSV without authentication or recovery material', async ({ page }) => {
  const email = 'export_user@example.test'; const username = 'export_user'; const password = 'export-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const registration = await page.request.post('/api/auth/register', { data: { username, email, password, code } });
  expect(registration.ok()).toBe(true);
  const owner = (await registration.json()).user.id as string;
  const time = Date.now();
  const article = { id: 'private-1', title: '=SUM(1,2)', text: '私文', language: 'zh', difficulty: 'beginner', custom: true };
  const secret = 'A'.repeat(43);
  const png = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#aabbcc' } }).png().toBuffer();
  const items = [
    { kind: 'favorite', id: 'zh-beginner-1', updatedAt: time, value: { articleId: 'zh-beginner-1' } },
    { kind: 'article', id: 'private-1', updatedAt: time, value: article },
    { kind: 'background', id: 'light', updatedAt: time, value: { image: `data:image/png;base64,${png.toString('base64')}`, name: 'background.png', width: 12, height: 12, fit: 'cover', positionX: 50, positionY: 50, blur: 0, shade: 20 } },
    { kind: 'record', id: 'record-1', updatedAt: time, value: { recordId: 'record-1', language: 'zh', difficulty: 'beginner', duration: 300, speed: 12, accuracy: 90, finishedAt: time, article, typed: '私' } },
    { kind: 'draft', id: 'draft-1', updatedAt: time, value: { id: 'draft-1', recordId: 'record-1', article, typed: '私', elapsedMs: 1000, backspaces: 0,
      duration: 300, mode: 'timed', strict: false, offset: 0, offline: true, ownerId: owner, savedAt: time, recoveryKey: secret } },
  ];
  expect((await page.request.post('/api/workspace/sync', { data: { items } })).ok()).toBe(true);
  const feedback = await page.request.post('/api/feedback', { data: { category: 'issue', title: '导出反馈', description: '附图', attachments: [{ name: 'screen.png', data: `data:image/png;base64,${png.toString('base64')}` }] } });
  expect(feedback.status()).toBe(201);
  await page.goto('/');
  await page.getByRole('button', { name: username, exact: true }).click();
  await page.getByRole('menuitem', { name: '个人数据' }).click();
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出个人数据 JSON' }).click();
  const json = await readFile((await (await jsonDownload).path())!, 'utf8');
  const exported = JSON.parse(json);
  expect(exported).toMatchObject({ format: 'typing-personal-data', version: 1, account: { id: owner, email }, missing: [] });
  expect(exported.data.favorites).toContainEqual({ articleId: 'zh-beginner-1' });
  expect(exported.data.articles[0].text).toBe('私文');
  expect(exported.data.drafts).toHaveLength(1);
  expect(exported.data.backgrounds[0].image).toMatch(/^data:image\/png;base64,/);
  expect(exported.data.records).toHaveLength(1);
  expect(exported.data.feedback[0].attachments[0].data).toMatch(/^data:image\/webp;base64,/);
  expect(json).not.toContain(secret);
  expect(json).not.toContain(password);
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出记录 CSV' }).click();
  const csv = await readFile((await (await csvDownload).path())!, 'utf8');
  expect(csv).toContain("'=SUM(1,2)");
  expect(csv).not.toContain(secret);
});
