import { randomUUID } from 'node:crypto';
import type { AsyncDatabase } from './database/types.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AccountUser } from './account.js';

type Dependencies = {
  db: AsyncDatabase; now: () => number; hashSession: (token: string) => string;
  userFor: (request: FastifyRequest) => Promise<AccountUser | undefined>;
  accountMatches: (request: FastifyRequest, user: AccountUser) => boolean;
  clearSession: (request: FastifyRequest, reply: FastifyReply) => void;
};
const fail = (reply: FastifyReply, message: string, status: number) => reply.code(status).send({ error: message });
const revokeInput = z.strictObject({ id: z.uuid() });

export async function migrateSessions(db: AsyncDatabase) {
  await db.transaction(async () => {
    const columns = new Set((await db.pragma('table_info(sessions)') as Array<{ name: string }>).map((column) => column.name));
    if (!columns.has('id')) await db.exec('ALTER TABLE sessions ADD COLUMN id TEXT');
    if (!columns.has('created_at')) await db.exec('ALTER TABLE sessions ADD COLUMN created_at INTEGER');
    if (!columns.has('last_active_at')) await db.exec('ALTER TABLE sessions ADD COLUMN last_active_at INTEGER');
    if (!columns.has('device')) await db.exec('ALTER TABLE sessions ADD COLUMN device TEXT');
    const missing = await db.prepare('SELECT token_hash FROM sessions WHERE id IS NULL').all() as Array<{ token_hash: string }>;
    const update = db.prepare('UPDATE sessions SET id=? WHERE token_hash=? AND id IS NULL');
    for (const row of missing) await update.run(randomUUID(), row.token_hash);
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sessions_public_id ON sessions(id)');
  }).immediate();
}

export function describeSessionDevice(agent: string | undefined) {
  const value = (agent ?? '').slice(0, 500);
  const platform = /Android/i.test(value) ? 'Android' : /iPhone|iPad|iPod/i.test(value) ? 'iOS' :
    /Windows/i.test(value) ? 'Windows' : /Macintosh|Mac OS/i.test(value) ? 'macOS' : /Linux/i.test(value) ? 'Linux' : '未知系统';
  const browser = /Edg\//i.test(value) ? 'Edge' : /Firefox\//i.test(value) ? 'Firefox' :
    /Chrome\//i.test(value) ? 'Chrome' : /Safari\//i.test(value) ? 'Safari' : '未知浏览器';
  return `${browser} · ${platform}`;
}

export function registerSessionRoutes(app: FastifyInstance, { db, now, hashSession, userFor, accountMatches, clearSession }: Dependencies) {
  async function requireUser(request: FastifyRequest, reply: FastifyReply) {
    reply.header('Cache-Control', 'no-store');
    const user = await userFor(request);
    if (!user) { fail(reply, '请先登录', 401); return; }
    if (!accountMatches(request, user)) { fail(reply, '登录账号已变更', 403); return; }
    return user;
  }
  const currentHash = (request: FastifyRequest) => hashSession(request.cookies.session ?? '');
  app.get('/api/account/sessions', async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const current = currentHash(request);
    const rows = await db.prepare(`SELECT id,token_hash AS tokenHash,device,created_at AS createdAt,last_active_at AS lastActiveAt
      FROM sessions WHERE user_id=? AND expires_at>? ORDER BY last_active_at DESC,created_at DESC,id`).all(user.id, now()) as Array<{
        id: string; tokenHash: string; device: string | null; createdAt: number | null; lastActiveAt: number | null;
      }>;
    return { sessions: rows.map(({ tokenHash, device, ...row }) => ({ ...row, device: device || '未知设备', current: tokenHash === current })) };
  });
  app.post('/api/account/sessions/revoke', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const parsed = revokeInput.safeParse(request.body); if (!parsed.success) return fail(reply, '会话无效', 400);
    const current = currentHash(request);
    const result = await db.transaction(async () => {
      const fresh = await userFor(request);
      if (!fresh || fresh.id !== user.id || !accountMatches(request, fresh)) return { error: '登录状态已失效', status: 401 } as const;
      const row = await db.prepare('SELECT token_hash FROM sessions WHERE id=? AND user_id=? AND expires_at>?').get(parsed.data.id, user.id, now()) as { token_hash: string } | undefined;
      if (!row) return { error: '会话不存在', status: 404 } as const;
      await db.prepare('DELETE FROM sessions WHERE id=? AND user_id=?').run(parsed.data.id, user.id);
      return { ok: true, current: row.token_hash === current } as const;
    }).immediate();
    if ('error' in result) return fail(reply, result.error ?? '操作失败', result.status ?? 400);
    if (result.current) clearSession(request, reply);
    return result;
  });
  app.post('/api/account/sessions/revoke-others', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    if (!z.strictObject({}).safeParse(request.body).success) return fail(reply, '请求无效', 400);
    const current = currentHash(request);
    const result = await db.transaction(async () => {
      const fresh = await userFor(request);
      if (!fresh || fresh.id !== user.id || !accountMatches(request, fresh)) return false;
      // Prevent a password verification that started before revocation from
      // creating a new session after the other sessions have been removed.
      await db.prepare('UPDATE users SET auth_version=auth_version+1 WHERE id=?').run(user.id);
      await db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(user.id, current);
      await db.prepare('DELETE FROM account_email_codes WHERE user_id=?').run(user.id);
      return true;
    }).immediate();
    return result ? { ok: true } : fail(reply, '登录状态已失效', 401);
  });
}
