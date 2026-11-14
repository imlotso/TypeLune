import type { Difficulty, Language } from '../data/articles';
import { snapshotKey, type PracticeMode, type PracticeRecord } from './models';
import { stableRecordId } from './records';

export type StatisticsRange = '7' | '30' | '90' | '365' | 'all' | 'custom';
export type StatisticsFilters = { language: Language; article: string; mode: PracticeMode | ''; duration: string; difficulty: Difficulty | '';
  strict: '' | 'yes' | 'no'; range: StatisticsRange; from: string; to: string };
export type StatisticsGroup = { key: string; language: Language; difficulty: Difficulty; mode: PracticeMode; duration: number; strict: boolean;
  articleId?: string; articleTitle?: string; articleText?: string; version?: string; offset: number; records: PracticeRecord[] };
const formatters = new Map<string, Intl.DateTimeFormat>();
export function browserStatisticsTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}
export function isStatisticsTimeZone(value: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0); return true; } catch { return false; }
}
export function statsDayKey(timestamp: number, timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    if (formatters.size >= 20) formatters.clear();
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function addStatisticsDays(day: string, amount: number) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + amount)).toISOString().slice(0, 10);
}
export function selectStatisticsRecords(records: PracticeRecord[], filters: StatisticsFilters, timeZone: string, now = Date.now()) {
  const today = statsDayKey(now, timeZone);
  const from = filters.range === 'custom' ? filters.from : filters.range === 'all' ? '' : addStatisticsDays(today, 1 - Number(filters.range));
  const to = filters.range === 'custom' ? filters.to : today;
  return records.filter((record) => {
    if (!Number.isFinite(record.finishedAt) || !Number.isFinite(new Date(record.finishedAt).getTime())) return false;
    const day = statsDayKey(record.finishedAt, timeZone);
    const article = record.article ? `id:${record.article.id}` : 'missing';
    return record.finishedAt <= now && record.language === filters.language && (!from || day >= from) && (!to || day <= to) &&
      (!filters.article || article === filters.article) && (!filters.mode || (record.mode ?? 'timed') === filters.mode) &&
      (!filters.duration || ((record.mode ?? 'timed') === 'timed' && record.duration === Number(filters.duration))) && (!filters.difficulty || record.difficulty === filters.difficulty) &&
      (!filters.strict || !!record.strict === (filters.strict === 'yes'));
  }).sort((a, b) => a.finishedAt - b.finishedAt || (a.recordId ?? '').localeCompare(b.recordId ?? ''));
}
export function groupComparableRecords(records: PracticeRecord[]) {
  const buckets = new Map<string, StatisticsGroup[]>();
  for (const record of records) {
    const mode = record.mode ?? 'timed';
    const base = JSON.stringify([record.language, record.difficulty, mode, mode === 'timed' ? record.duration : null, !!record.strict,
      record.article?.id ?? `missing:${stableRecordId(record)}`, record.offset ?? 0]);
    const bucket = buckets.get(base) ?? [];
    let group = bucket.find((item) => item.articleText === record.article?.text);
    if (!group) {
      group = { key: `${base}:${bucket.length}`, language: record.language, difficulty: record.difficulty, mode, duration: record.duration, strict: !!record.strict,
        articleId: record.article?.id, articleTitle: record.article?.title, articleText: record.article?.text, version: record.article ? `${snapshotKey(record.article).split(':').at(-1)}${bucket.length ? `-${bucket.length + 1}` : ''}` : undefined, offset: record.offset ?? 0, records: [] };
      bucket.push(group); buckets.set(base, bucket);
    }
    group.records.push(record);
  }
  return [...buckets.values()].flat().sort((a, b) => (b.records.at(-1)?.finishedAt ?? 0) - (a.records.at(-1)?.finishedAt ?? 0));
}
const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100 : null;
export function summarizeStatistics(records: PracticeRecord[]) {
  const validTimes = records.map((record) => record.elapsedMs).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  const speeds = records.map((record) => record.speed).filter((value) => Number.isFinite(value) && value >= 0);
  const accuracies = records.map((record) => record.accuracy).filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
  return { sessions: records.length, timedSessions: validTimes.length, missingElapsed: records.length - validTimes.length,
    elapsedMs: validTimes.reduce((sum, value) => sum + value, 0), bestSpeed: speeds.length ? speeds.reduce((best, speed) => Math.max(best, speed), 0) : null,
    averageSpeed: average(speeds), averageAccuracy: average(accuracies) };
}
