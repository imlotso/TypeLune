// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthDialog } from '../src/components/AuthDialog';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('toggles the password without submitting or losing its value, focus or selection', async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ user: { id: '1', username: 'reader' } })));
  vi.stubGlobal('fetch', fetcher);
  const onLogin = vi.fn();
  render(<AuthDialog onClose={() => {}} onLogin={onLogin} />);
  const dialog = screen.getByRole('dialog', { name: '登录' });
  const input = within(dialog).getByLabelText('密码') as HTMLInputElement;
  expect(input.type).toBe('password');
  expect(input.autocomplete).toBe('current-password');
  await user.type(input, 'a-long-password');
  input.setSelectionRange(2, 6);
  await user.click(within(dialog).getByRole('button', { name: '显示密码' }));
  expect(input.type).toBe('text');
  expect(within(dialog).getByRole('textbox', { name: '密码' })).toBe(input);
  expect(input.value).toBe('a-long-password');
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([2, 6]);
  expect(fetcher).not.toHaveBeenCalled();
  expect(within(dialog).getByRole('button', { name: '隐藏密码' }).getAttribute('aria-pressed')).toBe('true');
  await user.click(within(dialog).getByRole('button', { name: '隐藏密码' }));
  expect(input.type).toBe('password');
  await user.type(within(dialog).getByLabelText('用户名或邮箱'), 'reader');
  await user.click(input);
  await user.keyboard('{Enter}');
  await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
  expect(fetcher).toHaveBeenCalledOnce();
});

it('resets visibility between login, registration and reset forms', () => {
  render(<AuthDialog onClose={() => {}} onLogin={() => {}} />);
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: '显示密码' }));
  fireEvent.click(within(dialog).getByRole('button', { name: '创建账号' }));
  let input = within(dialog).getByLabelText('密码') as HTMLInputElement;
  expect(input.type).toBe('password');
  expect(input.autocomplete).toBe('new-password');
  fireEvent.click(within(dialog).getByRole('button', { name: '显示密码' }));
  fireEvent.click(within(dialog).getByRole('button', { name: '忘记密码？' }));
  input = within(dialog).getByLabelText('新密码') as HTMLInputElement;
  expect(input.type).toBe('password');
  expect(input.autocomplete).toBe('new-password');
  fireEvent.click(within(dialog).getByRole('button', { name: '显示密码' }));
  expect(input.type).toBe('text');
  fireEvent.click(within(dialog).getByRole('button', { name: '隐藏密码' }));
  expect(input.type).toBe('password');
});
