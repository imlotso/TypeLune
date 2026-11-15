import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { difficulties } from '../src/data/articles.js';
import type { AsyncDatabase } from './database/types.js';
import type { AdminActor, createAdminAudit } from './admin.js';

const timestamp = z.number().int().min(0).max(8_640_000_000_000_000);
const fields = {
  from: timestamp, to: timestamp, board: z.enum(['all', 'guest', 'user']),
  language: z.enum(['zh', 'en']).optional(), difficulty: z.enum(difficulties).optional(), q: z.string().trim().max(254).optional(),
};
const filterSchema = z.strictObject(fields).refine((value) => value.from < value.to);
const cleanupSchema = z.strictObject({ ...fields, count: z.number().int().min(1).max(5000), digest: z.string().regex(/^[a-f0-9]{64}$/u),
  reason: z.string().trim().min(1).max(500).regex(/^[^\p{Cc}\p{Cf}]+$/u),
  publicMessage: z.string().trim().max(500).regex(/^[^\p{Cc}\p{Cf}]*$/u).optional(),
}).refine((value) => value.from < value.to);
type Filter = z.output<typeof filterSchema>;
type Row = { id: string; owner: string; nickname: string; finishedAt: number; speed: number; accuracy: number; articleId: string | null };

export function registerLeaderboardAdministration(app: FastifyInstance, db: AsyncDatabase, audit: ReturnType<typeof createAdminAudit>) {
  const articleTitle = db.dialect === 'postgres' ? 'dazi_json_title(article_metadata)'
    : "CASE WHEN json_valid(article_metadata) THEN json_extract(article_metadata,'$.title') END";
  const where = `published=1 AND status='finished' AND ranking_removed=0 AND nickname IS NOT NULL AND speed IS NOT NULL
    AND finished_at>=@from AND finished_at<@to
    AND (@board='all' OR (@board='guest' AND owner LIKE 'g:%') OR (@board='user' AND owner LIKE 'u:%'))
    AND (@language IS NULL OR language=@language) AND (@difficulty IS NULL OR difficulty=@difficulty)
    AND (@q='' OR instr(lower(nickname),lower(@q))>0 OR id=@q OR article_id=@q OR instr(lower(${articleTitle}),lower(@q))>0)`;
  const select = db.prepare(`SELECT id,owner,nickname,finished_at AS finishedAt,speed,accuracy,article_id AS articleId FROM challenges WHERE ${where} ORDER BY id LIMIT 5001`);
  const values = (filter: Filter) => ({ from: filter.from, to: filter.to, board: filter.board, language: filter.language ?? null, difficulty: filter.difficulty ?? null, q: filter.q ?? '' });
  const snapshot = async (filter: Filter) => {
    const rows = await select.all(values(filter)) as Row[];
    if (rows.length > 5000) return undefined;
    return { count: rows.length, digest: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
  };
  const cleanup = db.transaction(async (actor: AdminActor, input: z.output<typeof cleanupSchema>) => {
    const current = await snapshot(input);
    if (!current) return { error: '匹配成绩过多，请缩小日期范围', status: 413 } as const;
    if (current.count !== input.count || current.digest !== input.digest) return { error: '筛选结果已变化，请重新预览', status: 409 } as const;
    const params = values(input);
    await db.prepare(`DELETE FROM scores WHERE attempt_id IN (SELECT id FROM challenges WHERE ${where})`).run(params);
    const updated = await db.prepare(`UPDATE challenges SET ranking_removed=1,public_review_message=@publicMessage WHERE ${where}`)
      .run({ ...params, publicMessage: input.publicMessage || null });
    if (updated.changes !== current.count) throw new Error('Leaderboard cleanup changed unexpectedly');
    await audit(actor, 'score.bulk_remove', 'score', `range:${input.from}:${input.to}:${input.board}`, `${current.count} 条成绩`,
      `${input.reason}（${input.from}–${input.to}，${input.board}）`);
    return { ok: true, count: current.count } as const;
  });

  app.post('/scores/cleanup/preview', async (request, reply) => {
    const parsed = filterSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: '请选择有效的日期范围' });
    const result = await snapshot(parsed.data);
    return result ?? reply.code(413).send({ error: '匹配成绩过多，请缩小日期范围' });
  });
  app.post('/scores/cleanup', async (request, reply) => {
    const parsed = cleanupSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: '清理条件或原因无效' });
    const result = await cleanup.immediate(request.admin, parsed.data);
    return 'error' in result ? reply.code(result.status ?? 400).send({ error: result.error }) : result;
  });
}
