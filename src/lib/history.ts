import { api } from './api';
import type { PracticeRecord } from './models';

function isHistoryRecord(value: unknown): value is PracticeRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.recordId !== 'string' || !record.recordId || record.recordId.length > 200 ||
    !['zh', 'en'].includes(record.language as string) || !['beginner', 'intermediate', 'advanced'].includes(record.difficulty as string) ||
    typeof record.duration !== 'number' || !Number.isFinite(record.duration) || record.duration <= 0 ||
    typeof record.speed !== 'number' || !Number.isFinite(record.speed) || record.speed < 0 ||
    typeof record.accuracy !== 'number' || !Number.isFinite(record.accuracy) || record.accuracy < 0 || record.accuracy > 100 ||
    typeof record.finishedAt !== 'number' || !Number.isSafeInteger(record.finishedAt) || record.finishedAt < 0 || record.finishedAt > 8_640_000_000_000_000 ||
    (record.typed !== undefined && typeof record.typed !== 'string')) return false;
  if (record.article !== undefined) {
    if (!record.article || typeof record.article !== 'object' || Array.isArray(record.article)) return false;
    const article = record.article as Record<string, unknown>;
    if (typeof article.id !== 'string' || typeof article.title !== 'string' || typeof article.text !== 'string' ||
      !['zh', 'en'].includes(article.language as string) || !['beginner', 'intermediate', 'advanced'].includes(article.difficulty as string) || typeof article.custom !== 'boolean') return false;
  }
  return true;
}

export async function readPagedHistory(ownerId: string, options?: { signal?: AbortSignal; onPage?: (entries: PracticeRecord[]) => void }) {
  const entries: PracticeRecord[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ limit: '100', ...(cursor && { cursor }) });
    const page = await api<{ entries: PracticeRecord[]; nextCursor?: string | null }>(`/api/history?${query}`, {
      headers: { 'X-Workspace-Owner': ownerId }, timeoutMs: 60_000, signal: options?.signal,
    });
    if (!Array.isArray(page.entries) || !page.entries.every(isHistoryRecord)) throw new Error('历史数据无法读取');
    entries.push(...page.entries);
    options?.onPage?.(page.entries);
    if (!('nextCursor' in page)) throw new Error('服务端历史未提供完整分页');
    const next = page.nextCursor ?? undefined;
    if (next !== undefined && (typeof next !== 'string' || !next || seen.has(next) || !page.entries.length)) throw new Error('历史分页无法继续');
    if (next) seen.add(next);
    cursor = next;
  } while (cursor);
  return entries;
}
