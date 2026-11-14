import { clearLocalPractice, readDrafts, savedPracticeFromLegacy } from '../hooks/usePractice';
import { api } from './api';
import { stableRecordId } from './records';
import { localPracticeNeedsRecovery } from './local-practice-generation';
import { cleanPracticePreset } from './practice-settings';
import { compareDraftProgress, type ArticleSnapshot, type PracticeRecord, type ReaderSettings, type SavedPractice, type WorkspaceItem, type WorkspaceKind, type WorkspaceValues } from './models';
import { allowGuestWorkspace, blockGuestWorkspace, clearLocalWorkspace, importWorkspaceValue, isLocalAccountBlocked, isWorkspaceItem, ownsGuestWorkspaceBlock, readBlockedWorkspace, readWorkspace, sameWorkspaceValue, workspaceSettings } from './workspace';

export type GuestItem = { kind: WorkspaceKind; id: string; value: WorkspaceValues[WorkspaceKind]; expected?: WorkspaceItem };
export type GuestImportPlan = { ownerId: string; items: GuestItem[]; counts: Record<WorkspaceKind, number>; fingerprint: string };
const kinds: WorkspaceKind[] = ['article', 'favorite', 'draft', 'record', 'settings', 'background'];

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
}
const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function cleanArticle(value: ArticleSnapshot): ArticleSnapshot {
  return { id: value.id, title: value.title, text: value.text, language: value.language, difficulty: value.difficulty, custom: value.custom,
    ...(value.author !== undefined && { author: value.author }), ...(value.theme !== undefined && { theme: value.theme }),
    ...(value.source && { source: { name: value.source.name, url: value.source.url, license: value.source.license } }) };
}
function cleanDraft(value: SavedPractice, ownerId: string): SavedPractice {
  return { id: value.id, recordId: value.recordId, article: cleanArticle(value.article), typed: value.typed, elapsedMs: value.elapsedMs,
    backspaces: value.backspaces, duration: value.duration, mode: value.mode, strict: value.strict, offset: value.offset,
    offline: true, personalOnly: true, ownerId, savedAt: value.savedAt,
    ...(value.mistakes && { mistakes: value.mistakes.map(({ position, expected, actual }) => ({ position, expected, actual })) }),
    ...(value.mistakesTruncated !== undefined && { mistakesTruncated: value.mistakesTruncated }),
    ...(value.paceTarget !== undefined && { paceTarget: value.paceTarget }),
    ...(value.suspicious !== undefined && { suspicious: value.suspicious }) };
}
function cleanRecord(value: PracticeRecord, ownerId: string, recordId: string): PracticeRecord {
  return { recordId, language: value.language, difficulty: value.difficulty, duration: value.duration, speed: value.speed, accuracy: value.accuracy, finishedAt: value.finishedAt,
    ownerId, localOnly: true, ...(value.elapsedMs !== undefined && { elapsedMs: value.elapsedMs }), ...(value.backspaces !== undefined && { backspaces: value.backspaces }),
    ...(value.errors !== undefined && { errors: value.errors }), ...(value.article && { article: cleanArticle(value.article) }), ...(value.typed !== undefined && { typed: value.typed }),
    ...(value.offset !== undefined && { offset: value.offset }), ...(value.total !== undefined && { total: value.total }), ...(value.correct !== undefined && { correct: value.correct }),
    ...(value.articleTotal !== undefined && { articleTotal: value.articleTotal }), ...(value.mode !== undefined && { mode: value.mode }), ...(value.strict !== undefined && { strict: value.strict }),
    ...(value.mistakes && { mistakes: value.mistakes.map(({ position, expected, actual }) => ({ position, expected, actual })) }),
    ...(value.mistakesTruncated !== undefined && { mistakesTruncated: value.mistakesTruncated }), ...(value.paceTarget !== undefined && { paceTarget: value.paceTarget }) };
}
function cleanSettings(value: ReaderSettings): ReaderSettings {
  const { minutes, mode, strict, autoPause, fontSize, lineHeight, visibleLines, theme } = value;
  return { minutes, mode, strict, autoPause, fontSize, lineHeight, visibleLines, theme,
    showTimer: value.showTimer !== false, showSpeed: value.showSpeed !== false, showAccuracy: value.showAccuracy !== false,
    shortcutsEnabled: value.shortcutsEnabled !== false,
    ...(value.statisticsTimezone !== undefined && { statisticsTimezone: value.statisticsTimezone }), ...(value.dailyGoalMinutes !== undefined && { dailyGoalMinutes: value.dailyGoalMinutes }),
    ...(value.mistakeStates && { mistakeStates: value.mistakeStates }), ...(value.presets && { presets: value.presets.map(cleanPracticePreset) }),
    ...(value.pace && { pace: { enabled: value.pace.enabled, source: value.pace.source, customSpeed: value.pace.customSpeed } }) };
}

