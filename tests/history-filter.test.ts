import { describe, expect, it } from 'vitest';
import { filterPracticeRecords } from '../src/lib/history-filter';
import type { PracticeRecord } from '../src/lib/models';

const at = (day: number, hour = 12) => new Date(2026, 10, day, hour).getTime();
const article = { id: 'a', title: 'Cloud Garden', text: 'cloud', language: 'en' as const, difficulty: 'beginner' as const, custom: true };
const base: PracticeRecord = { recordId: 'a', language: 'en', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 95, finishedAt: at(15), article, mode: 'timed', strict: true };

describe('practice history filters', () => {
  it('combines article, inclusive local dates, language, mode, duration and strictness', () => {
    const records: PracticeRecord[] = [
      base,
      { ...base, recordId: 'old', finishedAt: at(14, 23) },
      { ...base, recordId: 'later', finishedAt: at(15, 23) },
      { ...base, recordId: 'language', language: 'zh' },
      { ...base, recordId: 'mode', mode: 'article' },
      { ...base, recordId: 'duration', duration: 600 },
      { ...base, recordId: 'strict', strict: false },
      { ...base, recordId: 'title', article: { ...article, title: 'Other' } },
    ];
    expect(filterPracticeRecords(records, { query: 'CLOUD', from: '2026-11-15', to: '2026-11-15', language: 'en', mode: 'timed', minutes: '5', strict: 'yes' }).map((r) => r.recordId)).toEqual(['later', 'a']);
    expect(records[0].recordId).toBe('a');
  });
  it('keeps older records with missing mode and strict fields usable', () => {
    const legacy = { ...base, recordId: 'legacy', mode: undefined, strict: undefined };
    expect(filterPracticeRecords([legacy], { query: '', from: '', to: '', language: '', mode: 'timed', minutes: '5', strict: 'no' })).toEqual([legacy]);
  });
});
