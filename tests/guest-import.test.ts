// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { clearImportedGuestCopies, collectGuestImport, guestImportConflicts, importGuestItems } from '../src/lib/guest-import';
import { allowLocalAccount, blockLocalAccount, putWorkspaceValue, readWorkspace } from '../src/lib/workspace';
import { defaultSettings, type SavedPractice } from '../src/lib/models';
import { makePracticePreset } from '../src/lib/practice-settings';

afterEach(() => { allowLocalAccount('alice'); localStorage.clear(); sessionStorage.clear(); });
const article = { id: 'private', title: '私文', text: '山海', language: 'zh' as const, difficulty: 'beginner' as const, custom: true as const };

it('imports stable IDs idempotently, retains account settings and strips online recovery eligibility', async () => {
  await putWorkspaceValue(null, 'favorite', 'a', { articleId: 'a' });
  await putWorkspaceValue(null, 'article', article.id, article);
  await putWorkspaceValue(null, 'settings', 'preferences', { ...defaultSettings, minutes: 10 });
  await putWorkspaceValue('alice', 'settings', 'preferences', { ...defaultSettings, minutes: 20 });
  const draft: SavedPractice = { id: 'draft-old', recordId: 'old', article, typed: '山', elapsedMs: 1000, backspaces: 0, duration: 300, mode: 'timed', strict: false,
    offset: 0, offline: false, ownerId: null, savedAt: 1000, recoveryKey: 'test-secret', recoveryId: 'test-id', claimId: 'test-claim' };
  await putWorkspaceValue(null, 'draft', draft.id, draft);
  await putWorkspaceValue(null, 'record', 'record', { recordId: 'record', language: 'zh', difficulty: 'beginner', duration: 300, speed: 30, accuracy: 90, finishedAt: 1000, ownerId: null, status: 'published' });
  const plan = await collectGuestImport('alice');
  expect(plan.counts).toMatchObject({ favorite: 1, article: 1, draft: 1, record: 1, settings: 1 });
  const first = await importGuestItems('alice', plan, false);
  expect(first.conflicts).toBe(1);
  const second = await importGuestItems('alice', plan, false);
  expect(second.added).toBe(0);
  const values = await readWorkspace('alice');
  expect(values.filter((item) => item.kind === 'favorite')).toHaveLength(1);
  expect(values.find((item) => item.kind === 'settings')?.value).toMatchObject({ minutes: 20 });
  expect(values.find((item) => item.kind === 'draft')?.value).toMatchObject({ typed: '山', offline: true, personalOnly: true, ownerId: 'alice' });
  expect(JSON.stringify(values)).not.toContain('test-secret');
  expect(values.find((item) => item.kind === 'record')?.value).toMatchObject({ localOnly: true, ownerId: 'alice' });
  expect((values.find((item) => item.kind === 'record')?.value as { status?: string }).status).toBeUndefined();
  expect(await readWorkspace(null)).toHaveLength(5);
});

it('keeps guest data through a failed write and imports it on retry', async () => {
  await putWorkspaceValue(null, 'favorite', 'retry', { articleId: 'retry' });
  const plan = await collectGuestImport('alice');
  blockLocalAccount('alice');
  await expect(importGuestItems('alice', plan, false)).rejects.toThrow();
  expect((await readWorkspace(null)).some((item) => item.id === 'retry')).toBe(true);
  allowLocalAccount('alice');
  expect((await importGuestItems('alice', plan, false)).added).toBe(1);
});

