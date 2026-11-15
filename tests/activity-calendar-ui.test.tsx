// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ActivityCalendar } from '../src/components/ActivityCalendar';
import type { PracticeRecord } from '../src/lib/models';

afterEach(() => { cleanup(); vi.useRealTimers(); });
it('shows available streak coverage and opens a selected day record', () => {
  const record: PracticeRecord = { recordId: 'one', language: 'zh', difficulty: 'beginner', duration: 300, speed: 30, accuracy: 90,
    finishedAt: Date.parse('2026-11-14T16:01:00Z'), elapsedMs: 60_000,
    article: { id: 'a', title: '文章', text: '山海', language: 'zh', difficulty: 'beginner', custom: true } };
  const open = vi.fn();
  render(<ActivityCalendar records={[record, { ...record, recordId: 'two', elapsedMs: undefined }]} timeZone="Asia/Shanghai" goalMinutes={5} coverage="partial" onOpenRecord={open} onSave={async () => {}} now={Date.parse('2026-11-15T12:00:00Z')} />);
  expect(screen.getByText('已读取范围最长')).toBeTruthy();
  expect(screen.getByText(/部分用时未知/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /2026-11-15，2 次/ }));
  const list = screen.getByRole('list', { name: '当日记录' });
  fireEvent.click(within(list).getAllByRole('button', { name: /查看记录/ })[0]);
  expect(open).toHaveBeenCalled();
});
it('validates settings and saves the time zone and daily goal', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<ActivityCalendar records={[]} timeZone="UTC" goalMinutes={0} coverage="local" onOpenRecord={() => {}} onSave={save} now={Date.parse('2026-11-15T12:00:00Z')} />);
  fireEvent.click(screen.getByText('日历设置'));
  fireEvent.change(screen.getByLabelText('统计时区'), { target: { value: 'Invalid/Place' } });
  fireEvent.change(screen.getByLabelText('每日目标（分钟，0 为关闭）'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: '保存日历设置' }));
  expect((await screen.findByRole('alert')).textContent).toContain('时区');
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('统计时区'), { target: { value: 'Asia/Shanghai' } });
  fireEvent.click(screen.getByRole('button', { name: '保存日历设置' }));
  expect(await screen.findByText('已保存在本机')).toBeTruthy();
  expect(save).toHaveBeenCalledWith({ statisticsTimezone: 'Asia/Shanghai', dailyGoalMinutes: 20 });
});


it('does not overwrite unsaved calendar settings when another device updates them', () => {
  const props = { records: [] as PracticeRecord[], timeZone: 'UTC', goalMinutes: 0, coverage: 'complete' as const, onOpenRecord: () => {}, onSave: async () => {}, now: Date.parse('2026-11-15T12:00:00Z') };
  const view = render(<ActivityCalendar {...props} />);
  fireEvent.click(screen.getByText('日历设置'));
  fireEvent.change(screen.getByLabelText('统计时区'), { target: { value: 'Asia/Tokyo' } });
  view.rerender(<ActivityCalendar {...props} timeZone="Asia/Shanghai" goalMinutes={15} />);
  expect((screen.getByLabelText('统计时区') as HTMLInputElement).value).toBe('Asia/Tokyo');
  expect(screen.getByText('设置已在其他设备更新，请确认后保存')).toBeTruthy();
});


it('labels a browser-only fallback time zone as temporary', () => {
  render(<ActivityCalendar records={[]} timeZone="UTC" goalMinutes={0} coverage="partial" provisional now={Date.parse('2026-11-15T12:00:00Z')} />);
  expect(screen.getByText(/本机临时时区：UTC/)).toBeTruthy();
});


it('updates today when the selected time zone crosses midnight', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T23:59:30Z'));
  render(<ActivityCalendar records={[]} timeZone="UTC" goalMinutes={0} coverage="local" />);
  expect(screen.getByRole('heading', { name: '2026-11-15' })).toBeTruthy();
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(screen.getByRole('heading', { name: '2026-11-16' })).toBeTruthy();
});
