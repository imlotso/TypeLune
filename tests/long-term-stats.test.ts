import { describe, expect, it } from 'vitest';
import { groupComparableRecords, selectStatisticsRecords, statsDayKey, summarizeStatistics, type StatisticsFilters } from '../src/lib/long-term-stats';
import type { PracticeRecord } from '../src/lib/models';

const base: PracticeRecord = { recordId: 'one', language: 'zh', difficulty: 'beginner', duration: 300, mode: 'timed', strict: false,
  speed: 30, accuracy: 90, finishedAt: Date.parse('2026-11-14T16:00:00Z'), elapsedMs: 60_000,
  article: { id: 'a', title: '文章', text: '山海', language: 'zh', difficulty: 'beginner', custom: false } };
const all: StatisticsFilters = { language: 'zh' as const, article: '', mode: '' as const, duration: '', difficulty: '', strict: '' as const, range: 'all' as const, from: '', to: '' };
describe('long-term statistics', () => {
  it('uses an explicit time zone at the day boundary', () => {
    expect(statsDayKey(base.finishedAt, 'Asia/Shanghai')).toBe('2026-11-15');
    expect(statsDayKey(base.finishedAt, 'America/Los_Angeles')).toBe('2026-11-14');
  });
  it('combines filters and includes both custom date endpoints', () => {
    const records: PracticeRecord[] = [base, { ...base, recordId: 'different', duration: 600 }, { ...base, recordId: 'english', language: 'en' }, { ...base, recordId: 'strict', strict: true }];
    const filtered = selectStatisticsRecords(records, { ...all, range: 'custom', from: '2026-11-15', to: '2026-11-15', mode: 'timed', duration: '300', strict: 'no' }, 'Asia/Shanghai', Date.parse('2026-11-15T12:00:00Z'));
    expect(filtered.map((record) => record.recordId)).toEqual(['one']);
  });
  it('separates different modes, durations, strictness and article versions', () => {
    const records: PracticeRecord[] = [base, { ...base, recordId: 'two', speed: 50 }, { ...base, recordId: 'duration', duration: 600 },
      { ...base, recordId: 'strict', strict: true }, { ...base, recordId: 'article-mode', mode: 'article' },
      { ...base, recordId: 'revision', article: { ...base.article!, text: '山川' } }, { ...base, recordId: 'no-snapshot', article: undefined }];
    const groups = groupComparableRecords(records);
    expect(groups.map((group) => group.records.length).sort()).toEqual([1, 1, 1, 1, 1, 2]);
    expect(summarizeStatistics(groups.find((group) => group.records.length === 2)!.records)).toMatchObject({ sessions: 2, averageSpeed: 40, averageAccuracy: 90 });
  });
  it('does not turn missing valid time into a recorded zero', () => {
    const summary = summarizeStatistics([base, { ...base, recordId: 'missing', elapsedMs: undefined }, { ...base, recordId: 'zero', elapsedMs: 0 }]);
    expect(summary).toMatchObject({ sessions: 3, elapsedMs: 60_000, timedSessions: 2, missingElapsed: 1 });
  });
});
