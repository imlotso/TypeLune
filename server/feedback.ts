import { createHash, randomUUID } from 'node:crypto';
import type { AsyncDatabase } from './database/types.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { catalogSnapshotKey, type ArticleSnapshot } from '../src/lib/models.js';
import type { AccountUser } from './account.js';
import type { createAdminAudit } from './admin.js';
import { prepareFeedbackImages, type FeedbackImage } from './feedback-images.js';
import { stagedFeedbackAttachment, type StagedFeedbackAttachment, type createFeedbackUploadStore } from './feedback-upload.js';

const category = z.enum(['issue', 'suggestion', 'article']);
const status = z.enum(['pending', 'processing', 'resolved', 'closed']);
const text = z.string().trim().min(1).max(5000).refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value));
const identifier = z.string().min(1).max(200).regex(/^[^\p{Cc}\p{Cf}]+$/u);
const articleLink = z.strictObject({ id: identifier, snapshotKey: z.string().min(1).max(5000), position: z.string().trim().max(200).optional(), wrongText: z.string().trim().max(500).optional() });
const createInput = z.strictObject({ requestId: z.uuid().optional(), category, title: z.string().trim().min(1).max(160), description: text, attachments: z.array(z.unknown()).max(3), article: articleLink.optional() });
const replyInput = z.strictObject({ text });
const handleInput = z.strictObject({ revision: z.number().int().min(1), status, reply: z.string().trim().max(5000).optional(), note: z.string().trim().max(5000).optional() });
const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(1_000_000).optional().default(1), pageSize: z.coerce.number().int().min(1).max(100).optional().default(20) });
const adminQuery = pageQuery.extend({ category: category.optional(), status: status.optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
const fail = (reply: FastifyReply, message: string, code = 400) => reply.code(code).send({ error: message });
type FeedbackRow = { id: string; user_id: string; request_id: string | null; request_hash: string | null; category: string; title: string; description: string; status: string; revision: number; created_at: number; updated_at: number; handled_by: string | null; handled_at: number | null; article_id: string | null; article_title: string | null; article_snapshot: string | null; article_position: string | null; article_wrong: string | null };
type UserAccess = { userFor: (request: FastifyRequest) => Promise<AccountUser | undefined>; accountMatches: (request: FastifyRequest, user: AccountUser) => boolean };
type Store = Awaited<ReturnType<typeof createFeedbackStore>>;

export async function createFeedbackStore(db: AsyncDatabase, now: () => number, findPublished: (id: unknown) => Promise<ArticleSnapshot | undefined>, uploads: Awaited<ReturnType<typeof createFeedbackUploadStore>>) {
  if (db.dialect === 'sqlite') await db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, request_id TEXT, request_hash TEXT,
      category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      handled_by TEXT, handled_at INTEGER, article_id TEXT, article_title TEXT, article_snapshot TEXT,
      article_position TEXT, article_wrong TEXT, UNIQUE(user_id,request_id)
    );
    CREATE INDEX IF NOT EXISTS feedback_owner ON feedback(user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS feedback_status ON feedback(status,created_at DESC);
    CREATE TABLE IF NOT EXISTS feedback_messages (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL, author_kind TEXT NOT NULL, internal INTEGER NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS feedback_message_thread ON feedback_messages(feedback_id,sequence);
    CREATE TABLE IF NOT EXISTS feedback_attachments (
      id TEXT PRIMARY KEY, feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
      name TEXT NOT NULL, bytes BLOB NOT NULL
    );
  `);
  const find = async (id: string) => await db.prepare('SELECT * FROM feedback WHERE id=?').get(id) as FeedbackRow | undefined;
  const findRequest = async (owner: string, id: string) => await db.prepare('SELECT * FROM feedback WHERE user_id=? AND request_id=?').get(owner, id) as FeedbackRow | undefined;
  const serialize = async (row: FeedbackRow, internal: boolean) => ({
    id: row.id, category: row.category, title: row.title, description: row.description, status: row.status,
    revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at,
    handledBy: row.handled_by ? (await db.prepare('SELECT COALESCE(display_name,username) AS name FROM users WHERE id=?').get(row.handled_by) as { name: string } | undefined)?.name ?? '管理员' : null,
    handledAt: row.handled_at,
    ...(row.article_id && { article: { id: row.article_id, title: row.article_title, snapshotKey: row.article_snapshot, position: row.article_position, wrongText: row.article_wrong } }),
    messages: await db.prepare(`SELECT id,author_kind AS authorKind,text,created_at AS createdAt${internal ? ',internal' : ''}
      FROM feedback_messages WHERE feedback_id=? ${internal ? '' : 'AND internal=0'} ORDER BY sequence`).all(row.id),
    attachments: (await db.prepare(`SELECT id,name FROM feedback_attachments WHERE feedback_id=? ORDER BY ${db.dialect === 'sqlite' ? 'rowid' : 'id'}`).all(row.id) as Array<{ id: string; name: string }>)
      .map((item) => ({ ...item, url: `/api/feedback/${encodeURIComponent(row.id)}/attachments/${encodeURIComponent(item.id)}` })),
  });
  const summary = 'id,category,title,status,revision,created_at AS createdAt,updated_at AS updatedAt';
  async function userList(owner: string, query: z.output<typeof pageQuery>) {
    const { count } = await db.prepare('SELECT COUNT(*) AS count FROM feedback WHERE user_id=?').get(owner) as { count: number };
    const entries = await db.prepare(`SELECT ${summary} FROM feedback WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`)
      .all(owner, query.pageSize, (query.page - 1) * query.pageSize);
    return { entries, total: count, ...query };
  }
  async function adminList(query: z.output<typeof adminQuery>) {
    const from = query.from ? Date.parse(`${query.from}T00:00:00Z`) : 0;
    const to = query.to ? Date.parse(`${query.to}T00:00:00Z`) + 86_400_000 : Number.MAX_SAFE_INTEGER;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return;
    const where = 'WHERE (@category IS NULL OR category=@category) AND (@status IS NULL OR status=@status) AND created_at>=@from AND created_at<@to';
    const params = { category: query.category ?? null, status: query.status ?? null, from, to };
    const { count } = await db.prepare(`SELECT COUNT(*) AS count FROM feedback ${where}`).get(params) as { count: number };
    const entries = await db.prepare(`SELECT ${summary},handled_by AS handledBy,handled_at AS handledAt,article_id AS articleId,article_title AS articleTitle FROM feedback ${where} ORDER BY created_at DESC,id DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit: query.pageSize, offset: (query.page - 1) * query.pageSize });
    return { entries, total: count, page: query.page, pageSize: query.pageSize };
  }
  async function resolveArticle(link: z.output<typeof articleLink> | undefined) {
    if (!link) return null;
    const article = await findPublished(link.id);
    if (!article || catalogSnapshotKey(article) !== link.snapshotKey) return undefined;
    return { ...link, title: article.title };
  }
  const create = db.transaction(async (owner: string, body: z.output<typeof createInput>, images: FeedbackImage[], requestHash: string, staged: StagedFeedbackAttachment[], authorize: () => Promise<boolean>) => {
    if (!(await authorize())) return { unauthorized: true };
    const previous = body.requestId && await findRequest(owner, body.requestId);
    if (previous) {
      if (previous.request_hash !== requestHash) return { conflict: true };
      if (body.requestId && staged.length) await uploads.discard(owner, body.requestId);
      return { feedback: await serialize(previous, false) };
    }
    if (staged.length && (!body.requestId || !(await uploads.resolve(owner, body.requestId, staged)))) return { invalidUploads: true };
    const linked = await resolveArticle(body.article);
    if (linked === undefined) return { articleChanged: true };
    const id = randomUUID(); const time = now();
    await db.prepare(`INSERT INTO feedback(id,user_id,request_id,request_hash,category,title,description,status,created_at,updated_at,article_id,article_title,article_snapshot,article_position,article_wrong)
      VALUES (?,?,?,?,?,?,?,'pending',?,?,?,?,?,?,?)`)
      .run(id, owner, body.requestId ?? null, body.requestId ? requestHash : null, body.category, body.title, body.description, time, time, linked?.id ?? null, linked?.title ?? null, linked?.snapshotKey ?? null, linked?.position ?? null, linked?.wrongText ?? null);
    const insert = db.prepare('INSERT INTO feedback_attachments(id,feedback_id,name,bytes) VALUES (?,?,?,?)');
    for (const image of images) await insert.run(randomUUID(), id, image.name, image.bytes);
    if (body.requestId && staged.length) await uploads.discard(owner, body.requestId);
    return { feedback: await serialize((await find(id))!, false) };
  });
  const addMessage = db.transaction(async (id: string, owner: string, message: string, authorize: () => Promise<boolean>) => {
    if (!(await authorize())) return { unauthorized: true } as const;
    const row = await find(id);
    if (!row || row.user_id !== owner) return { missing: true } as const;
    const time = now();
    await db.prepare("INSERT INTO feedback_messages(id,feedback_id,author_id,author_kind,internal,text,created_at) VALUES (?,?,?,'user',0,?,?)")
      .run(randomUUID(), row.id, owner, message, time);
    await db.prepare('UPDATE feedback SET revision=revision+1,updated_at=? WHERE id=?').run(time, row.id);
    return { feedback: await serialize((await find(row.id))!, false) } as const;
  });
  return { db, now, find, findRequest, serialize, userList, adminList, resolveArticle, uploads, create: create.immediate, addMessage: addMessage.immediate };
}

