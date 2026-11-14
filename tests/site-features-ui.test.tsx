// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthDialog } from '../src/components/AuthDialog';
import { useSiteFeatures } from '../src/hooks/useSiteFeatures';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('explains closed registration before submission while preserving login and password reset', () => {
  render(<AuthDialog onClose={() => {}} onLogin={() => {}} registrationEnabled={false} />);
  const dialog = screen.getByRole('dialog', { name: '登录' });
  expect((within(dialog).getByRole('button', { name: '创建账号' }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(dialog).getByText('当前已关闭注册')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: '忘记密码？' }));
  expect(screen.getByRole('dialog', { name: '找回密码' })).toBeTruthy();
});

it('retains a partially completed registration if the site closes registration meanwhile', () => {
  const { rerender } = render(<AuthDialog onClose={() => {}} onLogin={() => {}} registrationEnabled />);
  fireEvent.click(screen.getByRole('button', { name: '创建账号' }));
  fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'reader' } });
  rerender(<AuthDialog onClose={() => {}} onLogin={() => {}} registrationEnabled={false} />);
  expect((screen.getByLabelText('用户名') as HTMLInputElement).value).toBe('reader');
  expect((screen.getByRole('button', { name: '注册并登录' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '获取验证码' }) as HTMLButtonElement).disabled).toBe(true);
});

it('reports a feature configuration failure and allows a successful retry', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response(JSON.stringify({ registrationEnabled: false, guestPracticeEnabled: true, guestLeaderboardEnabled: false })));
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useSiteFeatures());
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.features).toBeUndefined();
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.features).toEqual({ registrationEnabled: false, guestPracticeEnabled: true, guestLeaderboardEnabled: false }));
  expect(result.current.error).toBe('');
});
