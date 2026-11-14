import type { PracticeRecord } from './models';

export type PersonalComparison = { previousBest: number | null; personalBest: number; improvement: number | null;
  sampleCount: number; averageSpeed: number | null; speedDifference: number | null; averageAccuracy: number | null; accuracyDifference: number | null };
const round = (value: number) => Math.sign(value) * Math.round((Math.abs(value) + 1e-9) * 100) / 100;

export function matchingPracticeHistory(current: PracticeRecord, history: PracticeRecord[]): PracticeRecord[] {
  if (!current.recordId || !current.article) return [];
  const mode = current.mode ?? 'timed';
  const matching = history.filter((record) => record.recordId !== current.recordId && record.language === current.language && record.difficulty === current.difficulty &&
    (record.mode ?? 'timed') === mode && (mode === 'article' || record.duration === current.duration) && !!record.strict === !!current.strict &&
    (record.offset ?? 0) === (current.offset ?? 0) && record.article?.id === current.article?.id && record.article?.text === current.article?.text &&
    Number.isFinite(record.speed) && record.speed >= 0 && Number.isFinite(record.accuracy) && record.accuracy >= 0 && record.accuracy <= 100 && Number.isFinite(record.finishedAt));
  const unique = new Map<string, PracticeRecord>();
  for (const record of matching) {
    const id = record.recordId ?? `${record.finishedAt}:${record.language}:${record.duration}:${record.speed}:${record.accuracy}`;
    if (!unique.has(id)) unique.set(id, record);
  }
  return [...unique.values()].sort((a, b) => b.finishedAt - a.finishedAt || (b.recordId ?? '').localeCompare(a.recordId ?? ''));
}

export function comparePersonalBest(current: PracticeRecord, history: PracticeRecord[]): PersonalComparison | null {
  if (!current.recordId || !current.article || !Number.isFinite(current.speed) || !Number.isFinite(current.accuracy)) return null;
  const all = matchingPracticeHistory(current, history);
  const previousBest = all.length ? all.reduce((best, record) => Math.max(best, record.speed), 0) : null;
  const recent = all.slice(0, 10);
  const rawSpeed = recent.length ? recent.reduce((sum, record) => sum + record.speed, 0) / recent.length : null;
  const rawAccuracy = recent.length ? recent.reduce((sum, record) => sum + record.accuracy, 0) / recent.length : null;
  const averageSpeed = rawSpeed === null ? null : round(rawSpeed);
  const averageAccuracy = rawAccuracy === null ? null : round(rawAccuracy);
  return { previousBest, personalBest: Math.max(current.speed, previousBest ?? current.speed),
    improvement: previousBest !== null && current.speed > previousBest ? round(current.speed - previousBest) : null,
    sampleCount: recent.length, averageSpeed, speedDifference: rawSpeed === null ? null : round(current.speed - rawSpeed),
    averageAccuracy, accuracyDifference: rawAccuracy === null ? null : round(current.accuracy - rawAccuracy) };
}