export function registerFeedbackRoutes(app: FastifyInstance, store: Store, { userFor, accountMatches }: UserAccess) {
  async function requireUser(request: FastifyRequest, reply: FastifyReply) {
    reply.header('Cache-Control', 'no-store');
    const user = await userFor(request);
    if (!user) { fail(reply, '请先登录', 401); return; }
    if (!accountMatches(request, user)) { fail(reply, '登录账号已变更', 403); return; }
    return user;
  }
  async function validCurrent(request: FastifyRequest, original: AccountUser) {
    const user = await userFor(request);
    return !!user && user.id === original.id && user.auth_version === original.auth_version && accountMatches(request, user);
  }
  app.get('/api/feedback', async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const parsed = pageQuery.safeParse(request.query); if (!parsed.success) return fail(reply, '分页无效');
    return store.userList(user.id, parsed.data);
  });
  app.post('/api/feedback', { bodyLimit: 22 * 1024 * 1024, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const parsed = createInput.safeParse(request.body); if (!parsed.success) return fail(reply, '反馈内容无效');
    const requestHash = createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
    const previous = parsed.data.requestId && await store.findRequest(user.id, parsed.data.requestId);
    if (previous) {
      if (previous.request_hash !== requestHash) return fail(reply, '请求内容已更改，请重新提交', 409);
      if (parsed.data.requestId) await store.uploads.discard(user.id, parsed.data.requestId);
      return reply.code(201).send({ feedback: await store.serialize(previous, false) });
    }
    if (parsed.data.article && parsed.data.category !== 'article') return fail(reply, '文章关联无效');
    const linked = await store.resolveArticle(parsed.data.article);
    if (linked === undefined) return fail(reply, '文章已更新，请重新选择', 409);
    const staged: StagedFeedbackAttachment[] = [];
    for (const item of parsed.data.attachments) {
      const value = stagedFeedbackAttachment.safeParse(item);
      if (value.success) staged.push(value.data);
      else if (item && typeof item === 'object' && 'staged' in item) return fail(reply, '截图数据无效');
    }
    if (staged.length && !parsed.data.requestId) return fail(reply, '截图数据无效');
    const resolved = staged.length ? await store.uploads.resolve(user.id, parsed.data.requestId!, staged) : [];
    if (!resolved) return fail(reply, '截图未上传完整，请重试');
    let stagedIndex = 0;
    const attachments = parsed.data.attachments.map((item) => stagedFeedbackAttachment.safeParse(item).success ? resolved[stagedIndex++] : item);
    let images: FeedbackImage[];
    try { images = await prepareFeedbackImages(attachments); }
    catch (error) { return fail(reply, error instanceof Error ? error.message : '截图无效'); }
    if (!(await validCurrent(request, user))) return fail(reply, '登录状态已失效，请重新登录', 401);
    const completed = parsed.data.requestId && await store.findRequest(user.id, parsed.data.requestId);
    if (completed) {
      if (completed.request_hash !== requestHash) return fail(reply, '请求内容已更改，请重新提交', 409);
      if (parsed.data.requestId) await store.uploads.discard(user.id, parsed.data.requestId);
      return reply.code(201).send({ feedback: await store.serialize(completed, false) });
    }
    // Recheck the public snapshot after the asynchronous image processing.
    const fresh = await store.resolveArticle(parsed.data.article);
    if (fresh === undefined) return fail(reply, '文章已更新，请重新选择', 409);
    const result = await store.create(user.id, parsed.data, images, requestHash, staged, () => validCurrent(request, user));
    if ('conflict' in result) return fail(reply, '请求内容已更改，请重新提交', 409);
    if ('invalidUploads' in result) return fail(reply, '截图未上传完整，请重试');
    if ('unauthorized' in result) return fail(reply, '登录状态已失效，请重新登录', 401);
    if ('articleChanged' in result) return fail(reply, '文章已更新，请重新选择', 409);
    return reply.code(201).send(result);
  });
  app.get<{ Params: { id: string } }>('/api/feedback/:id', async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const row = await store.find(request.params.id);
    if (!row || row.user_id !== user.id) return fail(reply, '反馈不存在', 404);
    return { feedback: await store.serialize(row, false) };
  });
  app.post<{ Params: { id: string } }>('/api/feedback/:id/messages', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const parsed = replyInput.safeParse(request.body); if (!parsed.success) return fail(reply, '补充内容无效');
    const row = await store.find(request.params.id);
    if (!row || row.user_id !== user.id) return fail(reply, '反馈不存在', 404);
    const result = await store.addMessage(row.id, user.id, parsed.data.text, () => validCurrent(request, user));
    if ('unauthorized' in result) return fail(reply, '登录状态已失效，请重新登录', 401);
    if ('missing' in result) return fail(reply, '反馈不存在', 404);
    return result;
  });
  app.get<{ Params: { id: string; attachmentId: string } }>('/api/feedback/:id/attachments/:attachmentId', async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const row = await store.find(request.params.id);
    if (!row || (row.user_id !== user.id && user.role !== 'admin')) return fail(reply, '附件不存在', 404);
    const attachment = await store.db.prepare('SELECT bytes FROM feedback_attachments WHERE id=? AND feedback_id=?').get(request.params.attachmentId, row.id) as { bytes: Buffer } | undefined;
    if (!attachment) return fail(reply, '附件不存在', 404);
    return reply.header('X-Content-Type-Options', 'nosniff').header('Content-Security-Policy', "default-src 'none'; sandbox").type('image/webp').send(attachment.bytes);
  });
}

