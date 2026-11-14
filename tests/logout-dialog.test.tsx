// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LogoutDialog } from '../src/components/LogoutDialog';

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });
it('requires an explicit decision before discarding unsynced account data', async () => {
  const logout = vi.fn(async () => {});
  render(<LogoutDialog user={{ id: 'u', username: 'reader', email: 'reader@example.test', isAdmin: false }}
    pendingCount={2} syncState="error" syncError="连接失败" onSync={async () => {}} onLogout={logout} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('checkbox', { name: '同时清除此设备的账号数据' }));
  expect(screen.getByText(/2 项资料尚未同步/)).toBeTruthy();
  expect(screen.getByRole('button', { name: '立即同步' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '导出个人数据' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '导出本机资料' })).toBeTruthy();
  const submit = screen.getByRole('button', { name: '确认退出' }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: '确认放弃未同步资料' }));
  fireEvent.click(submit);
  await waitFor(() => expect(logout).toHaveBeenCalledWith(true, expect.objectContaining({ riskAcknowledged: true })));
});

it('warns about unsynchronized legacy copies even when workspace sync is current', async () => {
  const logout = vi.fn(async () => {});
  const record = { recordId: 'old', ownerId: 'u', language: 'zh', difficulty: 'beginner', duration: 300, speed: 10, accuracy: 100, finishedAt: 1000 };
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([record]));
  render(<LogoutDialog user={{ id: 'u', username: 'reader', email: 'reader@example.test', isAdmin: false }}
    pendingCount={0} syncState="synced" syncError="" onSync={async () => {}} onLogout={logout} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('checkbox', { name: '同时清除此设备的账号数据' }));
  expect(screen.getByText(/1 项本机练习资料未确认同步/)).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: '确认放弃未同步资料' }));
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify([record, { ...record, recordId: 'later' }]));
  fireEvent.click(screen.getByRole('button', { name: '确认退出' }));
  expect(logout).not.toHaveBeenCalled();
  expect(screen.getByText('本机练习资料已变化，请重新确认')).toBeTruthy();
  expect(screen.getByText(/2 项本机练习资料未确认同步/)).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: '确认放弃未同步资料' }));
  fireEvent.click(screen.getByRole('button', { name: '确认退出' }));
  await waitFor(() => expect(logout).toHaveBeenCalledWith(true, expect.objectContaining({ riskAcknowledged: true })));
});
