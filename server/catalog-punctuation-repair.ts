import { createHash } from 'node:crypto';
import { articles } from '../src/data/articles.js';
import type { AsyncDatabase } from './database/types.js';

// Exact original shipped prose, not an unrestricted punctuation normalizer.
export const punctuationRepairs = [
  { id: 'zh-intermediate-6', originalSha256: '5faee9b6e0412844a71fb2176f90e7607d354835bbe3c6bc95309804b35bcef7' },
  { id: 'zh-advanced-5', originalSha256: 'd76500e2042760522e6230eeda84081f590fd169e28f699fc6b6185de5a9579c' },
] as const;
const digest = (text: string) => createHash('sha256').update(text).digest('hex');

/** Explicit maintenance only. Existing attempts/snapshots and edited prose stay intact. */
export async function repairCatalogPunctuation(db: AsyncDatabase, now: () => number = Date.now) {
  const find = db.prepare('SELECT text,revision,status FROM public_articles WHERE id=?');
  const update = db.prepare(`UPDATE public_articles SET text=?,content_hash=?,revision=revision+1,updated_at=?
    WHERE id=? AND revision=? AND text=? AND status=?`);
  return db.transaction(async () => {
    const results: { id: string; status: 'updated' | 'already-correct' | 'skipped' }[] = [];
    for (const repair of punctuationRepairs) {
      const row = await find.get(repair.id) as { text: string; revision: number; status: string } | undefined;
      const corrected = articles.find((article) => article.id === repair.id)!.content;
      if (row?.text === corrected) { results.push({ id: repair.id, status: 'already-correct' }); continue; }
      if (!row || row.status === 'deleted' || digest(row.text) !== repair.originalSha256 || row.text.replaceAll('\u2500\u2500', '\u2014\u2014') !== corrected) {
        results.push({ id: repair.id, status: 'skipped' }); continue;
      }
      const hash = digest(corrected.normalize('NFC').trim().replace(/\s+/gu, ' '));
      const changed = await update.run(corrected, hash, now(), repair.id, row.revision, row.text, row.status);
      results.push({ id: repair.id, status: changed.changes === 1 ? 'updated' : 'skipped' });
    }
    return results;
  }).immediate();
}