function guestLegacyData() {
  let rawHistory: unknown;
  let guestDraftCount = 0;
  try {
    rawHistory = JSON.parse(localStorage.getItem('cloudtyping.history.v1') || '[]');
    if (!Array.isArray(rawHistory)) throw new Error('游客记录无法读取');
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key || (key !== 'cloudtyping.practice.v1' && !key.startsWith('cloudtyping.practice.v2.'))) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const item: unknown = JSON.parse(raw);
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('游客草稿无法读取');
      const owner = (item as { ownerId?: unknown }).ownerId;
      if (owner !== undefined && owner !== null && typeof owner !== 'string') throw new Error('游客草稿无法读取');
      if (owner == null) guestDraftCount++;
    }
  } catch (problem) { throw new Error(problem instanceof Error && problem.message.startsWith('游客') ? problem.message : '本机旧版资料无法读取'); }
  const drafts = readDrafts(null);
  if (drafts.length !== guestDraftCount) throw new Error('游客草稿无法读取');
  const history = rawHistory as unknown[];
  if (history.some((item) => !item || typeof item !== 'object' || Array.isArray(item) ||
    ((item as { ownerId?: unknown }).ownerId != null && typeof (item as { ownerId?: unknown }).ownerId !== 'string'))) throw new Error('游客记录无法读取');
  return { drafts: drafts.map(savedPracticeFromLegacy), records: (history as PracticeRecord[]).filter((record) => (record.ownerId ?? null) === null) };
}

export async function collectGuestImport(ownerId: string, guestBlocked = false): Promise<GuestImportPlan> {
  if (!guestBlocked && isLocalAccountBlocked(null)) throw new Error('游客资料正在清理，请稍后重试');
  // Unlike the legacy readers, this check reports corrupted JSON instead of silently skipping it.
  localPracticeNeedsRecovery(ownerId, 1, 1);
  const [guest, account] = await Promise.all([guestBlocked ? readBlockedWorkspace(null) : readWorkspace(null), readWorkspace(ownerId)]);
  if (!guest.every(isWorkspaceItem) || !account.every(isWorkspaceItem)) throw new Error('本机资料无法读取');
  const legacy = guestLegacyData();
  const legacyDrafts = legacy.drafts;
  const legacyRecords = legacy.records;
  const fingerprint = JSON.stringify(canonical([guest, legacyDrafts, legacyRecords]));
  const accountItems = new Map(account.map((item) => [`${item.kind}:${item.id}`, item]));
  const selected = new Map<string, { kind: WorkspaceKind; id: string; value: WorkspaceValues[WorkspaceKind] }>();
  const originalDrafts = new Map<string, SavedPractice>();
  const deleted = new Set(guest.filter((item) => item.deleted).map((item) => `${item.kind}:${item.id}`));
  const put = (kind: WorkspaceKind, id: string, value: WorkspaceValues[WorkspaceKind]) => selected.set(`${kind}:${id}`, { kind, id, value });
  for (const item of guest) {
    if (item.deleted) continue;
    switch (item.kind) {
      case 'favorite': put('favorite', item.id, { articleId: item.id }); break;
      case 'article': put('article', item.id, cleanArticle(item.value as ArticleSnapshot) as WorkspaceValues['article']); break;
      case 'draft': originalDrafts.set(`draft:${item.id}`, item.value as SavedPractice); put('draft', item.id, cleanDraft(item.value as SavedPractice, ownerId)); break;
      case 'record': put('record', item.id, cleanRecord(item.value as PracticeRecord, ownerId, item.id)); break;
      case 'settings': put('settings', item.id, cleanSettings(workspaceSettings([item]))); break;
      case 'background': put('background', item.id, item.value as WorkspaceValues['background']); break;
    }
  }
  for (const value of legacyDrafts) {
    const key = `draft:${value.id}`;
    if (deleted.has(key)) continue;
    const previous = originalDrafts.get(key);
    const order = previous ? compareDraftProgress(value, previous) : 1;
    if (previous && order === 0 &&
      (value.typed !== previous.typed || Math.abs(value.elapsedMs - previous.elapsedMs) > 1000 || value.offset !== previous.offset ||
        value.backspaces !== previous.backspaces || !equal(cleanArticle(value.article), cleanArticle(previous.article)))) throw new Error('游客草稿存在冲突，请先返回游客空间处理');
    if (!previous || order > 0 || (order === 0 && value.elapsedMs > previous.elapsedMs)) { originalDrafts.set(key, value); put('draft', value.id, cleanDraft(value, ownerId)); }
  }
  for (const value of legacyRecords) {
    const id = stableRecordId(value); const key = `record:${id}`;
    if (deleted.has(key)) continue;
    const sanitized = cleanRecord(value, ownerId, id);
    const previous = selected.get(key)?.value;
    if (previous && !equal(previous, sanitized)) throw new Error('游客记录存在冲突，请先返回游客空间处理');
    if (!previous) put('record', id, sanitized);
  }
  const items = [...selected.values()].map((item) => ({ ...item, expected: accountItems.get(`${item.kind}:${item.id}`) }));
  if (items.some((item) => !isWorkspaceItem({ ...item, updatedAt: 0 }))) throw new Error('部分游客资料无法读取');
  const counts = Object.fromEntries(kinds.map((kind) => [kind, items.filter((item) => item.kind === kind).length])) as Record<WorkspaceKind, number>;
  return { ownerId, items, counts, fingerprint };
}

