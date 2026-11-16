import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AsyncDatabase } from './database/types.js';
import { encodeEmail } from './database/email.js';
import argon2 from 'argon2';
import { normalizeAvatar, profileValue } from './profile.js';
import { isValidDisplayName, isValidPassword, isValidUsername, passwordRule, usernameRule } from '../src/lib/account-validation.js';

export type AccountUser = {
  id: string; username: string; email: string; password_hash: string;
  role: 'user' | 'admin'; auth_version: number;
  display_name?: string | null; avatar?: string | null;
};
type Dependencies = {
  db: AsyncDatabase;
  userFor: (request: FastifyRequest) => Promise<AccountUser | undefined>;
  accountMatches: (request: FastifyRequest, user: AccountUser) => boolean;
  publicUser: (user: AccountUser) => object;
  clearSession: (request: FastifyRequest, reply: FastifyReply) => void;
};
type Result = { error: string; status: number } | { user?: AccountUser };

const fail = (reply: FastifyReply, message: string, status: number) => reply.code(status).send({ error: message });
const input = (request: FastifyRequest): Record<string, unknown> =>
  request.body && typeof request.body === 'object' && !Array.isArray(request.body) ? request.body as Record<string, unknown> : {};

export async function migrateAccounts(db: AsyncDatabase) {
  await db.transaction(async () => {
    const columns = new Set((await db.pragma('table_info(users)') as Array<{ name: string }>).map((column) => column.name));
    if (!columns.has('display_name')) await db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
    if (!columns.has('avatar')) await db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
    await db.exec('UPDATE users SET display_name=username WHERE display_name IS NULL');
  }).immediate();
}

export function registerAccountRoutes(app: FastifyInstance, { db, userFor, accountMatches, publicUser, clearSession }: Dependencies) {
  async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<AccountUser | undefined> {
    reply.header('Cache-Control', 'no-store');
    const user = await userFor(request);
    if (!user) { fail(reply, '请先登录', 401); return; }
    if (!accountMatches(request, user)) { fail(reply, '登录账号已变更', 403); return; }
    return user;
  }
  async function stillAuthorized(request: FastifyRequest, initial: AccountUser): Promise<AccountUser | undefined> {
    const current = await userFor(request);
    if (!current || current.id !== initial.id || !accountMatches(request, current) ||
      current.auth_version !== initial.auth_version || current.password_hash !== initial.password_hash) return;
    return current;
  }

  app.post('/api/account/username', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const initial = await requireUser(request, reply);
    if (!initial) return;
    const body = input(request);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    if (!isValidUsername(username)) return fail(reply, usernameRule, 400);
    if (currentPassword.length > 128 || !(await argon2.verify(initial.password_hash, currentPassword))) return fail(reply, '当前密码不正确', 401);
    const result = await db.transaction(async (): Promise<Result> => {
      const current = await stillAuthorized(request, initial);
      if (!current) return { error: '登录状态已失效，请重新登录', status: 401 };
      if (current.username !== initial.username) return { error: '账号资料已变更，请重试', status: 409 };
      const usernameEquals = db.dialect === 'postgres' ? `translate(username,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') COLLATE "C"=translate(?,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') COLLATE "C"` : 'username=?';
      if (await db.prepare(`SELECT id FROM users WHERE ${usernameEquals} AND id<>?`).get(username, current.id)) return { error: '用户名不可用', status: 409 };
      await db.prepare('UPDATE users SET display_name=COALESCE(display_name,username),username=? WHERE id=?').run(username, current.id);
      return { user: { ...current, username, display_name: current.display_name ?? current.username } };
    }).immediate();
    if ('error' in result) return fail(reply, result.error, result.status);
    return { user: publicUser(result.user!) };
  });

  app.post('/api/account/password', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const initial = await requireUser(request, reply);
    if (!initial) return;
    const body = input(request);
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!isValidPassword(newPassword) || newPassword !== body.confirmPassword) return fail(reply, `${passwordRule}，两次输入须一致`, 400);
    if (currentPassword.length > 128 || !(await argon2.verify(initial.password_hash, currentPassword))) return fail(reply, '当前密码不正确', 401);
    const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
    const result = await db.transaction(async (): Promise<Result> => {
      const current = await stillAuthorized(request, initial);
      if (!current) return { error: '登录状态已失效，请重新登录', status: 401 };
      await db.prepare('UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?').run(hash, current.id);
      await db.prepare('DELETE FROM sessions WHERE user_id=?').run(current.id);
      await db.prepare('DELETE FROM email_codes WHERE email=?').run(db.dialect === 'postgres' ? encodeEmail(current.email) : current.email);
      await db.prepare('DELETE FROM account_email_codes WHERE user_id=?').run(current.id);
      return {};
    }).immediate();
    if ('error' in result) return fail(reply, result.error, result.status);
    clearSession(request, reply);
    return { ok: true };
  });

  app.post('/api/account/profile', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const initial = await requireUser(request, reply);
    if (!initial) return;
    const body = input(request);
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!isValidDisplayName(displayName) ||
      (body.profilePublic !== undefined && typeof body.profilePublic !== 'boolean')) return fail(reply, '昵称或头像无效', 400);
    let avatar: string | null;
    try { const previous = profileValue(initial.avatar).avatar; avatar = body.avatar === previous ? previous : await normalizeAvatar(body.avatar); } catch { return fail(reply, '头像图片无效，请选择 JPG、PNG 或 WebP', 400); }
    const result = await db.transaction(async (): Promise<Result> => {
      const current = await stillAuthorized(request, initial);
      if (!current) return { error: '登录状态已失效，请重新登录', status: 401 };
      const profilePublic = typeof body.profilePublic === 'boolean' ? body.profilePublic : profileValue(current.avatar).profilePublic;
      const stored = JSON.stringify({ version: 1, avatar, profilePublic });
      await db.prepare('UPDATE users SET display_name=?,avatar=? WHERE id=?').run(displayName, stored, current.id);
      return { user: { ...current, display_name: displayName, avatar: stored } };
    }).immediate();
    if ('error' in result) return fail(reply, result.error, result.status);
    return { user: publicUser(result.user!) };
  });
}
