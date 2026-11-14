import type { PracticeRecord } from './models';

function canonicalRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalRecord);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalRecord(entry)]));
}

// Keep the existing guest-import ID for old records without an explicit ID.
export function stableRecordId(value: PracticeRecord) {
  if (value.recordId) return value.recordId;
  const text = JSON.stringify(canonicalRecord(value));
  let first = 2166136261; let second = 2246822519;
  for (let index = 0; index < text.length; index++) { first = Math.imul(first ^ text.charCodeAt(index), 16777619); second = Math.imul(second ^ text.charCodeAt(index), 3266489917); }
  return `guest-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

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
