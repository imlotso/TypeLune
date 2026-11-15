import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AsyncDatabase } from './database/types.js';
import { encodeEmail } from './database/email.js';
import argon2 from 'argon2';
import { isValidEmail } from '../src/lib/account-validation.js';
import type { AccountUser } from './account.js';
import type { Mailer } from './smtp.js';

type Dependencies = {
  db: AsyncDatabase; now: () => number; codeSecret: string; mailer: () => Promise<Mailer | undefined>;
  userFor: (request: FastifyRequest) => Promise<AccountUser | undefined>;
  accountMatches: (request: FastifyRequest, user: AccountUser) => boolean;
  clearSession: (request: FastifyRequest, reply: FastifyReply) => void;
};
type CodeRow = { code_hash: string; expires_at: number; attempts: number; auth_version: number };
type Outcome = { error: string; status: number } | { ok: true };
const input = (request: FastifyRequest): Record<string, unknown> =>
  request.body && typeof request.body === 'object' && !Array.isArray(request.body) ? request.body as Record<string, unknown> : {};
const fail = (reply: FastifyReply, message: string, status: number) => reply.code(status).send({ error: message });
const cleanEmail = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';

export async function registerAccountEmailRoutes(app: FastifyInstance, { db, now, codeSecret, mailer, userFor, accountMatches, clearSession }: Dependencies) {
  if (db.dialect === 'sqlite') await db.exec(`CREATE TABLE IF NOT EXISTS account_email_codes (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_email TEXT NOT NULL COLLATE NOCASE, code_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, auth_version INTEGER NOT NULL,
    PRIMARY KEY(user_id,target_email)
  )`);
  const hash = (userId: string, email: string, code: string) =>
    createHmac('sha256', codeSecret).update(`change-email\0${userId}\0${email}\0${code}`).digest('hex');
  const emailEquals = db.dialect === 'postgres' ? 'dazi_email_key(email)=dazi_email_key(?)' : 'email=?';
  const storageEmail = (email: string) => db.dialect === 'postgres' ? encodeEmail(email) : email;
  async function requireUser(request: FastifyRequest, reply: FastifyReply) {
    reply.header('Cache-Control', 'no-store');
    const user = await userFor(request);
    if (!user) { fail(reply, '请先登录', 401); return; }
    if (!accountMatches(request, user)) { fail(reply, '登录账号已变更', 403); return; }
    return user;
  }
  async function currentUser(request: FastifyRequest, initial: AccountUser) {
    const current = await userFor(request);
    return current && current.id === initial.id && accountMatches(request, current) &&
      current.auth_version === initial.auth_version && current.password_hash === initial.password_hash ? current : undefined;
  }

  app.post('/api/account/email/code', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const initial = await requireUser(request, reply);
    if (!initial) return;
    const body = input(request);
    const email = cleanEmail(body.email);
    const password = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    if (!isValidEmail(email)) return fail(reply, '请输入有效邮箱', 400);
    if (password.length > 128 || !(await argon2.verify(initial.password_hash, password))) return fail(reply, '当前密码不正确', 401);
    const deliver = await mailer();
    if (!deliver) return fail(reply, '邮件服务尚未配置，请稍后再试', 503);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = hash(initial.id, email, code);
    const result = await db.transaction(async (): Promise<Outcome> => {
      const current = await currentUser(request, initial);
      if (!current) return { error: '登录状态已失效，请重新登录', status: 401 };
      if (await db.prepare(`SELECT id FROM users WHERE ${emailEquals}`).get(storageEmail(email))) return { error: '邮箱不可用', status: 409 };
      await db.prepare('DELETE FROM account_email_codes WHERE user_id=? AND expires_at<?').run(current.id, now());
      const previous = await db.prepare('SELECT created_at FROM account_email_codes WHERE user_id=? AND target_email=?').get(current.id, email) as { created_at: number } | undefined;
      if (previous && now() - previous.created_at < 60_000) return { error: '请稍后再获取验证码', status: 429 };
      const pending = await db.prepare('SELECT COUNT(*) AS count FROM account_email_codes WHERE user_id=?').get(current.id) as { count: number };
      if (!previous && pending.count >= 5) return { error: '验证码请求过多，请稍后重试', status: 429 };
      const issuedAt = now();
      await db.prepare(`INSERT INTO account_email_codes(user_id,target_email,code_hash,created_at,expires_at,attempts,auth_version)
        VALUES (?,?,?,?,?,0,?) ON CONFLICT(user_id,target_email) DO UPDATE SET
        code_hash=excluded.code_hash,created_at=excluded.created_at,expires_at=excluded.expires_at,attempts=0,auth_version=excluded.auth_version`)
        .run(current.id, email, codeHash, issuedAt, issuedAt + 10 * 60_000, current.auth_version);
      return { ok: true };
    }).immediate();
    if ('error' in result) return fail(reply, result.error, result.status);
    try { await deliver.sendCode(email, code, 'change-email'); }
    catch {
      await db.prepare('DELETE FROM account_email_codes WHERE user_id=? AND target_email=? AND code_hash=?').run(initial.id, email, codeHash);
      return fail(reply, '邮件发送失败，请稍后再试', 503);
    }
    if (!(await currentUser(request, initial))) {
      await db.prepare('DELETE FROM account_email_codes WHERE user_id=? AND target_email=? AND code_hash=?').run(initial.id, email, codeHash);
      return fail(reply, '登录状态已失效，请重新登录', 401);
    }
    return { ok: true };
  });

  app.post('/api/account/email/confirm', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const initial = await requireUser(request, reply);
    if (!initial) return;
    const body = input(request);
    const email = cleanEmail(body.email);
    const code = typeof body.code === 'string' ? body.code : '';
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) return fail(reply, '验证码错误或已过期', 400);
    const result = await db.transaction(async (): Promise<Outcome> => {
      const current = await currentUser(request, initial);
      if (!current) return { error: '登录状态已失效，请重新登录', status: 401 };
      const row = await db.prepare('SELECT code_hash,expires_at,attempts,auth_version FROM account_email_codes WHERE user_id=? AND target_email=?')
        .get(current.id, email) as CodeRow | undefined;
      if (!row || row.expires_at < now() || row.attempts >= 5 || row.auth_version !== current.auth_version) return { error: '验证码错误或已过期', status: 400 };
      const supplied = Buffer.from(hash(current.id, email, code), 'hex');
      const saved = Buffer.from(row.code_hash, 'hex');
      if (supplied.length !== saved.length || !timingSafeEqual(supplied, saved)) {
        await db.prepare('UPDATE account_email_codes SET attempts=attempts+1 WHERE user_id=? AND target_email=? AND code_hash=?').run(current.id, email, row.code_hash);
        return { error: '验证码错误或已过期', status: 400 };
      }
      if (await db.prepare(`SELECT id FROM users WHERE ${emailEquals} AND id<>?`).get(storageEmail(email), current.id)) return { error: '邮箱不可用', status: 409 };
      await db.prepare('UPDATE users SET email=?,auth_version=auth_version+1 WHERE id=?').run(storageEmail(email), current.id);
      await db.prepare('DELETE FROM sessions WHERE user_id=?').run(current.id);
      await db.prepare('DELETE FROM email_codes WHERE email IN (?,?)').run(storageEmail(current.email), storageEmail(email));
      await db.prepare('DELETE FROM account_email_codes WHERE user_id=?').run(current.id);
      return { ok: true };
    }).immediate();
    if ('error' in result) return fail(reply, result.error, result.status);
    clearSession(request, reply);
    return { ok: true };
  });
}
