// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CommandPalette } from '../src/components/CommandPalette';

afterEach(cleanup);
it('filters functional commands and invokes the selected action', async () => {
  const run = vi.fn();
  render(<CommandPalette shortcutsEnabled commands={[{ id: 'library', label: '文章库', shortcut: 'Ctrl+Shift+2', run }, { id: 'settings', label: '练习设置', shortcut: 'Alt+S', run }]} onClose={() => {}} />);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: '搜索功能' })));
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索功能' }), { target: { value: '文章' } });
  expect(screen.queryByRole('button', { name: /练习设置/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /文章库/ }));
  await waitFor(() => expect(run).toHaveBeenCalledOnce());
});
