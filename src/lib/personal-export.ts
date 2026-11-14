import type { User } from './api';
import { compareDraftProgress, type ArticleSnapshot, type MistakeSample, type PracticeRecord, type ReaderSettings, type SavedPractice, type WorkspaceItem } from './models';
import type { BackgroundConfig } from './background';
import { mergeWorkspaceItems, workspaceSettings } from './workspace';
import { cleanPracticePreset } from './practice-settings';

export type FeedbackExport = { id: string; category: string; title: string; description: string; status: string; createdAt: number; updatedAt: number;
  article?: { id: string; title: string; snapshotKey: string; position?: string | null; wrongText?: string | null };
  messages: Array<{ authorKind: string; text: string; createdAt: number }>;
  attachments: Array<{ name: string; data: string | null }> };
type Inputs = {
  user: User; local: WorkspaceItem[]; localAvailable?: boolean; remote?: WorkspaceItem[]; legacyDrafts: SavedPractice[];
  localHistory: PracticeRecord[]; remoteHistory: PracticeRecord[]; feedback: FeedbackExport[]; missing: string[]; exportedAt: string; preserveLocalCopies?: boolean;
};

function article(value: ArticleSnapshot) {
  return { id: value.id, title: value.title, text: value.text, language: value.language, difficulty: value.difficulty, custom: value.custom,
    ...(value.author !== undefined && { author: value.author }), ...(value.theme !== undefined && { theme: value.theme }),
    ...(value.source && { source: { name: value.source.name, url: value.source.url, license: value.source.license } }) };
}
function mistakes(values?: MistakeSample[]) {
  return values?.map(({ position, expected, actual }) => ({ position, expected, actual }));
}
function record(value: PracticeRecord): PracticeRecord {
  return { language: value.language, difficulty: value.difficulty, duration: value.duration, speed: value.speed, accuracy: value.accuracy, finishedAt: value.finishedAt,
    ...(value.recordId !== undefined && { recordId: value.recordId }), ...(value.status !== undefined && { status: value.status }),
    ...(value.elapsedMs !== undefined && { elapsedMs: value.elapsedMs }), ...(value.backspaces !== undefined && { backspaces: value.backspaces }),
    ...(value.errors !== undefined && { errors: value.errors }), ...(value.localOnly !== undefined && { localOnly: value.localOnly }),
    ...(value.article && { article: article(value.article) }), ...(value.typed !== undefined && { typed: value.typed }),
    ...(value.offset !== undefined && { offset: value.offset }), ...(value.total !== undefined && { total: value.total }),
    ...(value.correct !== undefined && { correct: value.correct }), ...(value.articleTotal !== undefined && { articleTotal: value.articleTotal }),
    ...(value.mode !== undefined && { mode: value.mode }), ...(value.strict !== undefined && { strict: value.strict }),
    ...(value.mistakes && { mistakes: mistakes(value.mistakes) }), ...(value.mistakesTruncated !== undefined && { mistakesTruncated: value.mistakesTruncated }), ...(value.paceTarget !== undefined && { paceTarget: value.paceTarget }) };
}
function draft(value: SavedPractice) {
  return { id: value.id, recordId: value.recordId, article: article(value.article), typed: value.typed, elapsedMs: value.elapsedMs,
    backspaces: value.backspaces, duration: value.duration, mode: value.mode, strict: value.strict, offset: value.offset,
    offline: value.offline, savedAt: value.savedAt, ...(value.mistakes && { mistakes: mistakes(value.mistakes) }), ...(value.mistakesTruncated !== undefined && { mistakesTruncated: value.mistakesTruncated }), ...(value.paceTarget !== undefined && { paceTarget: value.paceTarget }),
    ...(value.personalOnly !== undefined && { personalOnly: value.personalOnly }) };
}
function settings(value: ReaderSettings) {
  return { minutes: value.minutes, mode: value.mode, strict: value.strict, autoPause: value.autoPause, fontSize: value.fontSize,
    lineHeight: value.lineHeight, visibleLines: value.visibleLines, theme: value.theme, showTimer: value.showTimer !== false, showSpeed: value.showSpeed !== false,
    showAccuracy: value.showAccuracy !== false, shortcutsEnabled: value.shortcutsEnabled !== false, ...(value.mistakeStates && { mistakeStates: value.mistakeStates }), ...(value.presets && { presets: value.presets.map(cleanPracticePreset) }),
    ...(value.pace && { pace: { enabled: value.pace.enabled, source: value.pace.source, customSpeed: value.pace.customSpeed } }) };
}
function background(value: BackgroundConfig) {
  return { image: value.image, name: value.name, width: value.width, height: value.height, fit: value.fit,
    positionX: value.positionX, positionY: value.positionY, blur: value.blur, shade: value.shade };
}
function recordKey(value: PracticeRecord) {
  return value.recordId || `${value.finishedAt}:${value.language}:${value.difficulty}:${value.speed}:${value.accuracy}`;
}
function mergeRecords(values: PracticeRecord[]) {
  const records = new Map<string, PracticeRecord>();
  for (const value of values) {
    if (!value || typeof value !== 'object' || typeof value.finishedAt !== 'number') continue;
    const safe = record(value); const key = recordKey(safe); const previous = records.get(key);
    records.set(key, previous ? { ...previous, ...safe, ...(safe.article === undefined && previous.article && { article: previous.article }),
      ...(safe.typed === undefined && previous.typed !== undefined && { typed: previous.typed }),
      ...(safe.mistakes === undefined && previous.mistakes && { mistakes: previous.mistakes }) } : safe);
  }
  return [...records.values()].sort((a, b) => b.finishedAt - a.finishedAt);
}

