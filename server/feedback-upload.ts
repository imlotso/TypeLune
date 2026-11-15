import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AsyncDatabase } from './database/types.js';
import type { AccountUser } from './account.js';

export const feedbackChunkBytes = 768 * 1024;
const maxImageBytes = 5 * 1024 * 1024;
const maxPendingBytes = 48 * 1024 * 1024;
const expiryMs = 24 * 60 * 60_000;
const fields = {
  fileIndex: z.number().int().min(0).max(2), name: z.string().trim().min(1).max(255).regex(/^[^\p{Cc}\p{Cf}]+$/u),
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']), totalBytes: z.number().int().min(1).max(maxImageBytes),
  digest: z.string().regex(/^[a-f0-9]{64}$/u), chunkCount: z.number().int().min(1).max(Math.ceil(maxImageBytes / feedbackChunkBytes)),
};
export const stagedFeedbackAttachment = z.strictObject({ staged: z.literal(true), ...fields })
  .refine((item) => item.chunkCount === Math.ceil(item.totalBytes / feedbackChunkBytes));
const chunkInput = z.strictObject({ requestId: z.uuid(), ...fields, chunkIndex: z.number().int().min(0), data: z.string().min(1).max(Math.ceil(feedbackChunkBytes / 3) * 4) })
  .refine((item) => item.chunkCount === Math.ceil(item.totalBytes / feedbackChunkBytes) && item.chunkIndex < item.chunkCount);
export type StagedFeedbackAttachment = z.output<typeof stagedFeedbackAttachment>;
type Chunk = z.output<typeof chunkInput>;
type Row = { file_index: number; chunk_index: number; chunk_count: number; name: string; mime: string; total_bytes: number; digest: string; bytes: Buffer };
const sameMetadata = (row: Row, item: Pick<Chunk, 'fileIndex' | 'name' | 'mime' | 'totalBytes' | 'digest' | 'chunkCount'>) =>
  row.file_index === item.fileIndex && row.name === item.name && row.mime === item.mime && row.total_bytes === item.totalBytes && row.digest === item.digest && row.chunk_count === item.chunkCount;

