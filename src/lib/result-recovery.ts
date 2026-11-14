import type { PracticeDraft } from '../hooks/usePractice';
import { scoreTyping, splitCharacters } from './scoring';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const recoveryKey = /^[A-Za-z0-9_-]{43}$/;
export type ResultRecoveryAvailability = { available: true } | { available: false; reason: string };
export function resultRecoveryAvailability(draft: PracticeDraft, ownerId: string | null, currentLease: string, now = Date.now()): ResultRecoveryAvailability {
  if ((draft.ownerId ?? null) !== ownerId) return { available: false, reason: '恢复资料属于其他账号' };
  if (!draft.completed) return { available: false, reason: '练习尚未完成' };
  if (draft.custom || draft.personalOnly || (draft.offset ?? 0) > 0) return { available: false, reason: '个人练习不参与排行' };
  if (!Number.isFinite(draft.elapsedMs) || draft.elapsedMs < 1000) return { available: false, reason: '有效用时不足 1 秒' };
  const score = scoreTyping(draft.target, draft.typed, draft.elapsedMs / 1000);
  if (score.correct === 0) return { available: false, reason: '没有正确输入' };
  if (draft.mode === 'article' && (score.total !== splitCharacters(draft.target).length || (draft.strict && score.correct !== score.total))) return { available: false, reason: '整篇尚未完成' };
  if (![draft.recoveryId, draft.id, draft.recordId].some((value) => typeof value === 'string' && uuid.test(value)) ||
    (draft.recoveryKey !== undefined && !recoveryKey.test(draft.recoveryKey))) return { available: false, reason: '恢复资料不完整' };
  if (draft.leaseOwner && draft.leaseOwner !== currentLease && typeof draft.leaseAt === 'number' && now - draft.leaseAt < 15_000) return { available: false, reason: '进度正在其他页面使用' };
  return { available: true };
}
export function recoveryMatchesRecord(draft: PracticeDraft, recordId: string | undefined) {
  return !!recordId && [draft.recordId, draft.id, draft.recoveryId].includes(recordId);
}

export function recordMatchesSavedRecovery(record: import('./models').PracticeRecord, saved: import('./models').SavedPractice) {
  const article = record.article; const source = saved.article;
  if (!article || !record.recordId || ![saved.recordId, saved.attemptId, saved.recoveryId].includes(record.recordId) ||
    typeof record.typed !== 'string' || typeof record.elapsedMs !== 'number' || typeof record.backspaces !== 'number') return false;
  const scored = scoreTyping(source.text, saved.typed, Math.max(saved.elapsedMs / 1000, 0.1));
  return record.language === source.language && record.difficulty === source.difficulty &&
    (record.total === undefined || record.total === scored.total) && (record.correct === undefined || record.correct === scored.correct) &&
    record.typed === saved.typed && Math.round(record.elapsedMs) === Math.round(saved.elapsedMs) && record.backspaces === saved.backspaces &&
    record.duration === saved.duration && (record.mode ?? 'timed') === saved.mode && !!record.strict === saved.strict && (record.offset ?? 0) === saved.offset &&
    article.id === source.id && article.title === source.title && article.text === source.text && article.language === source.language &&
    article.difficulty === source.difficulty && article.custom === source.custom && article.author === source.author && article.theme === source.theme &&
    article.source?.name === source.source?.name && article.source?.url === source.source?.url && article.source?.license === source.source?.license;
}
