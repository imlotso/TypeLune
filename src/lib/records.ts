import type { PracticeRecord } from './models';

export function mergePracticeRecords(local: PracticeRecord[], remote: PracticeRecord[], workspace: PracticeRecord[]) {
  const keyOf = (record: PracticeRecord) => record.recordId || `${record.finishedAt}:${record.language}:${record.difficulty}:${record.speed}:${record.accuracy}`;
  const onlineRecords = new Set(remote.map(keyOf));
  const entries = new Map<string, PracticeRecord>();
  // Official results are applied last so a synced local snapshot cannot replace
  // the server's verified speed and accuracy for the same attempt.
  for (const record of [...local, ...workspace, ...remote]) {
    const key = keyOf(record); const previous = entries.get(key);
    if (!previous) { entries.set(key, record); continue; }
    const rich = [record, previous].find((entry) => entry.article && entry.typed != null);
    const mistakes = [record, previous].find((entry) => entry.mistakes?.length)?.mistakes;
    entries.set(key, { ...previous, ...record, ...(rich && { article: rich.article, typed: rich.typed, offset: rich.offset, articleTotal: rich.articleTotal }), ...(mistakes && { mistakes }) });
  }
  return [...entries].map(([key, record]) => onlineRecords.has(key) ? { ...record, localOnly: false } : record).sort((a, b) => b.finishedAt - a.finishedAt);
}
