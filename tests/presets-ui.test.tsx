// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { PresetsDialog } from '../src/components/PresetsDialog';
import { defaultSettings, type PracticePreset } from '../src/lib/models';
import { applyPresetAction } from '../src/lib/practice-settings';

afterEach(cleanup);
it('creates, applies, renames, updates and confirms deletion of a named preset', async () => {
  const apply = vi.fn(async (_preset: PracticePreset) => {});
  function Harness() {
    const [presets, setPresets] = useState<PracticePreset[]>([]);
    return <PresetsDialog settings={{ ...defaultSettings, presets }} language="zh" difficulty="beginner" onAction={async (action) => setPresets((previous) => applyPresetAction(previous, action))} onApply={apply} onClose={() => {}} />;
  }
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('预设名称'), { target: { value: '夜读' } });
  fireEvent.click(screen.getByRole('button', { name: '保存当前预设' }));
  const row = await screen.findByRole('button', { name: '应用 夜读' });
  fireEvent.click(row);
  await waitFor(() => expect(apply).toHaveBeenCalledOnce());
  expect(apply.mock.calls[0][0]).toMatchObject({ name: '夜读', language: 'zh', reading: { fontSize: 18 } });
  fireEvent.click(screen.getByRole('button', { name: '重命名 夜读' }));
  fireEvent.change(screen.getByLabelText('新预设名称'), { target: { value: '晨读' } });
  fireEvent.click(screen.getByRole('button', { name: '保存名称' }));
  await screen.findByRole('button', { name: '应用 晨读' });
  fireEvent.click(screen.getByRole('button', { name: '更新 晨读' }));
  await screen.findByText('预设已更新');
  fireEvent.click(screen.getByRole('button', { name: '删除 晨读' }));
  const confirm = screen.getByRole('dialog', { name: '删除预设？' });
  fireEvent.click(within(confirm).getByRole('button', { name: '取消' }));
  expect(screen.getByRole('button', { name: '应用 晨读' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '删除 晨读' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '删除预设？' })).getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '应用 晨读' })).toBeNull());
});

it('keeps the entered name when local saving fails', async () => {
  render(<PresetsDialog settings={defaultSettings} language="zh" difficulty="beginner" onAction={async () => { throw new Error('存储不可用'); }} onApply={async () => {}} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText('预设名称'), { target: { value: '未保存' } });
  fireEvent.click(screen.getByRole('button', { name: '保存当前预设' }));
  expect((await screen.findByRole('alert')).textContent).toContain('存储不可用');
  expect((screen.getByLabelText('预设名称') as HTMLInputElement).value).toBe('未保存');
});
