// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { SettingsDialog } from '../src/components/SettingsDialog';
import { defaultSettings } from '../src/lib/models';

afterEach(cleanup);
it('defaults each live indicator to visible and changes them independently', () => {
  function Harness() {
    const [settings, setSettings] = useState(defaultSettings);
    return <SettingsDialog settings={settings} onChange={(patch) => setSettings((old) => ({ ...old, ...patch }))} locked={false} onClose={() => {}} onFocus={() => {}} focused={false} syncState="guest" onSync={() => {}} isSignedIn={false} />;
  }
  render(<Harness />);
  const dialog = screen.getByRole('dialog', { name: '练习设置' });
  const timer = within(dialog).getByRole('checkbox', { name: '显示计时' }) as HTMLInputElement;
  const speed = within(dialog).getByRole('checkbox', { name: '显示速度' }) as HTMLInputElement;
  const accuracy = within(dialog).getByRole('checkbox', { name: '显示准确率' }) as HTMLInputElement;
  expect([timer.checked, speed.checked, accuracy.checked]).toEqual([true, true, true]);
  fireEvent.click(speed);
  expect([timer.checked, speed.checked, accuracy.checked]).toEqual([true, false, true]);
});

it('shows a toggle immediately and restores it if local persistence fails', async () => {
  let reject!: (error: Error) => void;
  const pending = new Promise<void>((_resolve, fail) => { reject = fail; });
  render(<SettingsDialog settings={defaultSettings} onChange={() => pending} locked={false} onClose={() => {}} onFocus={() => {}} focused={false} syncState="guest" onSync={() => {}} isSignedIn={false} />);
  const speed = screen.getByRole('checkbox', { name: '显示速度' }) as HTMLInputElement;
  fireEvent.click(speed);
  expect(speed.checked).toBe(false);
  await act(async () => reject(new Error('storage failed')));
  await waitFor(() => expect(speed.checked).toBe(true));
  expect(screen.getByRole('alert').textContent).toContain('设置保存失败');
});

it('keeps the latest toggle visible while earlier saves complete', async () => {
  const completions: Array<() => void> = [];
  function Harness() {
    const [settings, setSettings] = useState(defaultSettings);
    return <SettingsDialog settings={settings} onChange={(patch) => new Promise<void>((resolve) => completions.push(() => { setSettings((old) => ({ ...old, ...patch })); resolve(); }))}
      locked={false} onClose={() => {}} onFocus={() => {}} focused={false} syncState="guest" onSync={() => {}} isSignedIn={false} />;
  }
  render(<Harness />);
  const speed = screen.getByRole('checkbox', { name: '显示速度' }) as HTMLInputElement;
  fireEvent.click(speed);
  fireEvent.click(speed);
  expect(speed.checked).toBe(true);
  await act(async () => completions[0]());
  expect(speed.checked).toBe(true);
  await act(async () => completions[1]());
  expect(speed.checked).toBe(true);
});