it('keeps the newer claimed workspace draft when an older legacy copy has a larger progress number', async () => {
  const current: SavedPractice = { id: 'draft-round', recordId: 'round', article, typed: '山海', elapsedMs: 2000, backspaces: 0, duration: 300, mode: 'timed', strict: false,
    offset: 0, offline: false, ownerId: null, savedAt: 2000, claimVersion: 2, progressVersion: 1 };
  await putWorkspaceValue(null, 'draft', current.id, current);
  localStorage.setItem('cloudtyping.practice.v2.round', JSON.stringify({ version: 1, recordId: 'round', articleId: article.id, title: article.title, text: article.text, target: article.text,
    article, language: 'zh', difficulty: 'beginner', custom: true, duration: 300, mode: 'timed', ownerId: null, typed: '山', offline: false, elapsedMs: 1000,
    backspaces: 0, claimVersion: 1, progressVersion: 100, savedAt: 3000 }));
  const plan = await collectGuestImport('alice');
  expect(plan.items.find((item) => item.kind === 'draft')?.value).toMatchObject({ typed: '山海', elapsedMs: 2000 });
});

it('accepts small elapsed-time differences between matching copies of a guest draft', async () => {
  const current: SavedPractice = { id: 'draft-round', recordId: 'round', article, typed: '山', elapsedMs: 2000, backspaces: 0, duration: 300, mode: 'timed', strict: false,
    offset: 0, offline: true, ownerId: null, savedAt: 2000, progressVersion: 1 };
  await putWorkspaceValue(null, 'draft', current.id, current);
  localStorage.setItem('cloudtyping.practice.v2.round', JSON.stringify({ version: 1, recordId: 'round', articleId: article.id, title: article.title, text: article.text, target: article.text,
    article, language: 'zh', difficulty: 'beginner', custom: true, duration: 300, mode: 'timed', strict: false, offset: 0, ownerId: null, typed: '山', offline: true,
    elapsedMs: 2004, backspaces: 0, progressVersion: 1, savedAt: 2000 }));
  const plan = await collectGuestImport('alice');
  expect(plan.items.find((item) => item.kind === 'draft')?.value).toMatchObject({ typed: '山', elapsedMs: 2004 });
});

it('refuses to clear changed guest data and never clears the account or its history', async () => {
  await putWorkspaceValue(null, 'favorite', 'one', { articleId: 'one' });
  await putWorkspaceValue('alice', 'favorite', 'account', { articleId: 'account' });
  const history = { language: 'zh', difficulty: 'beginner', duration: 300, speed: 10, accuracy: 100, finishedAt: 1000 };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([{ ...history, ownerId: null, recordId: 'guest' }, { ...history, ownerId: 'alice', recordId: 'account' }]));
  const first = await collectGuestImport('alice');
  await putWorkspaceValue(null, 'favorite', 'later', { articleId: 'later' });
  await expect(clearImportedGuestCopies('alice', first.fingerprint)).rejects.toThrow('游客资料已变化');
  expect(await readWorkspace(null)).toHaveLength(2);
  const current = await collectGuestImport('alice');
  await clearImportedGuestCopies('alice', current.fingerprint);
  expect(await readWorkspace(null)).toEqual([]);
  expect((await readWorkspace('alice')).map((item) => item.id)).toEqual(['account']);
  expect(JSON.parse(localStorage.getItem('cloudtyping.history.v1')!)).toMatchObject([{ ownerId: 'alice', recordId: 'account' }]);
});

it('does not leave the guest workspace locked after an interrupted cleanup lease expires', async () => {
  localStorage.setItem('cloudtyping.guest-blocked.v1', JSON.stringify({ token: 'abandoned', expiresAt: Date.now() - 1 }));
  await expect(putWorkspaceValue(null, 'favorite', 'later', { articleId: 'later' })).resolves.toBeUndefined();
  expect((await readWorkspace(null)).map((item) => item.id)).toEqual(['later']);
});

it('requires an explicit settings override and does not overwrite a newer account edit', async () => {
  await putWorkspaceValue(null, 'settings', 'preferences', { ...defaultSettings, minutes: 10 });
  await putWorkspaceValue('alice', 'settings', 'preferences', { ...defaultSettings, minutes: 20 });
  const oldPlan = await collectGuestImport('alice');
  await putWorkspaceValue('alice', 'settings', 'preferences', { ...defaultSettings, minutes: 30 });
  expect((await importGuestItems('alice', oldPlan, true)).conflicts).toBe(1);
  expect((await readWorkspace('alice'))[0].value).toMatchObject({ minutes: 30 });
  const current = await collectGuestImport('alice');
  expect((await importGuestItems('alice', current, true)).added).toBe(1);
  expect((await readWorkspace('alice'))[0].value).toMatchObject({ minutes: 10 });
});

