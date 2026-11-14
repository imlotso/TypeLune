import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { catalogSnapshotKey, type ArticleSnapshot } from '../src/lib/models';

describe('feedback API', () => {
  let directory: string; let app: Awaited<ReturnType<typeof createApp>>; let codes: Map<string, string>;
  const password = 'original-password-123';
  const open = () => createApp({ databasePath: join(directory, 'test.sqlite'), secureCookies: false,
    adminEmail: 'admin@example.test', mailer: { async sendCode(email, code) { codes.set(email, code); } } });
  beforeEach(async () => { directory = mkdtempSync(join(tmpdir(), 'typing-feedback-')); codes = new Map(); app = await open(); });
  afterEach(async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); });
  const post = (url: string, payload: Record<string, unknown>, headers?: Record<string, string>) => app.inject({ method: 'POST', url, payload, headers });
  const get = (url: string, headers?: Record<string, string>) => app.inject({ method: 'GET', url, headers });
  async function register(username: string) {
    const email = `${username}@example.test`;
    await post('/api/auth/code', { email, purpose: 'register' });
    const result = await post('/api/auth/register', { username, email, password, code: codes.get(email) });
    expect(result.statusCode).toBe(200);
    const user = result.json().user as { id: string };
    return { cookie: `session=${result.cookies.find((cookie) => cookie.name === 'session')!.value}`, 'x-workspace-owner': user.id };
  }
  async function image() {
    const data = await sharp({ create: { width: 12, height: 10, channels: 3, background: '#aabbcc' } }).png().toBuffer();
    return { name: 'screenshot.png', data: `data:image/png;base64,${data.toString('base64')}` };
  }

  it('persists private feedback and re-encoded attachments across restart with owner and admin access only', async () => {
    const owner = await register('reader'); const other = await register('other'); const admin = await register('admin');
    const created = await post('/api/feedback', { category: 'issue', title: '输入问题', description: '出现了异常', attachments: [await image()] }, owner);
    expect(created.statusCode).toBe(201);
    const id = created.json().feedback.id as string;
    expect(created.json().feedback.status).toBe('pending');
    expect((await get('/api/feedback', owner)).json().entries).toHaveLength(1);
    expect((await get('/api/feedback', other)).json().entries).toEqual([]);
    expect((await get(`/api/feedback/${id}`, other)).statusCode).toBe(404);
    expect((await get(`/api/admin/feedback/${id}`, other)).statusCode).toBe(403);
    expect((await post(`/api/admin/feedback/${id}/handle`, { revision: 1, status: 'closed' }, other)).statusCode).toBe(403);
    expect((await get(`/api/feedback/${id}`)).statusCode).toBe(401);
    const detail = (await get(`/api/feedback/${id}`, owner)).json().feedback;
    const url = detail.attachments[0].url as string;
    expect((await get(url, other)).statusCode).toBe(404);
    expect((await get(url)).statusCode).toBe(401);
    const attachment = await get(url, admin);
    expect(attachment.statusCode).toBe(200);
    expect(attachment.headers['content-type']).toMatch(/^image\/webp/);
    expect((await sharp(attachment.rawPayload).metadata()).format).toBe('webp');
    await app.close(); app = await open();
    expect((await get(url, owner)).statusCode).toBe(200);
    expect((await get(`/api/feedback/${id}`, owner)).json().feedback.description).toBe('出现了异常');
  });

  it('keeps internal notes private and rejects stale moderation or user status changes', async () => {
    const owner = await register('reader'); const other = await register('other'); const admin = await register('admin');
    const created = await post('/api/feedback', { category: 'suggestion', title: '建议', description: '希望改进', attachments: [] }, owner);
    const id = created.json().feedback.id as string;
    expect((await post(`/api/feedback/${id}/messages`, { text: '补充内容', status: 'resolved' }, owner)).statusCode).toBe(400);
    expect((await post(`/api/feedback/${id}/messages`, { text: '他人的内容' }, other)).statusCode).toBe(404);
    expect((await post(`/api/feedback/${id}/messages`, { text: '补充内容' }, owner)).statusCode).toBe(200);
    const adminDetail = (await get(`/api/admin/feedback/${id}`, admin)).json().feedback;
    const update = { revision: adminDetail.revision, status: 'resolved', reply: '已处理', note: '仅管理员可见' };
    const results = await Promise.all([post(`/api/admin/feedback/${id}/handle`, update, admin), post(`/api/admin/feedback/${id}/handle`, update, admin)]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([200, 409]);
    const visible = await get(`/api/feedback/${id}`, owner);
    expect(visible.json().feedback.status).toBe('resolved');
    expect(visible.json().feedback.handledBy).toBe('admin');
    expect(visible.json().feedback.handledAt).toBeTypeOf('number');
    expect(visible.body).toContain('已处理');
    expect(visible.body).toContain('补充内容');
    expect(visible.body).not.toContain('仅管理员可见');
    expect(visible.json().feedback.messages.map((message: { authorKind: string; text: string }) => [message.authorKind, message.text])).toEqual([
      ['user', '补充内容'], ['status', 'resolved'], ['admin', '已处理'],
    ]);
    expect((await get(`/api/admin/feedback/${id}`, admin)).body).toContain('仅管理员可见');
    expect((await get('/api/admin/feedback?status=resolved&category=suggestion', admin)).json().entries).toHaveLength(1);
    const audit = await get('/api/admin/audit?targetType=feedback', admin);
    expect(audit.statusCode).toBe(200);
    expect(audit.body).not.toContain('仅管理员可见');
    expect(audit.body).not.toContain('已处理');
  });

  it('rejects invalid or oversized images without creating a partial feedback', async () => {
    const owner = await register('reader');
    const base = { category: 'issue', title: '图片', description: '测试图片' };
    const fake = { name: 'fake.png', data: `data:image/png;base64,${Buffer.from('not an image').toString('base64')}` };
    const oversized = { name: 'large.png', data: `data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64')}` };
    expect((await post('/api/feedback', { ...base, attachments: [fake] }, owner)).statusCode).toBe(400);
    expect((await post('/api/feedback', { ...base, attachments: [oversized] }, owner)).statusCode).toBe(400);
    expect((await post('/api/feedback', { ...base, attachments: [await image(), await image(), await image(), await image()] }, owner)).statusCode).toBe(400);
    expect((await get('/api/feedback', owner)).json().entries).toEqual([]);
  });

  it('accepts JPEG, PNG and WebP based on decoded content and rejects a misleading MIME type', async () => {
    const owner = await register('reader');
    const source = sharp({ create: { width: 20, height: 20, channels: 3, background: '#aabbcc' } });
    const png = await source.clone().png().toBuffer();
    const jpeg = await source.clone().jpeg().toBuffer();
    const webp = await source.clone().webp().toBuffer();
    const attachment = (name: string, mime: string, bytes: Buffer) => ({ name, data: `data:image/${mime};base64,${bytes.toString('base64')}` });
    const base = { category: 'issue', title: '图片', description: '截图' };
    expect((await post('/api/feedback', { ...base, attachments: [attachment('fake.jpg', 'jpeg', png)] }, owner)).statusCode).toBe(400);
    const result = await post('/api/feedback', { ...base, attachments: [attachment('a.png', 'png', png), attachment('b.jpg', 'jpeg', jpeg), attachment('c.webp', 'webp', webp)] }, owner);
    expect(result.statusCode).toBe(201);
    expect(result.json().feedback.attachments).toHaveLength(3);
    for (const item of result.json().feedback.attachments) expect((await get(item.url, owner)).headers['content-type']).toMatch(/^image\/webp/);
  });

  it('links only the current public article snapshot and never uploads private text', async () => {
    const owner = await register('reader'); const admin = await register('admin');
    const article = (await get('/api/articles')).json().articles[0] as ArticleSnapshot;
    const base = { category: 'article', title: '文章纠错', description: '标点有误', attachments: [] };
    const link = { id: article.id, snapshotKey: catalogSnapshotKey(article), position: '第一段', wrongText: '，' };
    expect((await post('/api/feedback', { ...base, article: { ...link, id: 'private-id' } }, owner)).statusCode).toBe(409);
    expect((await post('/api/feedback', { ...base, article: { ...link, snapshotKey: 'old' } }, owner)).statusCode).toBe(409);
    const created = await post('/api/feedback', { ...base, article: link }, owner);
    expect(created.statusCode).toBe(201);
    expect(created.json().feedback.article).toMatchObject({ id: article.id, title: article.title, snapshotKey: link.snapshotKey, position: '第一段' });
    expect(created.body).not.toContain(article.text);
    expect((await get(`/api/admin/feedback/${created.json().feedback.id}`, admin)).json().feedback.article.id).toBe(article.id);
  });

  it('deduplicates a retry after an uncertain response without silently accepting changed content', async () => {
    const owner = await register('reader');
    const payload = { requestId: randomUUID(), category: 'issue', title: '问题', description: '详细内容', attachments: [] };
    const [first, second] = await Promise.all([post('/api/feedback', payload, owner), post('/api/feedback', payload, owner)]);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json().feedback.id).toBe(second.json().feedback.id);
    expect((await get('/api/feedback', owner)).json().entries).toHaveLength(1);
    expect((await post('/api/feedback', { ...payload, title: '更改内容' }, owner)).statusCode).toBe(409);
  });
});
