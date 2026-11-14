// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StatsView } from '../src/components/StatsView';
import type { PracticeRecord } from '../src/lib/models';

afterEach(cleanup);
it('shows separate comparable trends and opens a selected record', () => {
  const base: PracticeRecord = { recordId: 'one', language: 'zh', difficulty: 'beginner', duration: 300, mode: 'timed', strict: false,
    speed: 30, accuracy: 90, finishedAt: Date.now(), elapsedMs: 60_000,
    article: { id: 'a', title: '文章', text: '山海', language: 'zh', difficulty: 'beginner', custom: false } };
  const open = vi.fn();
  render(<StatsView records={[base, { ...base, recordId: 'two', duration: 600, speed: 50, elapsedMs: undefined }]} coverage="partial" onOpenRecord={open} />);
  expect(screen.getByText('统计基于已读取的记录')).toBeTruthy();
  expect(screen.getByText('1 条记录缺少有效用时')).toBeTruthy();
  const groups = screen.getAllByRole('region', { name: /同条件统计/ });
  expect(groups).toHaveLength(2);
  const lower = groups.find((group) => within(group).queryAllByText('30 字/分').length)!;
  expect(groups.some((group) => within(group).queryAllByText('50 字/分').length > 0)).toBe(true);
  fireEvent.click(within(lower).getByRole('button', { name: /查看记录/ }));
  expect(open).toHaveBeenCalledWith('one');
  fireEvent.change(screen.getByLabelText('统计时长'), { target: { value: '600' } });
  expect(screen.getAllByRole('region', { name: /同条件统计/ })).toHaveLength(1);
});

it('keeps older points and days reachable without rendering the whole history at once', () => {
  const now = Date.now();
  const records: PracticeRecord[] = Array.from({ length: 31 }, (_, index) => ({ recordId: `r-${index}`, language: 'zh', difficulty: 'beginner', duration: 300, mode: 'timed', strict: false,
    speed: 30, accuracy: 90, finishedAt: now - index * 86_400_000, elapsedMs: 1000,
    article: { id: 'a', title: '文章', text: '山海', language: 'zh', difficulty: 'beginner', custom: false } }));
  render(<StatsView records={records} coverage="complete" onOpenRecord={() => {}} timeZone="UTC" />);
  fireEvent.change(screen.getByLabelText('统计时间范围'), { target: { value: 'all' } });
  const group = screen.getByRole('region', { name: /同条件统计/ });
  expect(within(group).getAllByRole('button', { name: /查看记录/ })).toHaveLength(1);
  fireEvent.click(within(group).getByRole('button', { name: '上一页' }));
  expect(within(group).getAllByRole('button', { name: /查看记录/ })).toHaveLength(30);
  expect(within(group).getAllByRole('row')).toHaveLength(31);
  fireEvent.click(within(group).getByRole('button', { name: '加载更多日期' }));
  expect(within(group).getAllByRole('row')).toHaveLength(32);
});
