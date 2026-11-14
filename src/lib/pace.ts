import type { Language } from '../data/articles';
import type { PaceSettings, PracticeRecord } from './models';
import { matchingPracticeHistory } from './personal-best';

export function isPaceSettings(value: unknown): value is PaceSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const pace = value as Record<string, unknown>;
  return Object.keys(pace).every((key) => ['enabled', 'source', 'customSpeed'].includes(key)) && typeof pace.enabled === 'boolean' &&
    ['custom', 'last', 'best'].includes(pace.source as string) && typeof pace.customSpeed === 'number' && Number.isFinite(pace.customSpeed) && pace.customSpeed >= 1 && pace.customSpeed <= 1000;
}
export function selectPaceTarget(current: PracticeRecord, history: PracticeRecord[], settings: PaceSettings): number | undefined {
  if (!settings.enabled || !isPaceSettings(settings)) return undefined;
  if (settings.source === 'custom') return settings.customSpeed;
  const matches = matchingPracticeHistory(current, history);
  const speed = settings.source === 'last' ? matches[0]?.speed : matches.reduce<number | undefined>((best, record) => best === undefined ? record.speed : Math.max(best, record.speed), undefined);
  return speed !== undefined && Number.isFinite(speed) && speed > 0 && speed <= 18_000_000 ? speed : undefined;
}
export function calculatePace(correct: number, elapsedMs: number, target: number, language: Language) {
  if (!Number.isFinite(correct) || correct < 0 || !Number.isFinite(elapsedMs) || elapsedMs < 0 || !Number.isFinite(target) || target <= 0 || target > 18_000_000) return undefined;
  const charactersPerMinute = target * (language === 'en' ? 5 : 1);
  const seconds = correct * 60 / charactersPerMinute - elapsedMs / 1000;
  return { secondsAhead: Math.round(seconds * 10) / 10 };
}
