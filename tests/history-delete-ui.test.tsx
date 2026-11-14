// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RecordsView } from '../src/components/RecordsView';
import type { PracticeRecord } from '../src/lib/models';

afterEach(cleanup);
it('confirms single and batch deletion and retains the selection on failure', async () => {
  const records: PracticeRecord[] = [1, 2].map((i) => ({ recordId: String(i), language: 'zh', difficulty: 'beginner', duration: 300,
    speed: i * 10, accuracy: 90, finishedAt: 1000 + i, article: { id: String(i), title: `文章 ${i}`, text: '山海', language: 'zh', difficulty: 'beginner', custom: true } }));
  const remove = vi.fn().mockRejectedValueOnce(new Error('连接失败')).mockResolvedValue(undefined);
  render(<RecordsView records={records} onReplay={() => {}} onContinue={() => {}} onDelete={remove} />);
  fireEvent.click(screen.getByRole('button', { name: '删除《文章 1》' }));
  let dialog = screen.getByRole('dialog', { name: '删除记录' });
  expect(within(dialog).getByText(/公开成绩/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: '删除' }));
  expect((await within(dialog).findByRole('alert')).textContent).toContain('连接失败');
  fireEvent.click(within(dialog).getByRole('button', { name: '删除' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '删除记录' })).toBeNull());
  expect(remove.mock.calls[0][0].map((record: PracticeRecord) => record.recordId)).toEqual(['1']);
  fireEvent.click(screen.getByRole('checkbox', { name: '选择《文章 1》' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '选择《文章 2》' }));
  fireEvent.click(screen.getByRole('button', { name: '删除所选（2）' }));
  dialog = screen.getByRole('dialog', { name: '删除记录' });
  fireEvent.click(within(dialog).getByRole('button', { name: '删除' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '删除记录' })).toBeNull());
  expect(remove.mock.calls[2][0].map((record: PracticeRecord) => record.recordId).sort()).toEqual(['1', '2']);
});
