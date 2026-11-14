// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { readDraft, usePractice } from '../src/hooks/usePractice';

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });
it('freezes the chosen target for a round and preserves it across pause and restore', async () => {
  let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
  const article = { id: 'custom', title: '短文', text: '甲乙丙丁', language: 'zh' as const, difficulty: 'beginner' as const, custom: true };
  const { result, rerender, unmount } = renderHook(({ paceTarget }) => usePractice({ ...article, articleId: article.id, article, duration: 60, ownerId: null, paceTarget }, null), { initialProps: { paceTarget: 60 } });
  act(() => result.current.updateTyped('甲'));
  rerender({ paceTarget: 120 });
  expect(result.current.paceTarget).toBe(60);
  now = 5000; await act(() => result.current.pause());
  const saved = readDraft()!;
  expect(saved.paceTarget).toBe(60);
  unmount();
  const released = readDraft()!;
  const resumed = renderHook(() => usePractice({ ...article, articleId: article.id, article, duration: 60, ownerId: null, paceTarget: 120 }, released));
  expect(resumed.result.current.paceTarget).toBe(60);
  expect(resumed.result.current.elapsedMs).toBe(5000);
  now = 25_000; await act(() => resumed.result.current.resume());
  now = 28_000; await act(() => resumed.result.current.pause());
  expect(resumed.result.current.elapsedMs).toBe(8000);
  expect(resumed.result.current.paceTarget).toBe(60);
});
