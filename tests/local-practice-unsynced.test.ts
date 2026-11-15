// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { savedPracticeFromLegacy, type PracticeDraft } from '../src/hooks/usePractice';
import { inspectLocalPracticeCopies, localPracticeRawFingerprint } from '../src/lib/local-practice-unsynced';
import { normalizeWorkspaceRecord } from '../src/lib/records';

const article = { id: 'private', title: '短文', text: '山海', language: 'zh' as const, difficulty: 'beginner' as const, custom: true };
const local: PracticeDraft = { version: 1, articleId: article.id, title: article.title, text: article.text, target: article.text, article, language: 'zh', difficulty: 'beginner', custom: true, duration: 300, mode: 'timed', strict: false, ownerId: 'alice', typed: '山', elapsedMs: 1000, backspaces: 0, offline: true, suspicious: false, recordId: 'round', revision: 1, savedAt: 1000 };
afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

it('detects independent local drafts and history that are not represented in the workspace', () => {
  localStorage.setItem('cloudtyping.practice.v2.round', JSON.stringify(local));
  const record = { recordId: 'history', ownerId: 'alice', language: 'zh' as const, difficulty: 'beginner' as const, duration: 300, speed: 10, accuracy: 100, finishedAt: 1000 };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([record, { ...record, recordId: 'other', ownerId: 'bob' }]));
  expect(inspectLocalPracticeCopies('alice', [], []).pending).toBe(2);
  const draft = savedPracticeFromLegacy(local);
  expect(inspectLocalPracticeCopies('alice', [draft], [record]).pending).toBe(0);
  expect(inspectLocalPracticeCopies('alice', [{ ...draft, typed: '' }], [record]).pending).toBe(1);
  expect(inspectLocalPracticeCopies('bob', [], []).pending).toBe(1);
});

it('treats unreadable or incomplete owned legacy content as unconfirmed', () => {
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([{ ownerId: 'alice', recordId: 'broken', language: 'zh' }]));
  expect(inspectLocalPracticeCopies('alice', [], []).unknown).toBe(true);
  expect(inspectLocalPracticeCopies('bob', [], []).unknown).toBe(false);
  localStorage.setItem('cloudtyping.practice.v2.bad', '{');
  expect(inspectLocalPracticeCopies('alice', [], []).unknown).toBe(true);
});

it('detects changes to the current account without reacting to other accounts', () => {
  const empty = localPracticeRawFingerprint('alice');
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([{ ownerId: 'bob', recordId: 'other' }]));
  expect(localPracticeRawFingerprint('alice')).toBe(empty);
  localStorage.setItem('cloudtyping.practice.v2.round', JSON.stringify(local));
  const owned = localPracticeRawFingerprint('alice');
  expect(owned).not.toBe(empty);
  localStorage.setItem('cloudtyping.practice.v2.round', JSON.stringify({ ...local, typed: '山海' }));
  expect(localPracticeRawFingerprint('alice')).not.toBe(owned);
});

it('recognizes a matching id-less legacy record under its workspace item ID', () => {
  const record = { ownerId: 'alice', language: 'zh', difficulty: 'beginner', duration: 300, speed: 10, accuracy: 100, finishedAt: 1000 };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([record]));
  const cloud = normalizeWorkspaceRecord({ kind: 'record', id: 'old-cloud-id', updatedAt: 1000, value: record })!;
  expect(inspectLocalPracticeCopies('alice', [], [cloud]).pending).toBe(0);
});
