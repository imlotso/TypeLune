// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { localPracticeNeedsRecovery } from '../src/lib/local-practice-generation';

afterEach(() => localStorage.clear());

it('detects legacy drafts and records even when the workspace cache is empty', () => {
  localStorage.setItem('cloudtyping.practice.v2.draft', JSON.stringify({ ownerId: 'alice', typed: '未同步' }));
  expect(localPracticeNeedsRecovery('alice', 1, 2)).toBe('generation');
  expect(localPracticeNeedsRecovery('bob', 1, 2)).toBeNull();
  expect(localPracticeNeedsRecovery('alice', 2, 2)).toBe('conflict');
  localStorage.setItem('cloudtyping.practice.v2.draft', JSON.stringify({ ownerId: 'alice', localSyncGeneration: 2 }));
  expect(localPracticeNeedsRecovery('alice', 2, 2)).toBeNull();
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([{ ownerId: 'alice', localSyncGeneration: 1 }]));
  expect(localPracticeNeedsRecovery('alice', 2, 2)).toBe('conflict');
});

it('does not silently ignore malformed local practice data', () => {
  localStorage.setItem('cloudtyping.history.v1', '{');
  expect(() => localPracticeNeedsRecovery('alice', 1, 2)).toThrow('本机练习资料无法读取');
});
