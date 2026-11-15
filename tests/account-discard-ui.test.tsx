// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AccountDialog } from '../src/components/AccountDialog';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('protects unsaved profile and email fields while allowing discard', () => {
  const close = vi.fn();
  render(<AccountDialog user={{ id: 'user', username: 'reader', email: 'reader@example.test', isAdmin: false }} onClose={close} onUpdate={() => {}} onSignedOut={() => {}} onDelete={async () => {}} />);
  fireEvent.change(screen.getByLabelText('公开昵称'), { target: { value: '未保存昵称' } });
  fireEvent.click(screen.getByText('更换邮箱'));
  fireEvent.change(screen.getByLabelText('新邮箱'), { target: { value: 'new@example.test' } });
  fireEvent.change(screen.getByLabelText('当前密码（邮箱）'), { target: { value: 'typed-password' } });
  fireEvent.click(screen.getByRole('button', { name: '显示当前密码（邮箱）' }));
  expect((screen.getByLabelText('当前密码（邮箱）') as HTMLInputElement).type).toBe('text');
  (screen.getByLabelText('当前密码（邮箱）') as HTMLInputElement).focus();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  const confirm = screen.getByRole('dialog', { name: '放弃未保存的修改？' });
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(within(confirm).getByRole('button', { name: '继续编辑' }));
  expect((screen.getByLabelText('公开昵称') as HTMLInputElement).value).toBe('未保存昵称');
  expect((screen.getByLabelText('新邮箱') as HTMLInputElement).value).toBe('new@example.test');
  expect((screen.getByLabelText('当前密码（邮箱）') as HTMLInputElement).value).toBe('typed-password');
  expect((screen.getByLabelText('当前密码（邮箱）') as HTMLInputElement).type).toBe('password');
  expect(document.activeElement?.closest('[role=dialog]')).toBe(screen.getByRole('dialog', { name: '账号设置' }));
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '放弃未保存的修改？' })).getByRole('button', { name: '放弃修改' }));
  expect(close).toHaveBeenCalledOnce();
});


it('disables account input while a profile update is pending', async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
  render(<AccountDialog user={{ id: 'user', username: 'reader', email: 'reader@example.test', isAdmin: false }} onClose={() => {}} onUpdate={() => {}} onSignedOut={() => {}} onDelete={async () => {}} />);
  fireEvent.change(screen.getByLabelText('公开昵称'), { target: { value: '新昵称' } });
  fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  expect((screen.getByLabelText('公开昵称') as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByLabelText('头像') as HTMLSelectElement).disabled).toBe(true);
  await act(async () => finish(new Response(JSON.stringify({ user: { id: 'user', username: 'reader', email: 'reader@example.test', isAdmin: false, displayName: '新昵称' } }))));
});
