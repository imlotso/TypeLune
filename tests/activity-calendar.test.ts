import { describe, expect, it } from 'vitest';
import { activityByDay, activityStreaks, calendarMonthDays, shiftCalendarMonth } from '../src/lib/activity-calendar';
import type { PracticeRecord } from '../src/lib/models';

const record = (id: string, finishedAt: string, elapsedMs?: number): PracticeRecord => ({ recordId: id, language: 'zh', difficulty: 'beginner', duration: 300,
  speed: 30, accuracy: 90, finishedAt: Date.parse(finishedAt), ...(elapsedMs !== undefined && { elapsedMs }) });

describe('activity calendar', () => {
  it('assigns cross-midnight practice to its completion day in the selected time zone', () => {
    const records = [record('before', '2026-11-14T15:59:00Z', 60_000), record('after', '2026-11-14T16:01:00Z', 120_000), record('missing', '2026-11-14T16:05:00Z')];
    const days = activityByDay(records, 'Asia/Shanghai', Date.parse('2026-11-16T12:00:00Z'));
    expect(days.get('2026-11-14')).toMatchObject({ sessions: 1, elapsedMs: 60_000, missingElapsed: 0 });
    expect(days.get('2026-11-15')).toMatchObject({ sessions: 2, elapsedMs: 120_000, timedSessions: 1, missingElapsed: 1 });
    expect(activityByDay(records, 'America/Los_Angeles', Date.parse('2026-11-16T12:00:00Z')).get('2026-11-14')).toMatchObject({ sessions: 3, elapsedMs: 180_000, missingElapsed: 1 });
  });
  it('keeps calendar dates and streaks correct through a daylight-saving change', () => {
    const records = [record('before', '2026-03-08T04:59:00Z'), record('after', '2026-03-08T05:01:00Z'), record('jump', '2026-03-08T07:30:00Z')];
    const days = activityByDay(records, 'America/New_York', Date.parse('2026-03-09T12:00:00Z'));
    expect(days.get('2026-03-07')?.sessions).toBe(1);
    expect(days.get('2026-03-08')?.sessions).toBe(2);
    expect(activityStreaks(days, '2026-03-09')).toEqual({ current: 2, longest: 2 });
  });
  it('counts current streak through yesterday and calculates the longest visible streak', () => {
    const records = [record('a', '2026-11-12T16:00:00Z'), record('b', '2026-11-13T16:00:00Z'), record('c', '2026-11-14T16:00:00Z')];
    const days = activityByDay(records, 'Asia/Shanghai', Date.parse('2026-11-16T12:00:00Z'));
    expect(activityStreaks(days, '2026-11-16')).toEqual({ current: 3, longest: 3 });
    expect(activityStreaks(days, '2026-11-17')).toEqual({ current: 0, longest: 3 });
    expect(activityStreaks(new Map(), '2026-11-17')).toEqual({ current: 0, longest: 0 });
  });
  it('renders calendar days on a Monday-first grid across year boundaries', () => {
    const days = calendarMonthDays('2026-11');
    expect(days).toHaveLength(42);
    expect(days.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(days[6]).toBe('2026-11-01');
    expect(shiftCalendarMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftCalendarMonth('2026-12', 1)).toBe('2027-01');
  });
});