export function registerAdminFeedbackRoutes(app: FastifyInstance, store: Store, audit: ReturnType<typeof createAdminAudit>) {
  app.get('/feedback', async (request, reply) => {
    const parsed = adminQuery.safeParse(request.query); if (!parsed.success) return fail(reply, '筛选条件无效');
    const list = await store.adminList(parsed.data); return list ?? fail(reply, '日期范围无效');
  });
  app.get<{ Params: { id: string } }>('/feedback/:id', async (request, reply) => {
    const row = await store.find(request.params.id); return row ? { feedback: await store.serialize(row, true) } : fail(reply, '反馈不存在', 404);
  });
  app.post<{ Params: { id: string } }>('/feedback/:id/handle', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = handleInput.safeParse(request.body); if (!parsed.success) return fail(reply, '处理内容无效');
    const result = await store.db.transaction(async () => {
      const row = await store.find(request.params.id);
      if (!row) return { error: '反馈不存在', status: 404 } as const;
      if (row.revision !== parsed.data.revision) return { error: '反馈已更新，请刷新后重试', status: 409 } as const;
      const { status: next, reply: publicReply, note } = parsed.data;
      if (next === row.status && !publicReply && !note) return { error: '没有需要保存的更改', status: 400 } as const;
      const time = store.now();
      await store.db.prepare('UPDATE feedback SET status=?,revision=revision+1,updated_at=?,handled_by=?,handled_at=? WHERE id=?')
        .run(next, time, request.admin.id, time, row.id);
      const insert = store.db.prepare("INSERT INTO feedback_messages(id,feedback_id,author_id,author_kind,internal,text,created_at) VALUES (?,?,?,'admin',?,?,?)");
      if (next !== row.status) await store.db.prepare("INSERT INTO feedback_messages(id,feedback_id,author_id,author_kind,internal,text,created_at) VALUES (?,?,?,'status',0,?,?)")
        .run(randomUUID(), row.id, request.admin.id, next, time);
      if (publicReply) await insert.run(randomUUID(), row.id, request.admin.id, 0, publicReply, time);
      if (note) await insert.run(randomUUID(), row.id, request.admin.id, 1, note, time);
      await audit(request.admin, 'feedback.handle', 'feedback', row.id, `反馈 ${row.id}`, null);
      return { feedback: await store.serialize((await store.find(row.id))!, true) } as const;
    }).immediate();
    return 'error' in result ? fail(reply, result.error ?? '处理失败', result.status) : result;
  });
}
