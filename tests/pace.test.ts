import { expect, it } from 'vitest';
import { calculatePace, selectPaceTarget } from '../src/lib/pace';
import type { PracticeRecord } from '../src/lib/models';

const article = { id: 'a', title: '短文', text: '山海相望', language: 'zh' as const, difficulty: 'beginner' as const, custom: false };
const current: PracticeRecord = { recordId: 'current', language: 'zh', difficulty: 'beginner', duration: 300, mode: 'timed', strict: false, speed: 0, accuracy: 0, finishedAt: 0, article };
it('calculates time ahead using Chinese characters per minute and English WPM', () => {
  expect(calculatePace(40, 30_000, 60, 'zh')).toMatchObject({ secondsAhead: 10 });
  expect(calculatePace(40, 30_000, 12, 'en')).toMatchObject({ secondsAhead: 10 });
  expect(calculatePace(10, 30_000, 60, 'zh')).toMatchObject({ secondsAhead: -20 });
  expect(calculatePace(10, 30_000, 0, 'zh')).toBeUndefined();
});

it('chooses the last or best score only from matching practice conditions', () => {
  const previous = { ...current, recordId: 'previous', speed: 40, accuracy: 90, finishedAt: 1000 };
  const recent = { ...previous, recordId: 'recent', speed: 30, finishedAt: 2000 };
  const other = { ...previous, recordId: 'other', speed: 100, article: { ...article, text: '另一版本' } };
  const base = { enabled: true, customSpeed: 55 };
  expect(selectPaceTarget(current, [previous, recent, other], { ...base, source: 'last' })).toBe(30);
  expect(selectPaceTarget(current, [previous, recent, other], { ...base, source: 'best' })).toBe(40);
  expect(selectPaceTarget(current, [], { ...base, source: 'custom' })).toBe(55);
  expect(selectPaceTarget(current, [], { ...base, enabled: false, source: 'custom' })).toBeUndefined();
});
