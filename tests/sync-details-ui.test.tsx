// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsDialog } from '../src/components/SettingsDialog';
import { defaultSettings } from '../src/lib/models';

afterEach(cleanup);
it('shows a partial sync failure, pending count and the last successful time', () => {
  render(<SettingsDialog settings={defaultSettings} onChange={() => {}} locked={false} onClose={() => {}} onFocus={() => {}} focused={false}
    syncState="error" syncError="1 项资料无法同步，已保存在本机" pendingCount={1} cloudCount={3} lastSyncedAt={1_800_000_000_000} onSync={() => {}} isSignedIn />);
  expect(screen.getByText('同步失败')).toBeTruthy();
  expect(screen.getByText('1 项资料无法同步，已保存在本机')).toBeTruthy();
  expect(screen.getByText('未同步：1 项')).toBeTruthy();
  expect(screen.getByText('上次读取云端：3 项')).toBeTruthy();
  expect(screen.getByText(/最近成功同步/)).toBeTruthy();
  expect(screen.getByRole('button', { name: '立即同步' })).toBeTruthy();
});

it('offers an explicit recovery flow instead of a retry that cannot resolve a stale generation', () => {
  const recover = vi.fn();
  render(<SettingsDialog settings={defaultSettings} onChange={() => {}} locked={false} onClose={() => {}} onFocus={() => {}} focused={false}
    syncState="error" syncError="云端资料已整理" recoveryReason="generation" onRecovery={recover} onSync={() => {}} isSignedIn />);
  expect(screen.queryByRole('button', { name: '立即同步' })).toBeNull();
  screen.getByRole('button', { name: '处理同步冲突' }).click();
  expect(recover).toHaveBeenCalledOnce();
});
