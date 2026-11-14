// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GuestImportDialog } from '../src/components/GuestImportDialog';
import { putWorkspaceValue, readWorkspace } from '../src/lib/workspace';

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });
it('retains guest copies until imported values are confirmed in the cloud and asks before clearing', async () => {
  await putWorkspaceValue(null, 'favorite', 'guest-article', { articleId: 'guest-article' });
  let cloudReady = false;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ protocol: 2, generation: 1, serverTime: Date.now(),
    items: cloudReady ? (await readWorkspace('alice')).map((item) => ({ ...item, serverRevision: 1 })) : [] }))));
  const sync = vi.fn(async () => {});
  render(<GuestImportDialog ownerId="alice" syncState="synced" cloudLoaded onSync={sync} onClose={() => {}} />);
  expect(await screen.findByText('收藏：1 项')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '导入游客资料' }));
  expect((await screen.findByRole('alert')).textContent).toContain('尚未全部同步');
  expect((await readWorkspace(null)).some((item) => item.id === 'guest-article')).toBe(true);
  expect(screen.queryByRole('button', { name: '清除游客副本' })).toBeNull();
  cloudReady = true;
  fireEvent.click(screen.getByRole('button', { name: '重试导入和同步' }));
  await waitFor(() => expect(screen.getByText(/已同步 1 项/)).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: '清除游客副本' }));
  const confirm = screen.getByRole('dialog', { name: '清除游客副本？' });
  fireEvent.click(within(confirm).getByRole('button', { name: '保留' }));
  expect((await readWorkspace(null)).some((item) => item.id === 'guest-article')).toBe(true);
});
