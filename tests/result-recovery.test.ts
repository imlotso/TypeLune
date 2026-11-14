import { expect, it } from 'vitest';
import { resultRecoveryAvailability } from '../src/lib/result-recovery';
import type { PracticeDraft } from '../src/hooks/usePractice';

const id = 'c1a94db1-4669-4f9d-bb1a-89b2646ea548';
const draft: PracticeDraft = { version: 1, articleId: 'zh-beginner-1', title: '文章', text: '山海', target: '山海', typed: '山',
  language: 'zh', difficulty: 'beginner', duration: 300, custom: false, ownerId: 'user', recordId: id, revision: 1,
  elapsedMs: 1500, offline: true, suspicious: false, backspaces: 0, completed: true, recoveryId: id, recoveryKey: 'a'.repeat(43) };

it('requires the original completed practice data and correct owner', () => {
  expect(resultRecoveryAvailability(draft, 'user', 'current', 1000)).toEqual({ available: true });
  expect(resultRecoveryAvailability(draft, 'other', 'current', 1000)).toMatchObject({ available: false });
  expect(resultRecoveryAvailability({ ...draft, personalOnly: true }, 'user', 'current', 1000)).toMatchObject({ available: false });
  expect(resultRecoveryAvailability({ ...draft, elapsedMs: 500 }, 'user', 'current', 1000)).toMatchObject({ available: false });
  expect(resultRecoveryAvailability({ ...draft, typed: '错' }, 'user', 'current', 1000)).toMatchObject({ available: false, reason: '没有正确输入' });
  expect(resultRecoveryAvailability({ ...draft, mode: 'article' }, 'user', 'current', 1000)).toMatchObject({ available: false, reason: '整篇尚未完成' });
  expect(resultRecoveryAvailability({ ...draft, recoveryId: undefined, recordId: 'not-a-uuid' }, 'user', 'current', 1000)).toMatchObject({ available: false });
  expect(resultRecoveryAvailability({ ...draft, recoveryKey: 'bad' }, 'user', 'current', 1000)).toMatchObject({ available: false });
});
it('does not take a completed round currently leased by a different tab', () => {
  const leased = { ...draft, leaseOwner: 'other', leaseAt: 1000 };
  expect(resultRecoveryAvailability(leased, 'user', 'current', 2000)).toMatchObject({ available: false, reason: '进度正在其他页面使用' });
  expect(resultRecoveryAvailability(leased, 'user', 'current', 17_000)).toEqual({ available: true });
  expect(resultRecoveryAvailability(leased, 'user', 'other', 2000)).toEqual({ available: true });
});

it('accepts identical completed progress when only recovery request metadata differs', async () => {
  const { sameCompletedDraftProgress } = await import('../src/lib/models');
  const saved = { id: 'draft', recordId: id, article: { id: 'a', title: '文章', text: '山海', language: 'zh' as const, difficulty: 'beginner' as const, custom: false },
    typed: '山', elapsedMs: 1500, backspaces: 0, duration: 300, mode: 'timed' as const, strict: false, offset: 0,
    offline: true, ownerId: 'user', savedAt: 1000, progressVersion: 5, claimVersion: 1, recoveryId: id, recoveryKey: 'a'.repeat(43) };
  const retry = { ...saved, recoveryMarker: id, recoveryBaseVersion: 4 };
  expect(sameCompletedDraftProgress(saved, retry)).toBe(true);
  expect(sameCompletedDraftProgress(saved, { ...retry, typed: '海' })).toBe(false);
  expect(sameCompletedDraftProgress(saved, { ...retry, claimVersion: 2 })).toBe(false);
  expect(sameCompletedDraftProgress(saved, { ...retry, progressVersion: 6 })).toBe(false);
});

it('matches synchronized recovery data by the actual input and snapshot rather than speed alone', async () => {
  const { recordMatchesSavedRecovery } = await import('../src/lib/result-recovery');
  const article = { id: 'a', title: '文章', text: '山海', language: 'zh' as const, difficulty: 'beginner' as const, custom: false };
  const saved = { id: `draft-${id}`, recordId: id, article, typed: '山', elapsedMs: 1500, backspaces: 0, duration: 300,
    mode: 'timed' as const, strict: false, offset: 0, offline: true, ownerId: 'user', savedAt: 1000, recoveryId: id, recoveryKey: 'a'.repeat(43) };
  const record = { recordId: id, article, typed: '山', elapsedMs: 1500, backspaces: 0, duration: 300, mode: 'timed' as const, strict: false, offset: 0,
    language: 'zh' as const, difficulty: 'beginner' as const, speed: 40, accuracy: 100, finishedAt: 1000 };
  expect(recordMatchesSavedRecovery(record, saved)).toBe(true);
  expect(recordMatchesSavedRecovery({ ...record, typed: '海' }, saved)).toBe(false);
  expect(recordMatchesSavedRecovery({ ...record, correct: 2 }, saved)).toBe(false);
  expect(recordMatchesSavedRecovery({ ...record, elapsedMs: 1600 }, saved)).toBe(false);
  expect(recordMatchesSavedRecovery({ ...record, article: { ...article, text: '山川' } }, saved)).toBe(false);
  expect(recordMatchesSavedRecovery({ ...record, typed: undefined }, saved)).toBe(false);
});
