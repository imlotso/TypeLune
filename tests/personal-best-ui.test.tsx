// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { PersonalBestComparison } from '../src/components/PersonalBestComparison';
import type { PracticeRecord } from '../src/lib/models';
import { hasUnloadedLocalHistory } from '../src/hooks/usePractice';

afterEach(cleanup);
const article = { id: 'a', title: '短文', text: '山海', language: 'zh' as const, difficulty: 'beginner' as const, custom: true };
const current: PracticeRecord = { recordId: 'new', language: 'zh', difficulty: 'beginner', duration: 300, mode: 'timed', strict: false, speed: 75, accuracy: 96, finishedAt: 2000, article };

it('shows improvement and accuracy against earlier matching records, not the current result', () => {
  const prior = { ...current, recordId: 'old', speed: 60, accuracy: 90, finishedAt: 1000 };
  render(<PersonalBestComparison current={current} records={[current, prior]} coverage="local" />);
  expect(screen.getByLabelText('个人最佳与比较').textContent).toContain('提高 +15 字/分');
  expect(screen.getByText(/近 1 次平均/).textContent).toContain('60 字/分');
  expect(screen.getByText(/本次：/).textContent).toContain('准确率 +6 个百分点');
  expect(screen.getByText('仅本机记录')).toBeTruthy();
});

it('does not assert a complete account comparison while history is loading or incomplete', () => {
  const view = render(<PersonalBestComparison current={current} records={[]} coverage="loading" />);
  expect(screen.getByText('正在读取同条件记录…')).toBeTruthy();
  view.rerender(<PersonalBestComparison current={current} records={[]} coverage="partial" />);
  expect(screen.getByText('基于已读取的记录')).toBeTruthy();
  expect(screen.getByText('暂无此前同条件成绩')).toBeTruthy();
});

it('detects a legacy history larger than the local display window', () => {
  localStorage.setItem('cloudtyping.history.v1', JSON.stringify(Array.from({ length: 51 }, () => ({}))));
  expect(hasUnloadedLocalHistory()).toBe(true);
  localStorage.removeItem('cloudtyping.history.v1');
  expect(hasUnloadedLocalHistory()).toBe(false);
});
