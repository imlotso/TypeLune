// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { hasUnloadedLocalHistory, localHistory } from '../src/hooks/usePractice';

afterEach(() => localStorage.clear());
it('reads all valid legacy records and reports only malformed entries as incomplete', () => {
  const records = Array.from({ length: 65 }, (_, index) => ({ recordId: `old-${index}`, language: 'zh', difficulty: 'beginner', duration: 300, speed: 30, accuracy: 99, finishedAt: index + 1 }));
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify(records));
  expect(localHistory()).toHaveLength(65);
  expect(hasUnloadedLocalHistory()).toBe(false);
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([...records, { recordId: 'broken' }]));
  expect(localHistory()).toHaveLength(65);
  expect(hasUnloadedLocalHistory()).toBe(true);
});
it('keeps readable records and reports malformed legacy entries in personal exports', async () => {
  const { collectPersonalExport } = await import('../src/lib/personal-export-fetch');
  const valid = { recordId: 'old', ownerId: 'user', language: 'zh', difficulty: 'beginner', duration: 300, speed: 30, accuracy: 99, finishedAt: 1000 };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([valid, { recordId: 'broken' }]));
  const data = await collectPersonalExport({ id: 'user', username: 'reader', email: 'reader@example.test', isAdmin: false }, { localOnly: true });
  expect(data.data.records.map((item) => item.recordId)).toContain('old');
  expect(data.missing.some((item) => item.includes('旧版记录'))).toBe(true);
});
it('keeps old summaries readable when their article snapshot lacks later fields', () => {
  const legacy = { ownerId: null, language: 'zh', difficulty: 'beginner', duration: 300, speed: 30, accuracy: 99, finishedAt: 1000,
    article: { id: 'legacy', title: '旧文', text: '山海' } };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([legacy]));
  const [record] = localHistory();
  expect(record).toMatchObject({ article: { id: 'legacy', title: '旧文', text: '山海', language: 'zh', difficulty: 'beginner', custom: true } });
  expect(record.recordId).toBeTruthy();
  expect(hasUnloadedLocalHistory()).toBe(true);
});