export function guestImportConflicts(plan: GuestImportPlan, replaceSettings: boolean) {
  return plan.items.filter((item) => item.expected && (item.expected.deleted ||
    (!sameWorkspaceValue(item.kind, item.expected.value, item.value) && !(item.kind === 'settings' && replaceSettings)))).length;
}

export async function importGuestItems(ownerId: string, plan: GuestImportPlan, replaceSettings: boolean) {
  if (plan.ownerId !== ownerId) throw new Error('登录账号已变更');
  let added = 0; let conflicts = 0;
  const accepted: GuestItem[] = [];
  for (const item of plan.items) {
    const result = await importWorkspaceValue(ownerId, item.kind, item.id, item.value, item.expected, replaceSettings);
    if (result === 'conflict') conflicts++;
    else { accepted.push(item); if (result === 'added') added++; }
  }
  return { added, conflicts, accepted };
}

export async function verifyGuestImport(ownerId: string, accepted: GuestItem[]) {
  const response = await api<{ protocol: number; items: WorkspaceItem[] }>('/api/workspace', { headers: { 'X-Workspace-Owner': ownerId, 'X-Workspace-Protocol': '2' }, timeoutMs: 60_000 });
  if (response.protocol !== 2 || !Array.isArray(response.items) || !response.items.every(isWorkspaceItem)) throw new Error('云端资料无法读取');
  const cloud = new Map(response.items.map((item) => [`${item.kind}:${item.id}`, item]));
  return accepted.every((item) => { const stored = cloud.get(`${item.kind}:${item.id}`); return stored && !stored.deleted && sameWorkspaceValue(item.kind, stored.value, item.value); });
}

export async function clearImportedGuestCopies(ownerId: string, fingerprint: string) {
  const token = blockGuestWorkspace();
  try {
    const current = await collectGuestImport(ownerId, true);
    if (current.fingerprint !== fingerprint) throw new Error('游客资料已变化，请重新导入后再清理');
    if (!ownsGuestWorkspaceBlock(token)) throw new Error('游客资料保护已过期，请重试');
    await clearLocalWorkspace(null, token);
    if (!ownsGuestWorkspaceBlock(token)) throw new Error('游客资料保护已过期，请重试');
    clearLocalPractice(null);
  } finally { allowGuestWorkspace(token); }
}
