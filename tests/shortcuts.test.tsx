// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useShortcuts } from '../src/hooks/useShortcuts';

afterEach(cleanup);
it('routes recognized shortcuts while respecting composition, other forms and dialogs', () => {
  const action = vi.fn(() => true);
  const { rerender } = renderHook(({ enabled }) => useShortcuts(enabled, action), { initialProps: { enabled: true } });
  const dom = render(<><textarea aria-label="练习" data-practice-input="true" /><input aria-label="搜索" /></>);
  const practice = dom.getByLabelText('练习');
  const search = dom.getByLabelText('搜索');
  fireEvent.keyDown(practice, { code: 'KeyP', key: 'p', altKey: true });
  expect(action).toHaveBeenLastCalledWith('pause');
  const count = action.mock.calls.length;
  fireEvent.compositionStart(practice);
  fireEvent.keyDown(practice, { code: 'KeyP', key: 'p', altKey: true });
  fireEvent.compositionEnd(practice);
  fireEvent.keyDown(search, { code: 'KeyR', key: 'r', altKey: true });
  fireEvent.keyDown(practice, { code: 'KeyP', key: 'π', altKey: true });
  fireEvent.keyDown(practice, { code: 'KeyP', key: 'p', altKey: true, keyCode: 229 });
  expect(action).toHaveBeenCalledTimes(count);
  const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); document.body.append(dialog);
  fireEvent.keyDown(practice, { code: 'KeyK', key: 'k', altKey: true });
  dialog.remove();
  expect(action).toHaveBeenCalledTimes(count);
  fireEvent.keyDown(practice, { code: 'Digit2', key: '@', ctrlKey: true, shiftKey: true });
  expect(action).toHaveBeenLastCalledWith('library');
  rerender({ enabled: false });
  fireEvent.keyDown(practice, { code: 'KeyP', key: 'p', altKey: true });
  expect(action).toHaveBeenCalledTimes(count + 1);
});

it('leaves Escape and unavailable actions to the browser or existing handlers', () => {
  const action = vi.fn(() => false);
  renderHook(() => useShortcuts(true, action));
  const input = document.createElement('textarea'); input.setAttribute('data-practice-input', 'true'); document.body.append(input);
  const escape = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
  expect(input.dispatchEvent(escape)).toBe(true);
  expect(action).not.toHaveBeenCalled();
  const unavailable = new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', altKey: true, bubbles: true, cancelable: true });
  expect(input.dispatchEvent(unavailable)).toBe(true);
  expect(action).toHaveBeenCalledWith('pause');
  const altGraph = new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', altKey: true, bubbles: true, cancelable: true });
  Object.defineProperty(altGraph, 'getModifierState', { value: (key: string) => key === 'AltGraph' });
  expect(input.dispatchEvent(altGraph)).toBe(true);
  expect(action).toHaveBeenCalledTimes(1);
  input.remove();
});

it('clears an abandoned composition after the window loses focus', () => {
  const action = vi.fn(() => true);
  renderHook(() => useShortcuts(true, action));
  const { getByLabelText } = render(<textarea aria-label="练习" data-practice-input="true" />);
  const input = getByLabelText('练习');
  fireEvent.compositionStart(input);
  fireEvent.blur(window);
  fireEvent.keyDown(input, { code: 'KeyP', key: 'p', altKey: true });
  expect(action).toHaveBeenCalledWith('pause');
});
