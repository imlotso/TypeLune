// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LogoutDialog } from '../src/components/LogoutDialog';

afterEach(cleanup);
it('requires an explicit decision before discarding unsynced account data', async () => {
  const logout = vi.fn(async () => {});
  render(<LogoutDialog user={{ id: 'u', username: 'reader', email: 'reader@example.test', isAdmin: false }}
    pendingCount={2} syncState="error" syncError="连接失败" onSync={async () => {}} onLogout={logout} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('checkbox', { name: '同时清除此设备的账号数据' }));
  expect(screen.getByText(/2 项资料尚未同步/)).toBeTruthy();
  expect(screen.getByRole('button', { name: '立即同步' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '导出个人数据' })).toBeTruthy();
  const submit = screen.getByRole('button', { name: '确认退出' }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: '确认放弃未同步资料' }));
  fireEvent.click(submit);
  await waitFor(() => expect(logout).toHaveBeenCalledWith(true));
});
