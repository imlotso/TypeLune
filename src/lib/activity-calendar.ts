import type { PracticeRecord } from './models';
import { addStatisticsDays, statsDayKey } from './long-term-stats';

export type ActivityDay = { date: string; sessions: number; elapsedMs: number; timedSessions: number; missingElapsed: number; records: PracticeRecord[] };
export function activityByDay(records: PracticeRecord[], timeZone: string, now = Date.now()) {
  const days = new Map<string, ActivityDay>();
  for (const record of records) {
    if (!Number.isFinite(record.finishedAt) || !Number.isFinite(new Date(record.finishedAt).getTime()) || record.finishedAt > now) continue;
    const date = statsDayKey(record.finishedAt, timeZone);
    const day = days.get(date) ?? { date, sessions: 0, elapsedMs: 0, timedSessions: 0, missingElapsed: 0, records: [] };
    day.sessions++; day.records.push(record);
    if (typeof record.elapsedMs === 'number' && Number.isFinite(record.elapsedMs) && record.elapsedMs >= 0) { day.elapsedMs += record.elapsedMs; day.timedSessions++; }
    else day.missingElapsed++;
    days.set(date, day);
  }
  return days;
}
export function activityStreaks(days: Map<string, ActivityDay>, today: string) {
  const active = [...days.keys()].filter((day) => day <= today).sort();
  let longest = 0; let sequence = 0; let previous = '';
  for (const day of active) {
    sequence = previous && addStatisticsDays(previous, 1) === day ? sequence + 1 : 1;
    longest = Math.max(longest, sequence); previous = day;
  }
  const set = new Set(active);
  let current = 0;
  let end = set.has(today) ? today : addStatisticsDays(today, -1);
  while (set.has(end)) { current++; end = addStatisticsDays(end, -1); }
  return { current, longest };
}
export function shiftCalendarMonth(month: string, amount: number) {
  const [year, value] = month.split('-').map(Number);
  return new Date(Date.UTC(year, value - 1 + amount, 1)).toISOString().slice(0, 7);
}
export function calendarMonthDays(month: string) {
  const [year, value] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, value - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return Array.from({ length: 42 }, (_, index) => {
    const date = index - lead + 1;
    return date < 1 || date > count ? null : `${month}-${String(date).padStart(2, '0')}`;
  });
}
