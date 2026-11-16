// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { readDraft, usePractice } from '../src/hooks/usePractice';
import type { SavedPractice } from '../src/lib/models';
import type { ChangeEvent, CompositionEvent } from 'react';

const article = { id: 'sample-trace', title: '采样', text: '甲乙丙丁戊己', language: 'zh' as const, difficulty: 'beginner' as const, custom: true };
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });

it('persists active-time samples through pause, reload and finishing', async () => {
  let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
  const drafts: SavedPractice[] = [];
  const first = renderHook(() => usePractice({ ...article, article, articleId: article.id, duration: 60, ownerId: null, onDraft: (draft) => drafts.push(draft) }, null));
  act(() => first.result.current.updateTyped('甲错'));
  now = 5000; await act(() => first.result.current.pause());
  const saved = readDraft()!;
  expect(saved.processTrace?.samples).toEqual([{ time: 0, progress: 0, correct: 0, errors: 0 }, { time: 5000, progress: 2, correct: 1, errors: 1 }]);
  expect(drafts.at(-1)?.processTrace).toEqual(saved.processTrace);
  first.unmount();
  const resumed = renderHook(() => usePractice({ ...article, article, articleId: article.id, duration: 60, ownerId: null }, readDraft()));
  now = 25_000; await act(() => resumed.result.current.resume());
  act(() => resumed.result.current.updateTyped('甲乙丙'));
  now = 28_000; await act(() => resumed.result.current.pause());
  expect(readDraft()?.processTrace?.samples.at(-1)).toEqual({ time: 8000, progress: 3, correct: 3, errors: 1 });
  await act(() => resumed.result.current.finish(true));
  expect(resumed.result.current.result?.record?.processTrace?.samples.at(-1)).toEqual({ time: 8000, progress: 3, correct: 3, errors: 1 });
});

it('marks a resumed legacy draft as missing earlier observations', async () => {
  let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
  const first = renderHook(() => usePractice({ ...article, article, articleId: article.id, duration: 60, ownerId: null }, null));
  act(() => first.result.current.updateTyped('甲'));
  now = 5000; await act(() => first.result.current.pause());
  first.unmount();
  const old = readDraft()!; delete old.processTrace; delete old.processErrorEvents;
  const resumed = renderHook(() => usePractice({ ...article, article, articleId: article.id, duration: 60, ownerId: null }, old));
  now = 10_000; await act(() => resumed.result.current.resume());
  act(() => resumed.result.current.updateTyped('甲乙'));
  now = 15_000; await act(() => resumed.result.current.pause());
  expect(readDraft()?.processTrace?.missing).toBe(true);
  expect(readDraft()?.processTrace?.samples[0]).toMatchObject({ time: 5000, progress: 1, correct: 1 });
});

it('samples committed Chinese text, not the composing input', async () => {
  let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
  const session = renderHook(() => usePractice({ ...article, article, articleId: article.id, duration: 60, ownerId: null }, null));
  act(() => {
    session.result.current.onCompositionStart();
    session.result.current.onChange({ target: { value: 'jia' }, nativeEvent: { isComposing: true } } as unknown as ChangeEvent<HTMLTextAreaElement>);
  });
  now = 5000; await act(() => session.result.current.pause());
  expect(readDraft()?.processTrace?.samples.at(-1)).toEqual({ time: 5000, progress: 0, correct: 0, errors: 0 });
  now = 10_000; await act(() => session.result.current.resume());
  act(() => {
    session.result.current.onCompositionStart();
    session.result.current.onCompositionEnd({ currentTarget: { value: '甲' } } as unknown as CompositionEvent<HTMLTextAreaElement>);
  });
  now = 15_000; await act(() => session.result.current.pause());
  expect(readDraft()?.processTrace?.samples.at(-1)).toEqual({ time: 10_000, progress: 1, correct: 1, errors: 0 });
});
