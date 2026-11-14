// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsTransferDialog } from '../src/components/SettingsTransferDialog';
import { defaultSettings } from '../src/lib/models';
import { exportPracticeSettings } from '../src/lib/practice-settings';

afterEach(cleanup);
it('previews a validated settings file and applies it only after confirmation', async () => {
  const apply = vi.fn(async () => {});
  render(<SettingsTransferDialog settings={defaultSettings} language="zh" difficulty="beginner" onImport={apply} onClose={() => {}} />);
  const valid = exportPracticeSettings({ ...defaultSettings, minutes: 12 }, 'en', 'advanced');
  const input = screen.getByLabelText('选择设置 JSON');
  fireEvent.change(input, { target: { files: [new File([valid], 'settings.json', { type: 'application/json' })] } });
  expect(await screen.findByText(/English · 挑战 · 限时 12 分钟/)).toBeTruthy();
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认导入' }));
  await waitFor(() => expect(apply).toHaveBeenCalledOnce());
});

it('rejects malformed or unsupported configuration and keeps the import action unavailable', async () => {
  const apply = vi.fn(async () => {});
  render(<SettingsTransferDialog settings={defaultSettings} language="zh" difficulty="beginner" onImport={apply} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText('选择设置 JSON'), { target: { files: [new File(['{"version":99}'], 'bad.json', { type: 'application/json' })] } });
  expect((await screen.findByRole('alert')).textContent).toContain('无效');
  expect(screen.queryByRole('button', { name: '确认导入' })).toBeNull();
  expect(apply).not.toHaveBeenCalled();
});

it('reports invalid UTF-8 without applying a file', async () => {
  const apply = vi.fn(async () => {});
  render(<SettingsTransferDialog settings={defaultSettings} language="zh" difficulty="beginner" onImport={apply} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText('选择设置 JSON'), { target: { files: [new File([new Uint8Array([0xff])], 'bad.json')] } });
  expect((await screen.findByRole('alert')).textContent).toContain('UTF-8');
  expect(apply).not.toHaveBeenCalled();
});
