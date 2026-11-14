import type Database from 'better-sqlite3';
import { splitCharacters } from '../src/lib/scoring';
import type { ServerScoreStatus } from '../src/lib/score-status';

type ScoreSnapshot = { id: string; owner: string; language: string; difficulty: string; duration: number; mode: string; strict: number;
  status: string; published: number; ranking_removed: number; finished_at: number | null; publish_recovered_at: number | null;
  correct: number | null; total: number | null; target: string; public_review_message: string | null };

export function createScoreStatus(db: Database.Database, now: () => number) {
  db.exec(`CREATE INDEX IF NOT EXISTS challenges_owner_rankable
    ON challenges(owner,language,difficulty,mode,strict,duration,speed DESC,accuracy DESC,finished_at,id)
    WHERE published=1 AND status='finished' AND ranking_removed=0`);
  const lookup = db.prepare(`SELECT id,owner,language,difficulty,duration,mode,strict,status,published,ranking_removed,finished_at,publish_recovered_at,correct,total,target,public_review_message
    FROM challenges WHERE id=? AND owner=?`);
  const best = db.prepare(`SELECT id FROM challenges WHERE owner=@owner AND language=@language AND difficulty=@difficulty
    AND mode=@mode AND strict=@strict AND (@duration IS NULL OR duration=@duration) AND published=1 AND status='finished'
    AND ranking_removed=0 AND nickname IS NOT NULL AND speed IS NOT NULL ORDER BY speed DESC,accuracy DESC,finished_at,id LIMIT 1`);
  function statusOf(row: ScoreSnapshot): ServerScoreStatus {
    const eligible = (row.correct ?? 0) > 0 && (row.mode !== 'article' || (row.total === splitCharacters(row.target).length && (!row.strict || row.correct === row.total)));
    if (row.status === 'rejected') return { state: 'rejected', eligible: false, message: row.public_review_message || '管理员复核未通过。' };
    if (row.ranking_removed) return { state: 'removed', eligible: false, message: row.public_review_message || '管理员已下架该成绩。' };
    if (!row.published && !eligible) return { state: 'ineligible', eligible: false, message: '不符合排行条件' };
    if (!row.published) {
      const since = Math.max(row.finished_at ?? 0, row.publish_recovered_at ?? 0);
      return { state: 'not_submitted', eligible, expired: !since || now() - since > 10 * 60_000 };
    }
    if (row.status === 'review') return { state: 'pending', eligible: true };
    if (row.status !== 'finished') return { state: 'unavailable', eligible: false, message: '成绩状态暂不可用' };
    const selected = best.get({ owner: row.owner, language: row.language, difficulty: row.difficulty, mode: row.mode, strict: row.strict,
      duration: row.mode === 'timed' ? row.duration : null }) as { id: string } | undefined;
    if (!selected) return { state: 'unavailable', eligible: false, message: '成绩状态暂不可用' };
    return selected.id === row.id ? { state: 'ranked', eligible: true } : { state: 'published', eligible: true, message: '榜单显示同条件最高成绩' };
  }
  return (id: string, owner: string) => {
    const row = lookup.get(id, owner) as ScoreSnapshot | undefined;
    return row && row.finished_at !== null ? statusOf(row) : undefined;
  };
}
