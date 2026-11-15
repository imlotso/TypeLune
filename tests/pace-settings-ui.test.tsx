// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { SettingsDialog } from '../src/components/SettingsDialog';
import { PaceIndicator } from '../src/components/PaceIndicator';
import { defaultSettings } from '../src/lib/models';

afterEach(cleanup);
it('defaults pace off and allows a custom English target or a previous-result source', () => {
  function Harness() {
    const [settings, setSettings] = useState(defaultSettings);
    return <SettingsDialog settings={settings} language="en" onChange={(patch) => setSettings((old) => ({ ...old, ...patch }))} locked={false}
      onClose={() => {}} onFocus={() => {}} focused={false} syncState="guest" onSync={() => {}} isSignedIn={false} />;
  }
  render(<Harness />);
  const enabled = screen.getByRole('checkbox', { name: '启用目标配速' }) as HTMLInputElement;
  expect(enabled.checked).toBe(false);
  fireEvent.click(enabled);
  fireEvent.change(screen.getByLabelText('目标速度（WPM）'), { target: { value: '80' } });
  expect((screen.getByLabelText('目标速度（WPM）') as HTMLInputElement).value).toBe('80');
  fireEvent.change(screen.getByLabelText('配速来源'), { target: { value: 'last' } });
  expect(screen.queryByLabelText('目标速度（WPM）')).toBeNull();
});

it('restores the prior pace setting if its local save fails', async () => {
  let reject!: (error: Error) => void;
  const pending = new Promise<void>((_resolve, fail) => { reject = fail; });
  render(<SettingsDialog settings={defaultSettings} onChange={() => pending} locked={false} onClose={() => {}} onFocus={() => {}} focused={false} syncState="guest" onSync={() => {}} isSignedIn={false} />);
  const enabled = screen.getByRole('checkbox', { name: '启用目标配速' }) as HTMLInputElement;
  fireEvent.click(enabled);
  expect(enabled.checked).toBe(true);
  await act(async () => reject(new Error('storage unavailable')));
  await waitFor(() => expect(enabled.checked).toBe(false));
  expect(screen.getByRole('alert').textContent).toContain('设置保存失败');
});

it('shows the frozen target and relative progress using the selected language unit', () => {
  const view = render(<PaceIndicator language="en" target={40} secondsAhead={-3.2} partial />);
  expect(screen.getByRole('group', { name: '目标配速' }).textContent).toContain('目标 40 WPM · 落后 3.2 秒');
  expect(screen.getByText('基于已读取的记录')).toBeTruthy();
  view.rerender(<PaceIndicator language="zh" target={60} secondsAhead={2} />);
  expect(screen.getByRole('group', { name: '目标配速' }).textContent).toContain('目标 60 字/分 · 领先 2 秒');
});
