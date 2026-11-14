import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import argon2 from 'argon2';
import { z } from 'zod';
import type { AccountUser } from './account';

type Dependencies = { db: Database.Database; now: () => number;
  userFor: (request: FastifyRequest) => AccountUser | undefined;
  accountMatches: (request: FastifyRequest, user: AccountUser) => boolean;
  clearSession: (request: FastifyRequest, reply: FastifyReply) => void };
const bodySchema = z.strictObject({ currentPassword: z.string().max(128) });
const fail = (reply: FastifyReply, message: string, status: number) => reply.code(status).send({ error: message });

export function registerAccountDeletion(app: FastifyInstance, { db, now, userFor, accountMatches, clearSession }: Dependencies) {
  app.post('/api/account/delete', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const user = userFor(request);
    if (!user) return fail(reply, '请先登录', 401);
    if (!accountMatches(request, user)) return fail(reply, '登录账号已变更', 403);
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success || !(await argon2.verify(user.password_hash, parsed.data.currentPassword))) return fail(reply, '当前密码不正确', 401);
    const result = db.transaction(() => {
      const current = userFor(request);
      if (!current || current.id !== user.id || !accountMatches(request, current) || current.auth_version !== user.auth_version || current.password_hash !== user.password_hash) {
        return { error: '登录状态已失效，请重新登录', status: 401 } as const;
      }
      const activeAdmins = (db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin' AND disabled_at IS NULL").get() as { count: number }).count;
      if (current.role === 'admin' && activeAdmins <= 1) return { error: '至少保留一个启用的管理员账号', status: 409 } as const;
      const anonymous = `deleted-${randomUUID()}`;
      const owner = `u:${current.id}`;
      db.prepare("UPDATE admin_audit SET actor_id=?,actor_name='已注销账号',reason=NULL WHERE actor_id=?").run(anonymous, current.id);
      db.prepare("UPDATE admin_audit SET target_id=?,target_label='已注销账号',reason=NULL WHERE target_type='user' AND target_id=?").run(anonymous, current.id);
      db.prepare("UPDATE admin_audit SET target_id=?,target_label='已删除成绩',reason=NULL WHERE target_type='score' AND target_id IN (SELECT id FROM challenges WHERE owner=?)").run(anonymous, owner);
      db.prepare("UPDATE admin_audit SET target_id=?,target_label='已删除反馈',reason=NULL WHERE target_type='feedback' AND target_id IN (SELECT id FROM feedback WHERE user_id=?)").run(anonymous, current.id);
      db.prepare('UPDATE feedback_messages SET author_id=? WHERE author_id=?').run(anonymous, current.id);
      db.prepare('UPDATE feedback SET handled_by=? WHERE handled_by=?').run(anonymous, current.id);
      db.prepare('DELETE FROM email_codes WHERE email=?').run(current.email);
      db.prepare('DELETE FROM scores WHERE owner=?').run(owner);
      db.prepare('INSERT OR IGNORE INTO retired_attempts(id) SELECT id FROM challenges WHERE owner=?').run(owner);
      db.prepare('DELETE FROM history_deletion_receipts WHERE owner=?').run(owner);
      db.prepare('DELETE FROM challenges WHERE owner=?').run(owner);
      db.prepare('DELETE FROM users WHERE id=?').run(current.id);
      db.prepare(`INSERT INTO admin_audit(actor_id,actor_name,action,target_type,target_id,target_label,reason,created_at)
        VALUES (?,'已注销账号','user.self_delete','user',?,'已注销账号',NULL,?)`).run(anonymous, anonymous, now());
      return { ok: true } as const;
    }).immediate();
    if ('error' in result) return fail(reply, result.error ?? '注销失败', result.status ?? 400);
    clearSession(request, reply);
    return result;
  });
}
