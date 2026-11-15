// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { MistakesView } from '../src/components/MistakesView';
import type { MistakeStatus, PracticeRecord } from '../src/lib/models';

afterEach(cleanup);
const record: PracticeRecord = { recordId: 'r', language: 'zh', difficulty: 'beginner', duration: 300, speed: 10, accuracy: 50, finishedAt: Date.now(),
  article: { id: 'a', title: '春', text: '春风细雨', language: 'zh', difficulty: 'beginner', custom: false },
  mistakes: [{ position: 0, expected: '春', actual: '村' }, { position: 0, expected: '春', actual: '椿' }, { position: 1, expected: '风', actual: '封' }], mistakesTruncated: true };
function Harness() {
  const [states, setStates] = useState<Record<string, MistakeStatus>>({});
  return <MistakesView records={[record]} states={states} onStatus={(id, status) => setStates((previous) => {
    const next = { ...previous }; if (status) next[id] = status; else delete next[id]; return next;
  })} onPractice={() => {}} />;
}

it('selects visible mistakes, filters by frequency and restores ignored or mastered entries', () => {
  render(<Harness />);
  expect(screen.getByText('错字样本可能不完整')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '全选' }));
  expect((screen.getByRole('checkbox', { name: '春' }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('checkbox', { name: '风' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '取消全选' }));
  expect((screen.getByRole('checkbox', { name: '春' }) as HTMLInputElement).checked).toBe(false);
  fireEvent.change(screen.getByLabelText('频次'), { target: { value: '2' } });
  expect(screen.queryByRole('checkbox', { name: '风' })).toBeNull();
  fireEvent.change(screen.getByLabelText('频次'), { target: { value: '' } });
  const spring = screen.getByRole('checkbox', { name: '春' }).closest('li')!;
  fireEvent.click(within(spring).getByRole('button', { name: '标记已掌握' }));
  expect(screen.queryByRole('checkbox', { name: '春' })).toBeNull();
  fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'mastered' } });
  fireEvent.click(within(screen.getByRole('checkbox', { name: '春' }).closest('li')!).getByRole('button', { name: '取消掌握' }));
  fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'active' } });
  const wind = screen.getByRole('checkbox', { name: '风' }).closest('li')!;
  fireEvent.click(within(wind).getByRole('button', { name: '忽略' }));
  fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'ignored' } });
  fireEvent.click(within(screen.getByRole('checkbox', { name: '风' }).closest('li')!).getByRole('button', { name: '恢复' }));
  fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'active' } });
  expect(screen.getByRole('checkbox', { name: '风' })).toBeTruthy();
});
