// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RecordsView } from '../src/components/RecordsView';
import type { PracticeRecord } from '../src/lib/models';

afterEach(cleanup);
it('does not offer recovery after the server has finalized a score', () => {
  const record: PracticeRecord = { recordId: 'round', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 100, finishedAt: 1000,
    scoreStatus: { state: 'rejected', eligible: false, message: '管理员复核未通过。' }, article: { id: 'a', title: '文章', text: '山海', language: 'zh', difficulty: 'beginner', custom: false } };
  const recover = vi.fn();
  render(<RecordsView records={[record]} onReplay={() => {}} onContinue={() => {}} onDelete={async () => {}} recoveryFor={() => ({ available: true, recover })} />);
  fireEvent.click(screen.getByRole('button', { name: '《文章》详情' }));
  const detail = screen.getByRole('dialog', { name: '练习详情' });
  expect(within(detail).getByText('无法恢复：成绩已提交或审核结束')).toBeTruthy();
  expect(within(detail).queryByRole('button', { name: '恢复成绩' })).toBeNull();
  expect(recover).not.toHaveBeenCalled();
});