it('treats absent legacy display flags as the visible defaults during deduplication', async () => {
  const old = { minutes: 5, mode: 'timed' as const, strict: false, autoPause: true, fontSize: 18, lineHeight: 1.6, visibleLines: 4, theme: 'light' as const };
  await putWorkspaceValue('alice', 'settings', 'preferences', old);
  await putWorkspaceValue(null, 'settings', 'preferences', { ...defaultSettings });
  const plan = await collectGuestImport('alice');
  expect(guestImportConflicts(plan, false)).toBe(0);
  const result = await importGuestItems('alice', plan, false);
  expect(result).toMatchObject({ added: 0, conflicts: 0 });
});

it('keeps guest presets when importing settings into an account without its own settings', async () => {
  const preset = makePracticePreset('guest-preset', '晨读', defaultSettings, 'zh', 'beginner', true);
  await putWorkspaceValue(null, 'settings', 'preferences', { ...defaultSettings, presets: [preset] });
  const plan = await collectGuestImport('alice');
  expect((await importGuestItems('alice', plan, false)).added).toBe(1);
  expect((await readWorkspace('alice'))[0].value).toMatchObject({ presets: [{ id: 'guest-preset', name: '晨读' }] });
});

it('does not silently discard legacy history beyond the normal display limit or invalid guest drafts', async () => {
  const history = Array.from({ length: 51 }, (_, index) => ({ recordId: `r${index}`, ownerId: null, language: 'zh', difficulty: 'beginner', duration: 300, speed: 10, accuracy: 100, finishedAt: 1000 + index }));
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify(history));
  expect((await collectGuestImport('alice')).counts.record).toBe(51);
  localStorage.setItem('cloudtyping.practice.v2.invalid', JSON.stringify({ version: 1, ownerId: null, typed: '不完整' }));
  await expect(collectGuestImport('alice')).rejects.toThrow('游客草稿无法读取');
  expect(localStorage.getItem('cloudtyping.practice.v2.invalid')).toContain('不完整');
});

it('imports the chosen guest statistics time zone and goal as settings', async () => {
  await putWorkspaceValue(null, 'settings', 'preferences', { ...defaultSettings, statisticsTimezone: 'Asia/Shanghai', dailyGoalMinutes: 25 });
  const plan = await collectGuestImport('alice');
  await importGuestItems('alice', plan, false);
  expect((await readWorkspace('alice'))[0].value).toMatchObject({ statisticsTimezone: 'Asia/Shanghai', dailyGoalMinutes: 25 });
});

it('retains validated process observations during a guest import', async () => {
  const processTrace = { version: 1 as const, intervalMs: 5000, missing: false, compacted: false, samples: [{ time: 0, progress: 0, correct: 0, errors: 0 }, { time: 5000, progress: 1, correct: 1, errors: 1 }] };
  const draft: SavedPractice = { id: 'draft-trace', recordId: 'trace', article, typed: '山', elapsedMs: 5000, backspaces: 0, duration: 300, mode: 'timed', strict: false, offset: 0, offline: true, ownerId: null, savedAt: 5000, processTrace, processErrorEvents: 1 };
  await putWorkspaceValue(null, 'draft', draft.id, draft);
  await putWorkspaceValue(null, 'record', 'trace', { recordId: 'trace', language: 'zh', difficulty: 'beginner', duration: 300, speed: 12, accuracy: 100, finishedAt: 5000, processTrace });
  const plan = await collectGuestImport('alice');
  await importGuestItems('alice', plan, false);
  const values = await readWorkspace('alice');
  expect(values.find((item) => item.kind === 'draft')?.value).toMatchObject({ processTrace, processErrorEvents: 1 });
  expect(values.find((item) => item.kind === 'record')?.value).toMatchObject({ processTrace });
});
