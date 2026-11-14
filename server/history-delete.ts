import type Database from 'better-sqlite3';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AccountUser } from './account';
import { WorkspaceConflictError, WorkspaceLimitError, type createWorkspaceStore } from './workspace';
import { legacyProofStatuses, type LegacyRecordProof } from '../src/lib/records';

const recordId = z.string().min(1).max(200).regex(/^[^\p{Cc}\p{Cf}]+$/u);
const requestBody = z.strictObject({ ids: z.array(recordId).min(1).max(200), expectedOnlineIds: z.array(recordId).max(100).optional().default([]),
  localConflicts: z.array(z.string().regex(/^legacy-conflict-[0-9a-f]{64}$/u)).max(100).optional().default([]),
  expectedRevisions: z.array(z.strictObject({ id: recordId, revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) })).max(200).optional().default([]),
  legacyPairs: z.array(z.strictObject({ id: recordId, alias: z.string().regex(/^guest-[0-9a-f]{16}$/u), proof: z.strictObject({
    localOnly: z.boolean().optional(), status: z.enum(legacyProofStatuses).optional(), localSyncGeneration: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  }).optional() })).max(100).optional().default([]) })
  .refine(({ ids, expectedOnlineIds, legacyPairs, localConflicts, expectedRevisions }) => new Set(ids).size === ids.length && new Set(expectedOnlineIds).size === expectedOnlineIds.length &&
    new Set(localConflicts).size === localConflicts.length && localConflicts.every((id) => ids.includes(id)) &&
    new Set(expectedRevisions.map((item) => item.id)).size === expectedRevisions.length && expectedRevisions.every((item) => ids.includes(item.id)) &&
    expectedOnlineIds.every((id) => ids.includes(id)) && new Set(legacyPairs.map((pair) => pair.alias)).size === legacyPairs.length && new Set(legacyPairs.map((pair) => pair.id)).size === legacyPairs.length &&
    legacyPairs.every(({ id, alias }) => id !== alias && ids.includes(id) && ids.includes(alias)));
type Dependencies = { db: Database.Database; now: () => number; workspace: ReturnType<typeof createWorkspaceStore>;
  userFor: (request: FastifyRequest) => AccountUser | undefined;
  getOwner: (request: FastifyRequest, reply: FastifyReply, create?: boolean) => string | null };

export function registerHistoryDeletion(app: FastifyInstance, { db, now, workspace, userFor, getOwner }: Dependencies) {
  // A deleted attempt cannot be recreated through a saved recovery credential.
  // Random attempt IDs are retained without their former owner or practice text.
  db.exec(`CREATE TABLE IF NOT EXISTS retired_attempts (id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS history_deletion_receipts (owner TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY(owner,id))`);
  const retired = db.prepare('SELECT 1 FROM retired_attempts WHERE id=?');
  const owned = db.prepare('SELECT id,finished_at,published FROM challenges WHERE id=? AND owner=?');
  const receipt = db.prepare('SELECT 1 FROM history_deletion_receipts WHERE owner=? AND id=?');
  const erase = db.prepare('DELETE FROM challenges WHERE id=? AND owner=? AND finished_at IS NOT NULL');
  const withdraw = db.transaction((owner: string, userId: string | undefined, ids: string[], expectedOnlineIds: string[], legacyPairs: Array<{ id: string; alias: string; proof?: LegacyRecordProof }>, localConflicts: string[], expectedRevisions: Array<{ id: string; revision: number }>) => {
    const challenges = ids.map((id) => owned.get(id, owner) as { id: string; finished_at: number | null; published: number } | undefined);
    if (challenges.some((item) => item && item.finished_at === null)) return 'active' as const;
    const found = new Set(challenges.filter((item): item is NonNullable<typeof item> => !!item).map((item) => item.id));
    if (expectedOnlineIds.some((id) => !found.has(id) && !receipt.get(owner, id))) return 'missing' as const;
    if (userId) workspace.deleteRecords(userId, ids, now(), legacyPairs, localConflicts, expectedRevisions);
    for (const challenge of challenges) {
      if (!challenge) continue;
      db.prepare('INSERT OR IGNORE INTO retired_attempts(id) VALUES (?)').run(challenge.id);
      db.prepare('INSERT OR IGNORE INTO history_deletion_receipts(owner,id) VALUES (?,?)').run(owner, challenge.id);
      db.prepare('DELETE FROM scores WHERE attempt_id=? AND owner=?').run(challenge.id, owner);
      if (challenge.published) {
        db.prepare("UPDATE admin_audit SET target_label='已撤回成绩',reason=NULL WHERE target_type='score' AND target_id=?").run(challenge.id);
        db.prepare(`INSERT INTO admin_audit(actor_id,actor_name,action,target_type,target_id,target_label,reason,created_at)
          VALUES (?,'用户','score.self_withdraw','score',?,'已撤回成绩',NULL,?)`).run(userId ?? 'guest', challenge.id, now());
      }
      erase.run(challenge.id, owner);
    }
    return 'ok' as const;
  });
  app.post('/api/history/delete', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const user = userFor(request);
    const expected = request.headers['x-workspace-owner'];
    if (expected !== undefined && expected !== (user?.id ?? 'guest')) return reply.code(user ? 403 : 401).send({ error: user ? '登录账号已变更' : '请先登录' });
    const parsed = requestBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: '请选择有效记录' });
    const owner = getOwner(request, reply, true)!;
    try {
      const outcome = withdraw.immediate(owner, user?.id, parsed.data.ids, parsed.data.expectedOnlineIds, parsed.data.legacyPairs, parsed.data.localConflicts, parsed.data.expectedRevisions);
      if (outcome === 'active') return reply.code(409).send({ error: '练习仍在进行，无法删除' });
      if (outcome === 'missing') return reply.code(409).send({ error: '无法确认部分在线成绩，请检查登录状态后重试' });
    } catch (error) {
      if (error instanceof WorkspaceLimitError) return reply.code(413).send({ error: '同步空间已满，请先整理后重试' });
      if (error instanceof WorkspaceConflictError) return reply.code(409).send({ error: '记录标识已被占用，请刷新后重试' });
      throw error;
    }
    if (!user) return { ok: true };
    const snapshot = workspace.snapshot(user.id);
    const selected = new Set(parsed.data.ids);
    return { ok: true, generation: snapshot.generation, serverTime: now(), items: snapshot.items.filter((item) => item.kind === 'record' && selected.has(item.id) && item.deleted) };
  });
  return { isRetired: (id: string) => !!retired.get(id) };
}
