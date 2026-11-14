// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkspaceCapacity } from '../src/components/WorkspaceCapacity';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows real capacity and requires a warning before reclaiming deleted items', async () => {
  const fetcher = vi.fn(async (path: string, options?: RequestInit) => {
    if (path.endsWith('/usage')) return new Response(JSON.stringify({ count: 22, bytes: 1024, tombstones: 3, maxItems: 2000, maxBytes: 33554432, generation: 1, types: [{ kind: 'favorite', count: 20, bytes: 1024, tombstones: 3 }, { kind: 'settings', count: 1, bytes: 0, tombstones: 0 }, { kind: 'background', count: 1, bytes: 0, tombstones: 0 }] }));
    expect(options?.method).toBe('POST');
    expect(JSON.parse(String(options?.body))).toEqual({ generation: 1 });
    return new Response(JSON.stringify({ generation: 2, removed: 3 }));
  });
  vi.stubGlobal('fetch', fetcher);
  const compacted = vi.fn();
  const manage = vi.fn(); const resetSettings = vi.fn(async () => {});
  render(<WorkspaceCapacity ownerId="alice" onCompacted={compacted} onManage={manage} onResetSettings={resetSettings} />);
  expect(await screen.findByText(/22 \/ 2000 项/)).toBeTruthy();
  expect(screen.getByText(/收藏：20 项，已删除 3 项/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '管理收藏' }));
  expect(manage).toHaveBeenCalledWith('favorite');
  fireEvent.click(screen.getByRole('button', { name: '管理夜间背景' }));
  expect(manage).toHaveBeenCalledWith('background-dark');
  fireEvent.click(screen.getByRole('button', { name: '清除设置' }));
  expect(screen.getByText(/预设、错字状态和统计目标/)).toBeTruthy();
  expect(resetSettings).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认清除设置' }));
  await waitFor(() => expect(resetSettings).toHaveBeenCalledOnce());
  expect(screen.getByText('设置已在本机清除，等待同步')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '整理删除标记' }));
  expect(screen.getByText(/其他设备需要重新同步/)).toBeTruthy();
  expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '确认整理' }));
  await waitFor(() => expect(compacted).toHaveBeenCalledOnce());
  expect(fetcher).toHaveBeenCalledTimes(2);
});