export function buildPersonalExport(input: Inputs) {
  const items = mergeWorkspaceItems(input.local, input.remote ?? []);
  const drafts = new Map<string, SavedPractice>();
  const deletedDrafts = new Set(items.filter((item) => item.kind === 'draft' && item.deleted).map((item) => item.id));
  for (const item of items) if (item.kind === 'draft' && !item.deleted) drafts.set(item.id, item.value as SavedPractice);
  for (const value of input.legacyDrafts) {
    if (deletedDrafts.has(value.id)) continue;
    const previous = drafts.get(value.id);
    if (!previous || compareDraftProgress(value, previous) > 0) drafts.set(value.id, value);
  }
  const workspaceRecords = items.filter((item) => item.kind === 'record' && !item.deleted).map((item) => item.value as PracticeRecord);
  const deletedRecords = new Set(items.filter((item) => item.kind === 'record' && item.deleted).map((item) => item.id));
  const records = mergeRecords([...input.localHistory, ...workspaceRecords, ...input.remoteHistory].filter((value) => !value.recordId || !deletedRecords.has(value.recordId)));
  return {
    format: 'typing-personal-data', version: 1, exportedAt: input.exportedAt,
    scope: { accountId: input.user.id, localWorkspace: input.localAvailable === false ? 'unavailable' : 'included', cloudWorkspace: input.remote ? 'included' : 'unavailable',
      note: '本机旧版记录最多 50 条；导出不包含其他设备未同步的数据。' },
    missing: [...input.missing],
    account: { id: input.user.id, username: input.user.username, email: input.user.email, displayName: input.user.displayName || input.user.username, avatar: input.user.avatar ?? null },
    data: {
      settings: settings(workspaceSettings(items)),
      favorites: items.filter((item) => item.kind === 'favorite' && !item.deleted).map((item) => ({ articleId: item.id })),
      articles: items.filter((item) => item.kind === 'article' && !item.deleted).map((item) => article(item.value as ArticleSnapshot)),
      drafts: [...drafts.values()].map(draft), records,
      backgrounds: items.filter((item) => item.kind === 'background' && !item.deleted).map((item) => ({ theme: item.id, ...background(item.value as BackgroundConfig) })),
      ...(input.preserveLocalCopies && { localRecoveryCopies: { drafts: input.legacyDrafts.map(draft), records: input.localHistory.map(record) } }),
      feedback: input.feedback.map((item) => ({ id: item.id, category: item.category, title: item.title, description: item.description, status: item.status,
        createdAt: item.createdAt, updatedAt: item.updatedAt, ...(item.article && { article: { id: item.article.id, title: item.article.title, snapshotKey: item.article.snapshotKey,
          position: item.article.position, wrongText: item.article.wrongText } }),
        messages: item.messages.map(({ authorKind, text, createdAt }) => ({ authorKind, text, createdAt })),
        attachments: item.attachments.map(({ name, data }) => ({ name, data })) })),
    },
  };
}

function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function recordsCsv(records: PracticeRecord[]) {
  const safeDate = (value: number) => Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : '';
  const rows: unknown[][] = [['记录 ID', '时间', '文章', '语言', '难度', '模式', '时长秒', '速度', '速度单位', '准确率', '有效毫秒', '严格纠错', '错误', '退格'],
    ...records.map((item) => [item.recordId, safeDate(item.finishedAt), item.article?.title, item.language, item.difficulty,
      item.mode ?? 'timed', item.duration, item.speed, item.language === 'en' ? 'WPM' : '字/分', item.accuracy, item.elapsedMs,
      item.strict ? '是' : '否', item.errors, item.backspaces])];
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
