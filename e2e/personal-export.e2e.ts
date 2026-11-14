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
  expect((await page.request.post('/api/workspace/sync', { headers: { 'X-Workspace-Protocol': '2' }, data: { generation: 1, items: items.map((item) => ({ ...item, baseRevision: 0 })) } })).ok()).toBe(true);
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

test('exports a conflicting local article separately from the cloud version', async ({ page, browser, baseURL, clientIp }, testInfo) => {
  const username = 'export_conflict'; const email = `${username}@example.test`; const password = 'export-password-123';
  expect((await page.request.post('/api/auth/code', { data: { email, purpose: 'register' } })).ok()).toBe(true);
  const code = (await (await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
  const registration = await page.request.post('/api/auth/register', { data: { username, email, password, code } });
  const owner = (await registration.json()).user.id as string;
  const time = Date.now() - 2000;
  const base = { id: 'conflicted', title: '旧版', text: '原文', language: 'zh', difficulty: 'beginner', custom: true };
  const headers = { 'X-Workspace-Protocol': '2', 'X-Workspace-Owner': owner };
  expect((await page.request.post('/api/workspace/sync', { headers, data: { generation: 1, items: [{ kind: 'article', id: base.id, updatedAt: time, baseRevision: 0, value: base }] } })).ok()).toBe(true);
  await page.goto('/account/data');
  await expect(page.getByRole('heading', { name: '个人数据' })).toBeVisible();
  await expect.poll(() => page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cloudtyping-workspace', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const item = await new Promise<unknown>((resolve, reject) => { const request = db.transaction('items').objectStore('items').get([`user:${id}`, 'article', 'conflicted']); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); return !!item;
  }, owner)).toBe(true);
  const other = await browser.newContext({ baseURL, extraHTTPHeaders: { 'X-Forwarded-For': clientIp } });
  expect((await other.request.post('/api/auth/login', { data: { identifier: username, password } })).ok()).toBe(true);
  const cloud = { ...base, title: '云端版本', text: '云端正文' };
  expect((await other.request.post('/api/workspace/sync', { headers, data: { generation: 1, items: [{ kind: 'article', id: base.id, updatedAt: time + 2000, baseRevision: 1, value: cloud }] } })).ok()).toBe(true);
  await page.evaluate(async ({ id, at }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cloudtyping-workspace', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('items', 'readwrite'); const store = tx.objectStore('items');
      const request = store.get([`user:${id}`, 'article', 'conflicted']);
      request.onsuccess = () => { const item = request.result; item.updatedAt = at + 1000; item.value = { ...item.value, title: '本机版本', text: '本机正文' }; store.put(item); };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { id: owner, at: time });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出个人数据 JSON' }).click();
  const exported = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(exported.data.articles).toMatchObject([{ id: 'conflicted', title: '云端版本', text: '云端正文' }]);
  expect(exported.data.localRecoveryCopies.workspace).toMatchObject([{ kind: 'article', id: 'conflicted', value: { title: '本机版本', text: '本机正文' } }]);
  await expect(page.getByText('导出完成，含未合并的本机副本')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('export-conflict.png') });
  await page.evaluate(async ({ id, at }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('cloudtyping-workspace', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('items', 'readwrite'); const store = tx.objectStore('items');
      const request = store.get([`user:${id}`, 'article', 'conflicted']);
      request.onsuccess = () => { const item = request.result; item.updatedAt = at + 3000; store.put(item); };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { id: owner, at: time });
  const secondDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出个人数据 JSON' }).click();
  const localFirst = JSON.parse(await readFile((await (await secondDownload).path())!, 'utf8'));
  expect(localFirst.data.articles).toMatchObject([{ id: 'conflicted', title: '本机版本', text: '本机正文' }]);
  expect(localFirst.data.cloudRecoveryCopies.workspace).toMatchObject([{ kind: 'article', id: 'conflicted', value: { title: '云端版本', text: '云端正文' } }]);
  await expect(page.getByText('导出完成，含未合并的云端副本')).toBeVisible();
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出记录 CSV' }).click();
  await csvDownload;
  await expect(page.getByText('导出完成；未合并的云端副本仅在 JSON 中')).toBeVisible();
  await other.close();
});