export async function createFeedbackUploadStore(db: AsyncDatabase, now: () => number) {
  if (db.dialect === 'sqlite') await db.exec(`CREATE TABLE IF NOT EXISTS feedback_upload_chunks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, request_id TEXT NOT NULL, file_index INTEGER NOT NULL, chunk_index INTEGER NOT NULL,
    chunk_count INTEGER NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, total_bytes INTEGER NOT NULL, digest TEXT NOT NULL, bytes BLOB NOT NULL, created_at INTEGER NOT NULL,
    PRIMARY KEY(user_id,request_id,file_index,chunk_index));
    CREATE INDEX IF NOT EXISTS feedback_upload_expiry ON feedback_upload_chunks(created_at);`);
  const read = db.prepare('SELECT file_index,chunk_index,chunk_count,name,mime,total_bytes,digest,bytes FROM feedback_upload_chunks WHERE user_id=? AND request_id=? AND file_index=? ORDER BY chunk_index');
  const discard = async (owner: string, requestId: string) => { await db.prepare('DELETE FROM feedback_upload_chunks WHERE user_id=? AND request_id=?').run(owner, requestId); };
  const put = db.transaction(async (owner: string, item: Chunk, bytes: Buffer, authorize: () => Promise<boolean>) => {
    if (!(await authorize())) return 'unauthorized' as const;
    await db.prepare('DELETE FROM feedback_upload_chunks WHERE created_at<?').run(now() - expiryMs);
    const rows = await read.all(owner, item.requestId, item.fileIndex) as Row[];
    if (rows.some((row) => !sameMetadata(row, item))) return 'conflict' as const;
    const previous = rows.find((row) => row.chunk_index === item.chunkIndex);
    if (previous) return Buffer.isBuffer(previous.bytes) && previous.bytes.equals(bytes) ? 'ok' as const : 'conflict' as const;
    const size = db.dialect === 'postgres' ? 'octet_length(bytes)' : 'length(bytes)';
    const usage = await db.prepare(`SELECT COALESCE(SUM(${size}),0) AS bytes,COUNT(*) AS chunks,COUNT(DISTINCT request_id) AS requests FROM feedback_upload_chunks WHERE user_id=?`).get(owner) as { bytes: number; chunks: number; requests: number };
    const existingRequest = await db.prepare('SELECT 1 FROM feedback_upload_chunks WHERE user_id=? AND request_id=? LIMIT 1').get(owner, item.requestId);
    if (usage.bytes + bytes.length > maxPendingBytes || usage.chunks >= 84 || (!existingRequest && usage.requests >= 4)) return 'limit' as const;
    await db.prepare(`INSERT INTO feedback_upload_chunks(user_id,request_id,file_index,chunk_index,chunk_count,name,mime,total_bytes,digest,bytes,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(owner, item.requestId, item.fileIndex, item.chunkIndex, item.chunkCount, item.name, item.mime, item.totalBytes, item.digest, bytes, now());
    return 'ok' as const;
  });
  async function resolve(owner: string, requestId: string, references: StagedFeedbackAttachment[]) {
    if (new Set(references.map((item) => item.fileIndex)).size !== references.length) return undefined;
    const result: Array<{ name: string; data: string }> = [];
    for (const item of references) {
      const rows = await read.all(owner, requestId, item.fileIndex) as Row[];
      if (rows.length !== item.chunkCount || rows.some((row, index) => row.chunk_index !== index || !sameMetadata(row, item) || !Buffer.isBuffer(row.bytes))) return undefined;
      const bytes = Buffer.concat(rows.map((row) => row.bytes));
      if (bytes.length !== item.totalBytes || createHash('sha256').update(bytes).digest('hex') !== item.digest) return undefined;
      result.push({ name: item.name, data: `data:${item.mime};base64,${bytes.toString('base64')}` });
    }
    return result;
  }
  return { put: put.immediate, resolve, discard };
}

export function registerFeedbackUploadRoutes(app: FastifyInstance, store: Awaited<ReturnType<typeof createFeedbackUploadStore>>, access: {
  userFor: (request: FastifyRequest) => Promise<AccountUser | undefined>; accountMatches: (request: FastifyRequest, user: AccountUser) => boolean;
}) {
  app.post('/api/feedback/uploads', { bodyLimit: 2 * 1024 * 1024, config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async (request, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-store');
    const user = await access.userFor(request);
    if (!user) return reply.code(401).send({ error: '请先登录' });
    if (!access.accountMatches(request, user)) return reply.code(403).send({ error: '登录账号已变更' });
    const parsed = chunkInput.safeParse(request.body);
    if (!parsed.success || parsed.data.data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/u.test(parsed.data.data)) return reply.code(400).send({ error: '截图数据无效' });
    const item = parsed.data; const bytes = Buffer.from(item.data, 'base64');
    const expected = Math.min(feedbackChunkBytes, item.totalBytes - item.chunkIndex * feedbackChunkBytes);
    if (bytes.length !== expected || bytes.toString('base64') !== item.data) return reply.code(400).send({ error: '截图数据无效' });
    const outcome = await store.put(user.id, item, bytes, async () => {
      const current = await access.userFor(request);
      return !!current && current.id === user.id && current.auth_version === user.auth_version && access.accountMatches(request, current);
    });
    if (outcome === 'unauthorized') return reply.code(401).send({ error: '登录状态已失效，请重新登录' });
    if (outcome === 'conflict') return reply.code(409).send({ error: '截图内容已变更，请重新选择' });
    if (outcome === 'limit') return reply.code(413).send({ error: '待提交截图过多，请稍后重试' });
    return { ok: true };
  });
}
