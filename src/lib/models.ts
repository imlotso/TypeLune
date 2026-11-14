import type { ArticleSource, Difficulty, Language } from '../data/articles';
import type { BackgroundConfig } from './background';
import type { ServerScoreStatus } from './score-status';
import type { ProcessTrace } from './process-trace';

export type PracticeMode = 'timed' | 'article';
export type MistakeStatus = 'mastered' | 'ignored';
export type PaceSettings = { enabled: boolean; source: 'custom' | 'last' | 'best'; customSpeed: number };
export const defaultPace: PaceSettings = { enabled: false, source: 'custom', customSpeed: 60 };
export type PresetReading = { fontSize: number; lineHeight: number; visibleLines: number; showTimer: boolean; showSpeed: boolean; showAccuracy: boolean };
export type PracticePreset = { id: string; name: string; language: Language; difficulty: Difficulty; mode: PracticeMode; minutes: number; strict: boolean; autoPause: boolean; pace?: PaceSettings; reading?: PresetReading };
export type ReaderSettings = {
  minutes: number;
  mode: PracticeMode;
  strict: boolean;
  autoPause: boolean;
  fontSize: number;
  lineHeight: number;
  visibleLines: number;
  theme: 'light' | 'dark';
  mistakeStates?: Record<string, MistakeStatus>;
  showTimer?: boolean;
  showSpeed?: boolean;
  showAccuracy?: boolean;
  presets?: PracticePreset[];
  pace?: PaceSettings;
  shortcutsEnabled?: boolean;
  statisticsTimezone?: string;
  dailyGoalMinutes?: number;
};
export const defaultSettings: ReaderSettings = { minutes: 5, mode: 'timed', strict: false, autoPause: true, fontSize: 18, lineHeight: 1.6, visibleLines: 4, theme: 'light', showTimer: true, showSpeed: true, showAccuracy: true, shortcutsEnabled: true };
export type ArticleSnapshot = { id: string; title: string; text: string; language: Language; difficulty: Difficulty; custom: boolean; author?: string; theme?: string; source?: ArticleSource };
export type PrivateArticle = ArticleSnapshot & { custom: true };
export type MistakeSample = { position: number; expected: string; actual: string };
export type PracticeRecord = {
  language: Language; difficulty: Difficulty; duration: number; speed: number; accuracy: number; finishedAt: number;
  status?: string; scoreStatus?: ServerScoreStatus; elapsedMs?: number; backspaces?: number; errors?: number; recordId?: string; ownerId?: string | null; localOnly?: boolean;
  article?: ArticleSnapshot; typed?: string; offset?: number; total?: number; correct?: number; articleTotal?: number;
  mode?: PracticeMode; strict?: boolean; mistakes?: MistakeSample[]; mistakesTruncated?: boolean; paceTarget?: number; processTrace?: ProcessTrace;
  // Read-time compatibility metadata; never treated as a verified score.
  legacyLocalIds?: string[]; legacyWorkspaceId?: boolean; legacyIdConflict?: boolean;
};
export type SavedPractice = {
  id: string; article: ArticleSnapshot; typed: string; elapsedMs: number; backspaces: number;
  duration: number; mode: PracticeMode; strict: boolean; offset: number; recordId: string;
  attemptId?: string; recoveryId?: string; recoveryKey?: string; claimId?: string; claimVersion?: number; recoveryRequestId?: string; recoveryMarker?: string; recoveryBaseVersion?: number; progressVersion?: number; personalOnly?: boolean; offline: boolean; ownerId: string | null; savedAt: number; mistakes?: MistakeSample[]; mistakesTruncated?: boolean; paceTarget?: number; suspicious?: boolean; processTrace?: ProcessTrace; processErrorEvents?: number;
};
export function compareDraftProgress(a: SavedPractice, b: SavedPractice) {
  const claim = (a.claimVersion ?? 0) - (b.claimVersion ?? 0);
  if (claim) return claim;
  const aStale = staleDraftBase(a, b);
  const bStale = staleDraftBase(b, a);
  if (aStale || bStale) return aStale === bStale ? 0 : aStale ? -1 : 1;
  if (a.progressVersion !== undefined && b.progressVersion !== undefined) {
    return a.progressVersion - b.progressVersion;
  }
  return a.savedAt - b.savedAt;
}
export function sameDraftSnapshot(a: SavedPractice, b: SavedPractice) {
  return a.typed === b.typed && a.elapsedMs === b.elapsedMs && a.backspaces === b.backspaces && a.offset === b.offset &&
    a.recoveryId === b.recoveryId && a.recoveryKey === b.recoveryKey && a.claimId === b.claimId &&
    a.claimVersion === b.claimVersion && a.recoveryRequestId === b.recoveryRequestId && a.recoveryMarker === b.recoveryMarker &&
    a.recoveryBaseVersion === b.recoveryBaseVersion && !!a.personalOnly === !!b.personalOnly && !!a.mistakesTruncated === !!b.mistakesTruncated && a.paceTarget === b.paceTarget &&
    a.processErrorEvents === b.processErrorEvents && JSON.stringify(a.processTrace) === JSON.stringify(b.processTrace);
}
// A failed recovery request can change its marker without changing the
// completed input. Treat only identical progress and claim versions as equal.
export function sameCompletedDraftProgress(a: SavedPractice, b: SavedPractice) {
  const x = a.article; const y = b.article;
  return a.id === b.id && a.recordId === b.recordId && a.ownerId === b.ownerId && a.duration === b.duration && a.mode === b.mode && a.strict === b.strict &&
    a.attemptId === b.attemptId && a.offline === b.offline && a.progressVersion === b.progressVersion && a.claimVersion === b.claimVersion &&
    !!a.suspicious === !!b.suspicious && JSON.stringify(a.mistakes ?? []) === JSON.stringify(b.mistakes ?? []) &&
    x.id === y.id && x.title === y.title && x.text === y.text && x.language === y.language && x.difficulty === y.difficulty && x.custom === y.custom &&
    x.author === y.author && x.theme === y.theme && x.source?.name === y.source?.name && x.source?.url === y.source?.url && x.source?.license === y.source?.license &&
    sameDraftSnapshot({ ...a, recoveryMarker: undefined, recoveryBaseVersion: undefined, claimId: undefined, recoveryRequestId: undefined },
      { ...b, recoveryMarker: undefined, recoveryBaseVersion: undefined, claimId: undefined, recoveryRequestId: undefined });
}
export function staleDraftBase(incoming: SavedPractice, previous: SavedPractice) {
  return (incoming.claimVersion ?? 0) === (previous.claimVersion ?? 0) && !!incoming.recoveryMarker &&
    incoming.recoveryMarker !== previous.recoveryMarker && previous.progressVersion !== undefined &&
    (incoming.recoveryBaseVersion ?? 0) < previous.progressVersion;
}
export type WorkspaceValues = {
  favorite: { articleId: string };
  article: PrivateArticle;
  draft: SavedPractice;
  record: PracticeRecord;
  settings: ReaderSettings;
  background: BackgroundConfig;
};
export type WorkspaceKind = keyof WorkspaceValues;
export type WorkspaceItem = { kind: WorkspaceKind; id: string; updatedAt: number; deleted?: boolean; value?: unknown;
  serverRevision?: number; baseRevision?: number; baseUpdatedAt?: number; clientGeneration?: number; localFallback?: boolean };
export type SyncState = 'guest' | 'loading' | 'syncing' | 'synced' | 'error';
export type MistakeEntry = { id: string; language: Language; expected: string; actual: string[]; count: number; lastSeen: number; contexts: string[] };
export type RankingEntry = { nickname: string; speed: number; accuracy: number; guest: number; createdAt: number; attemptId: string; rank?: number; mine?: boolean; articleId?: string; mode?: PracticeMode; strict?: boolean };

export function snapshotKey(article: ArticleSnapshot) {
  let hash = 2166136261;
  for (let i = 0; i < article.text.length; i++) hash = Math.imul(hash ^ article.text.charCodeAt(i), 16777619);
  return `${article.id}:${(hash >>> 0).toString(16)}`;
}

// A catalog edit should not silently replace the selected text or its attribution.
export function catalogSnapshotKey(article: ArticleSnapshot) {
  return JSON.stringify([snapshotKey(article), article.title, article.language, article.difficulty, article.author,
    article.theme, article.source?.name, article.source?.url, article.source?.license]);
}
