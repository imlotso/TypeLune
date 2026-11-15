import { randomBytes, randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';

describe('bounded feedback image uploads', () => {
  let app: Awaited<ReturnType<typeof createApp>>; let now: number; const codes = new Map<string, string>();
  beforeEach(async () => { now = Date.now(); codes.clear(); app = await createApp({ databasePath: ':memory:', secureCookies: false, now: () => now, mailer: { async sendCode(email, code) { codes.set(email, code); } } }); });
  afterEach(async () => { await app.close(); });
  const post = (path: string, payload: Record<string, unknown>, headers?: Record<string, string>) => app.inject({ method: 'POST', url: path, payload, headers });
  async function register(name: string) {
    const email = `${name}@example.test`;
    await post('/api/auth/code', { email, purpose: 'register' });
    const result = await post('/api/auth/register', { username: name, email, password: 'password-123456', code: codes.get(email) });
    expect(result.statusCode).toBe(200);
    return { cookie: `session=${result.cookies.find((cookie) => cookie.name === 'session')!.value}`, 'x-workspace-owner': result.json().user.id as string };
  }
  it('uploads a real image larger than one function request, protects ownership and permits safe retries', async () => {
    const alice = await register('alice'); const bob = await register('bobby');
    const raw = randomBytes(1300 * 1300 * 3);
    const image = await sharp(raw, { raw: { width: 1300, height: 1300, channels: 3 } }).png().toBuffer();
    expect(image.length).toBeGreaterThan(4.5 * 1024 * 1024);
    expect(image.length).toBeLessThanOrEqual(5 * 1024 * 1024);
    const requestId = randomUUID(); const digest = createHash('sha256').update(image).digest('hex');
    const size = 768 * 1024; const chunkCount = Math.ceil(image.length / size);
    const reference = { staged: true, fileIndex: 0, name: 'large.png', mime: 'image/png', totalBytes: image.length, digest, chunkCount };
    const chunks = Array.from({ length: chunkCount }, (_, chunkIndex) => ({ requestId, fileIndex: 0, chunkIndex, chunkCount, name: reference.name,
      mime: reference.mime, totalBytes: reference.totalBytes, digest, data: image.subarray(chunkIndex * size, (chunkIndex + 1) * size).toString('base64') }));
    expect(Buffer.byteLength(JSON.stringify(chunks[0]))).toBeLessThan(4 * 1024 * 1024);
    expect((await post('/api/feedback/uploads', chunks[0])).statusCode).toBe(401);
    for (const chunk of chunks) expect((await post('/api/feedback/uploads', chunk, alice)).statusCode).toBe(200);
    expect((await post('/api/feedback/uploads', chunks[0], alice)).statusCode).toBe(200);
    const altered = Buffer.from(image.subarray(0, size)); altered[0] ^= 1;
    expect((await post('/api/feedback/uploads', { ...chunks[0], data: altered.toString('base64') }, alice)).statusCode).toBe(409);
    const payload = { requestId, category: 'issue', title: '截图', description: '大图', attachments: [reference] };
    expect((await post('/api/feedback', payload, bob)).statusCode).toBe(400);
    const created = await post('/api/feedback', payload, alice);
    expect(created.statusCode, created.body).toBe(201);
    const attachment = created.json().feedback.attachments[0].url as string;
    expect((await app.inject({ url: attachment, headers: bob })).statusCode).toBe(404);
    const downloaded = await app.inject({ url: attachment, headers: alice });
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.rawPayload.length).toBeLessThanOrEqual(3.5 * 1024 * 1024);
    expect((await sharp(downloaded.rawPayload).metadata()).format).toBe('webp');
    const retried = await post('/api/feedback', payload, alice);
    expect(retried.statusCode).toBe(201); expect(retried.json().feedback.id).toBe(created.json().feedback.id);
    expect((await post('/api/feedback', { ...payload, attachments: [{ ...reference, digest: 'f'.repeat(64) }] }, alice)).statusCode).toBe(409);
  }, 20_000);
  it('bounds abandoned tiny uploads and reclaims expired chunks', async () => {
    const alice = await register('alice');
    const chunk = () => ({ requestId: randomUUID(), fileIndex: 0, chunkIndex: 0, chunkCount: 1, name: 'tiny.png', mime: 'image/png', totalBytes: 1, digest: 'a'.repeat(64), data: 'AA==' });
    for (let index = 0; index < 4; index++) expect((await post('/api/feedback/uploads', chunk(), alice)).statusCode).toBe(200);
    expect((await post('/api/feedback/uploads', chunk(), alice)).statusCode).toBe(413);
    now += 24 * 60 * 60_000 + 1;
    expect((await post('/api/feedback/uploads', chunk(), alice)).statusCode).toBe(200);
  });
});
