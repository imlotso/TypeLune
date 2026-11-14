import { expect, it } from 'vitest';
import { buildPersonalExport, recordsCsv } from '../src/lib/personal-export';
import { defaultSettings, type SavedPractice, type WorkspaceItem } from '../src/lib/models';
import { makePracticePreset } from '../src/lib/practice-settings';
import { stableRecordId } from '../src/lib/records';

it('merges stable IDs, honors deletions and excludes authentication and recovery material', () => {
  const article = { id: 'private', title: '私文', text: '原文', language: 'zh' as const, difficulty: 'beginner' as const, custom: true as const, password: 'article-secret' };
  const draft = { id: 'draft-1', recordId: '1', article, typed: '原', elapsedMs: 1000, backspaces: 0, duration: 300, mode: 'timed' as const, strict: false, offset: 0, offline: true, ownerId: 'user', savedAt: 1,
    recoveryKey: 'recovery-secret', claimId: 'claim-secret', recoveryRequestId: 'request-secret' } as SavedPractice;
  const preset = { ...makePracticePreset('p1', '晨读', defaultSettings, 'zh', 'beginner', true), token: 'preset-secret' };
  const local: WorkspaceItem[] = [
    { kind: 'settings', id: 'preferences', updatedAt: 1, value: { ...defaultSettings, token: 'settings-secret', presets: [preset], statisticsTimezone: 'Asia/Shanghai', dailyGoalMinutes: 25 } },
    { kind: 'article', id: 'private', updatedAt: 2, value: article },
    { kind: 'draft', id: 'draft-1', updatedAt: 3, value: draft },
    { kind: 'favorite', id: 'deleted', updatedAt: 1, value: { articleId: 'deleted' } },
  ];
  const remote: WorkspaceItem[] = [{ kind: 'favorite', id: 'deleted', updatedAt: 4, deleted: true }];
  const record = { recordId: 'record-1', language: 'zh' as const, difficulty: 'beginner' as const, duration: 300, speed: 12, accuracy: 90, finishedAt: 10, article, typed: '原', token: 'record-secret' };
  const exported = buildPersonalExport({ user: { id: 'user', username: 'reader', email: 'reader@example.test', isAdmin: false, session: 'session-secret' } as never,
    local, remote, legacyDrafts: [draft], localHistory: [record], remoteHistory: [{ ...record, status: 'review', article: undefined, typed: undefined }], feedback: [], missing: [], exportedAt: '2026-11-15T00:00:00.000Z' });
  expect(exported.data.favorites).toEqual([]);
  expect(exported.data.drafts).toHaveLength(1);
  expect(exported.data.records).toHaveLength(1);
  expect(exported.data.records[0]).toMatchObject({ recordId: 'record-1', status: 'review', typed: '原' });
  expect(exported.data.settings.presets).toMatchObject([{ id: 'p1', name: '晨读' }]);
  expect(exported.data.settings).toMatchObject({ statisticsTimezone: 'Asia/Shanghai', dailyGoalMinutes: 25 });
  const json = JSON.stringify(exported);
  for (const secret of ['recovery-secret', 'claim-secret', 'request-secret', 'settings-secret', 'preset-secret', 'record-secret', 'session-secret', 'article-secret']) expect(json).not.toContain(secret);
  expect(exported.version).toBe(1);
  expect(exported.exportedAt).toBe('2026-11-15T00:00:00.000Z');
});

it('quotes CSV content and prevents spreadsheet formula execution', () => {
  const csv = recordsCsv([{ language: 'en', difficulty: 'beginner', duration: 300, speed: 30, accuracy: 98, finishedAt: 0,
    article: { id: 'a', title: '=HYPERLINK("https://example.test")', text: 'x', language: 'en', difficulty: 'beginner', custom: true } }]);
  expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
  expect(csv).toContain('WPM');
});

it('retains a local legacy draft copy for recovery even when its workspace item is deleted', () => {
  const article = { id: 'private', title: '私文', text: '原文', language: 'zh' as const, difficulty: 'beginner' as const, custom: true as const };
  const saved: SavedPractice = { id: 'draft-1', recordId: '1', article, typed: '原', elapsedMs: 1, backspaces: 0, duration: 300, mode: 'timed', strict: false, offset: 0, offline: true, ownerId: 'user', savedAt: 1, recoveryKey: 'secret-recovery-material' };
  const exported = buildPersonalExport({ user: { id: 'user', username: 'reader', email: 'r@example.test', isAdmin: false },
    local: [{ kind: 'draft', id: saved.id, updatedAt: 2, deleted: true }], legacyDrafts: [saved], localHistory: [], remoteHistory: [], feedback: [], missing: [], exportedAt: '2026-11-15T00:00:00.000Z', preserveLocalCopies: true });
  expect(exported.data.drafts).toEqual([]);
  expect(exported.data.localRecoveryCopies?.drafts[0]).toMatchObject({ id: 'draft-1', typed: '原' });
  expect(JSON.stringify(exported)).not.toContain('secret-recovery-material');
});

it('exports validated process observations and excludes unknown trace data', () => {
  const processTrace = { version: 1 as const, intervalMs: 5000, missing: false, compacted: false, samples: [{ time: 0, progress: 0, correct: 0, errors: 0 }, { time: 5000, progress: 1, correct: 1, errors: 0 }] };
  const record = { recordId: 'sample', language: 'zh' as const, difficulty: 'beginner' as const, duration: 300, speed: 12, accuracy: 100, finishedAt: 10, processTrace };
  const bad = { ...record, recordId: 'bad', processTrace: { ...processTrace, token: 'trace-secret' } };
  const exported = buildPersonalExport({ user: { id: 'user', username: 'reader', email: 'r@example.test', isAdmin: false }, local: [], legacyDrafts: [], localHistory: [record, bad], remoteHistory: [], feedback: [], missing: [], exportedAt: '2026-11-15T00:00:00.000Z' });
  expect(exported.data.records.find((item) => item.recordId === 'sample')?.processTrace).toEqual(processTrace);
  expect(JSON.stringify(exported)).not.toContain('trace-secret');
});

it('deduplicates a legacy local record against its distinct workspace item in exports', () => {
  const legacy = { ownerId: 'user', language: 'zh' as const, difficulty: 'beginner' as const, duration: 300, speed: 12, accuracy: 100, finishedAt: 10 };
  const alias = stableRecordId(legacy);
  const exported = buildPersonalExport({ user: { id: 'user', username: 'reader', email: 'r@example.test', isAdmin: false },
    local: [{ kind: 'record', id: 'old-cloud-id', updatedAt: 10, value: legacy }], legacyDrafts: [],
    localHistory: [{ ...legacy, recordId: alias, legacyLocalIds: [alias] }], remoteHistory: [], feedback: [], missing: [], exportedAt: '2026-11-15T00:00:00.000Z' });
  expect(exported.data.records).toHaveLength(1);
  expect(exported.data.records[0]).toMatchObject({ recordId: 'old-cloud-id', localOnly: true });
  expect(JSON.stringify(exported)).not.toContain('legacyLocalIds');
});
