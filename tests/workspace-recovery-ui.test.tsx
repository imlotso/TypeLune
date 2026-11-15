// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkspaceRecoveryDialog } from '../src/components/WorkspaceRecoveryDialog';

afterEach(cleanup);
it('offers local export and requires confirmation before replacing local data', async () => {
  const reset = vi.fn(async () => {});
  render(<WorkspaceRecoveryDialog user={{ id: 'u', username: 'reader', email: 'reader@example.test', isAdmin: false }} reason="generation" onReset={reset} onClose={() => {}} />);
  expect(screen.getByRole('button', { name: '导出本机资料' })).toBeTruthy();
  const button = screen.getByRole('button', { name: '重新同步' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: '我已备份或确认放弃本机未同步资料' }));
  fireEvent.click(button);
  await waitFor(() => expect(reset).toHaveBeenCalledOnce());
});
