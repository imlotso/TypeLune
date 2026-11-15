import { expect, it } from 'vitest';
import { comparePersonalBest } from '../src/lib/personal-best';
import { mergePracticeRecords } from '../src/lib/records';
import type { PracticeRecord } from '../src/lib/models';

const article = { id: 'article', title: '原文', text: '山海相望', language: 'zh' as const, difficulty: 'beginner' as const, custom: false };
const current: PracticeRecord = { recordId: 'current', language: 'zh', difficulty: 'beginner', duration: 300, mode: 'timed', strict: false,
  speed: 75, accuracy: 96, finishedAt: 5000, article, offset: 0 };
const record = (id: string, speed: number, accuracy: number, time: number): PracticeRecord => ({ ...current, recordId: id, speed, accuracy, finishedAt: time });

it('excludes the current round and duplicates before comparing the matching history', () => {
  const old = record('old', 50, 90, 1000);
  const recent = record('recent', 60, 94, 2000);
  const result = comparePersonalBest(current, [current, old, recent, { ...recent }]);
  expect(result).toMatchObject({ previousBest: 60, personalBest: 75, improvement: 15, sampleCount: 2, averageSpeed: 55, speedDifference: 20, averageAccuracy: 92, accuracyDifference: 4 });
});

it('separates language, timing, difficulty, strictness, source version and continuation offset', () => {
  const other = record('other', 200, 99, 1000);
  const records: PracticeRecord[] = [
    { ...other, recordId: 'language', language: 'en' }, { ...other, recordId: 'mode', mode: 'article' },
    { ...other, recordId: 'duration', duration: 60 }, { ...other, recordId: 'difficulty', difficulty: 'advanced' },
    { ...other, recordId: 'strict', strict: true }, { ...other, recordId: 'article', article: { ...article, id: 'another' } },
    { ...other, recordId: 'version', article: { ...article, text: '山海依旧' } }, { ...other, recordId: 'offset', offset: 2 },
  ];
  expect(comparePersonalBest(current, records)).toMatchObject({ previousBest: null, personalBest: 75, improvement: null, sampleCount: 0 });
});

it('treats legacy timed defaults consistently and compares whole-article rounds independently of a timed duration setting', () => {
  const legacy = { ...record('legacy', 80, 99, 1000), mode: undefined, strict: undefined, offset: undefined };
  expect(comparePersonalBest(current, [legacy])).toMatchObject({ previousBest: 80, personalBest: 80, improvement: null });
  const whole = { ...current, mode: 'article' as const };
  const prior = { ...legacy, mode: 'article' as const, duration: 60 };
  expect(comparePersonalBest(whole, [prior])).toMatchObject({ previousBest: 80, personalBest: 80 });
});

it('uses the server score for a duplicate ID while retaining a local snapshot when the server has none', () => {
  const local = { ...record('same', 200, 100, 1000), typed: '山', localOnly: true };
  const remote = { ...local, speed: 60, accuracy: 90, article: undefined, typed: undefined, status: 'review', localOnly: undefined };
  expect(mergePracticeRecords([local], [remote], [local])).toMatchObject([{ recordId: 'same', speed: 60, accuracy: 90, article, typed: '山', localOnly: false, status: 'review' }]);
});

it('uses every matching record for the best and only the ten most recent for the average', () => {
  const history = Array.from({ length: 12 }, (_, index) => record(`r${index}`, index === 0 ? 90 : index, 80 + index, 1000 + index));
  expect(comparePersonalBest(current, history)).toMatchObject({ previousBest: 90, personalBest: 90, sampleCount: 10, averageSpeed: 6.5, averageAccuracy: 86.5 });
});

it('calculates the difference from the unrounded mean', () => {
  const result = comparePersonalBest({ ...current, speed: 10.07 }, [record('one', 10.01, 90, 1000), record('two', 10.02, 90, 2000)]);
  expect(result).toMatchObject({ averageSpeed: 10.02, speedDifference: 0.06 });
});
