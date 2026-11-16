// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePractice, type PracticeConfig } from '../src/hooks/usePractice';
const config: PracticeConfig = { articleId: 'resume-test', title: 'Resume', text: 'abcdef', language: 'en', difficulty: 'beginner', duration: 60, custom: true, ownerId: null };
let now = 0;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('arms resume without counting idle time and starts on the first changed text', async () => {
  const { result } = renderHook(() => usePractice(config, null));
  act(() => result.current.updateTyped('a'));
  now = 2000; await act(() => result.current.pause());
  now = 10000; await act(() => result.current.resume());
  expect(result.current.phase).toBe('paused');
  now = 20000; act(() => result.current.updateTyped('ab'));
  expect(result.current.phase).toBe('running');
  now = 23000; await act(() => result.current.pause());
  expect(result.current.elapsedMs).toBe(5000);
  expect(result.current.typed).toBe('ab');
});
it('does not resume for an unchanged value or cancelled IME, resumes for the committed text', async () => {
  const { result } = renderHook(() => usePractice(config, null));
  act(() => result.current.updateTyped('a'));
  now = 2000; await act(() => result.current.pause());
  await act(() => result.current.resume());
  act(() => result.current.updateTyped('a'));
  act(() => result.current.onCompositionStart());
  act(() => result.current.onChange({ target: { value: 'ani' }, nativeEvent: { isComposing: true } } as never));
  expect(result.current.raw).toBe('ani');
  expect(result.current.phase).toBe('paused');
  act(() => result.current.onCompositionEnd({ currentTarget: { value: 'a' } } as never));
  expect(result.current.phase).toBe('paused');
  now = 15000;
  act(() => result.current.onCompositionStart());
  act(() => result.current.onCompositionEnd({ currentTarget: { value: 'ab' } } as never));
  expect(result.current.phase).toBe('running');
  expect(result.current.typed).toBe('ab');
});

it('does not contact the online resume endpoint until input, and retains fast edits during its response', async () => {
  let resolveResume!: (value: Response) => void;
  const response = (data: unknown) => ({ ok: true, json: async () => data }) as Response;
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    if (url.endsWith('/start')) return response({ id: 'a'.repeat(32), target: config.text });
    if (url.endsWith('/pause')) return response({ remainingMs: 58000 });
    if (url.endsWith('/resume')) return new Promise<Response>(resolve => { resolveResume = resolve; });
    return response({});
  }));
  const { result } = renderHook(() => usePractice({ ...config, custom: false }, null));
  await act(() => result.current.start());
  act(() => result.current.updateTyped('a'));
  now = 2000; await act(() => result.current.pause());
  await act(() => result.current.resume());
  expect(calls.filter(url => url.endsWith('/resume'))).toHaveLength(0);
  now = 20000;
  act(() => result.current.updateTyped('ab'));
  expect(calls.filter(url => url.endsWith('/resume'))).toHaveLength(1);
  act(() => result.current.updateTyped('abc'));
  act(() => result.current.onCompositionStart());
  act(() => result.current.onChange({ target: { value: 'abcni' }, nativeEvent: { isComposing: true } } as never));
  await act(async () => resolveResume(response({ remainingMs: 58000 })));
  expect(result.current.raw).toBe('abcni');
  expect(result.current.typed).toBe('abc');
  act(() => result.current.onCompositionEnd({ currentTarget: { value: 'abcd' } } as never));
  expect(result.current.typed).toBe('abcd');
  expect(result.current.phase).toBe('running');
  now = 22000; await act(() => result.current.pause());
  expect(result.current.elapsedMs).toBe(4000);
  vi.unstubAllGlobals();
});
it('resumes on a real correction but not an empty boundary backspace', async () => {
  const { result } = renderHook(() => usePractice(config, null));
  act(() => result.current.updateTyped('ab'));
  now = 1000; await act(() => result.current.pause());
  await act(() => result.current.resume());
  now = 5000; act(() => result.current.deletePreviousCharacter());
  expect(result.current.typed).toBe('a');
  expect(result.current.backspaces).toBe(1);
  now = 6000; await act(() => result.current.pause());
  expect(result.current.elapsedMs).toBe(2000);
});

it('cancels the armed state without counting time or accepting further input', async () => {
  const { result } = renderHook(() => usePractice(config, null));
  act(() => result.current.updateTyped('a'));
  now = 1000; await act(() => result.current.pause());
  await act(() => result.current.resume());
  expect(result.current.awaitingResumeInput).toBe(true);
  await act(() => result.current.pause());
  now = 9000; act(() => result.current.updateTyped('ab'));
  expect(result.current.typed).toBe('a');
  expect(result.current.elapsedMs).toBe(1000);
  expect(result.current.awaitingResumeInput).toBe(false);
});
