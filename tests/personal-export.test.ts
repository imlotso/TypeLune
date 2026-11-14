import { expect, it } from 'vitest';
import { buildPersonalExport, recordsCsv } from '../src/lib/personal-export';
import { defaultSettings, type SavedPractice, type WorkspaceItem } from '../src/lib/models';

it('merges stable IDs, honors deletions and excludes authentication and recovery material', () => {
  const article = { id: 'private', title: '私文', text: '原文', language: 'zh' as const, difficulty: 'beginner' as const, custom: true as const, password: 'article-secret' };
  const draft = { id: 'draft-1', recordId: '1', article, typed: '原', elapsedMs: 1000, backspaces: 0, duration: 300, mode: 'timed' as const, strict: false, offset: 0, offline: true, ownerId: 'user', savedAt: 1,
    recoveryKey: 'recovery-secret', claimId: 'claim-secret', recoveryRequestId: 'request-secret' } as SavedPractice;
  const local: WorkspaceItem[] = [
    { kind: 'settings', id: 'preferences', updatedAt: 1, value: { ...defaultSettings, token: 'settings-secret' } },
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
  const json = JSON.stringify(exported);
  for (const secret of ['recovery-secret', 'claim-secret', 'request-secret', 'settings-secret', 'record-secret', 'session-secret', 'article-secret']) expect(json).not.toContain(secret);
  expect(exported.version).toBe(1);
  expect(exported.exportedAt).toBe('2026-11-15T00:00:00.000Z');
});

it('quotes CSV content and prevents spreadsheet formula execution', () => {
  const csv = recordsCsv([{ language: 'en', difficulty: 'beginner', duration: 300, speed: 30, accuracy: 98, finishedAt: 0,
    article: { id: 'a', title: '=HYPERLINK("https://example.test")', text: 'x', language: 'en', difficulty: 'beginner', custom: true } }]);
  expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
  expect(csv).toContain('WPM');
});
