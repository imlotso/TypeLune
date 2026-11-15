// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { RecordsView } from '../src/components/RecordsView';
import type { PracticeRecord } from '../src/lib/models';

afterEach(cleanup);
it('combines filters and loads more matching records without losing detail actions', () => {
  const records: PracticeRecord[] = Array.from({ length: 24 }, (_, i) => ({
    recordId: String(i), language: 'zh', difficulty: 'beginner', duration: 300, speed: 40, accuracy: 90,
    finishedAt: new Date(2026, 10, 15, 12, i).getTime(), mode: 'timed', strict: i % 2 === 0,
    article: { id: String(i), title: `文章 ${i}`, text: '春风', language: 'zh', difficulty: 'beginner', custom: true }, typed: '春风',
  }));
  render(<RecordsView onDelete={async () => {}} records={records} onReplay={() => {}} onContinue={() => {}} />);
  expect(screen.getAllByRole('button', { name: /详情$/ })).toHaveLength(20);
  fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
  expect(screen.getAllByRole('button', { name: /详情$/ })).toHaveLength(24);
  fireEvent.click(screen.getByText('筛选'));
  fireEvent.change(screen.getByLabelText('文章'), { target: { value: '文章 1' } });
  fireEvent.change(screen.getByLabelText('严格纠错'), { target: { value: 'yes' } });
  expect(screen.queryByRole('button', { name: '《文章 1》详情' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '《文章 10》详情' }));
  expect(within(screen.getByRole('dialog', { name: '练习详情' })).getByRole('button', { name: '重练' })).toBeTruthy();
});
