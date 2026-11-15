// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthDialog } from '../src/components/AuthDialog';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('keeps independent cooldowns for each email and code purpose', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal('fetch', fetcher);
  render(<AuthDialog onClose={() => {}} onLogin={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: '邮箱验证码' }));
  const dialog = screen.getByRole('dialog');
  const email = within(dialog).getByLabelText('邮箱');
  fireEvent.change(email, { target: { value: 'Reader@example.test' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '获取验证码' }));
  await waitFor(() => expect(within(dialog).getByText('验证码请求已提交。')).toBeTruthy());
  expect((within(dialog).getByRole('button', { name: /秒后重发/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(email, { target: { value: 'other@example.test' } });
  expect((within(dialog).getByRole('button', { name: '获取验证码' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.change(email, { target: { value: 'reader@example.test' } });
  expect((within(dialog).getByRole('button', { name: /秒后重发/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: '忘记密码？' }));
  expect((within(dialog).getByRole('button', { name: '获取验证码' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(within(dialog).getByRole('button', { name: '返回登录' }));
  fireEvent.click(within(dialog).getByRole('tab', { name: '邮箱验证码' }));
  expect((within(dialog).getByRole('button', { name: /秒后重发/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetcher).toHaveBeenCalledOnce();
});

it('keeps the request available and shows a delivery failure', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: '邮件发送失败，请稍后再试' }), { status: 503 })));
  render(<AuthDialog onClose={() => {}} onLogin={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: '创建账号' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('邮箱'), { target: { value: 'reader@example.test' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '获取验证码' }));
  await act(async () => {});
  expect(within(dialog).getByRole('alert').textContent).toBe('邮件发送失败，请稍后再试');
  expect((within(dialog).getByRole('button', { name: '获取验证码' }) as HTMLButtonElement).disabled).toBe(false);
});

it('allows another request when the 60 second cooldown expires', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }))));
  render(<AuthDialog onClose={() => {}} onLogin={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: '创建账号' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('邮箱'), { target: { value: 'reader@example.test' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '获取验证码' }));
  await act(async () => {});
  expect((within(dialog).getByRole('button', { name: '60 秒后重发' }) as HTMLButtonElement).disabled).toBe(true);
  act(() => { vi.advanceTimersByTime(60_000); });
  expect((within(dialog).getByRole('button', { name: '获取验证码' }) as HTMLButtonElement).disabled).toBe(false);
});
