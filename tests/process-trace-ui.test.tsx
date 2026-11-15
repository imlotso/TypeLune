// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ProcessChart } from '../src/components/ProcessChart';
import type { ProcessTrace } from '../src/lib/process-trace';

afterEach(cleanup);
it('identifies old records without process observations', () => {
  render(<ProcessChart language="zh" />);
  expect(screen.getByText('暂无过程数据')).toBeTruthy();
});
it('shows actual speed, error distribution and the stability calculation', () => {
  const trace: ProcessTrace = { version: 1, intervalMs: 5000, missing: false, compacted: false, samples: [
    { time: 0, progress: 0, correct: 0, errors: 0 }, { time: 5000, progress: 2, correct: 2, errors: 0 },
    { time: 10000, progress: 4, correct: 4, errors: 1 }, { time: 15000, progress: 6, correct: 6, errors: 1 },
  ] };
  render(<ProcessChart language="zh" trace={trace} />);
  expect(screen.getByRole('img', { name: '练习过程速度和错误分布' })).toBeTruthy();
  expect(screen.getByText('100%')).toBeTruthy();
  expect(screen.getByText('计算说明')).toBeTruthy();
  cleanup();
  render(<ProcessChart language="en" trace={{ ...trace, missing: true }} />);
  expect(screen.getByText('部分过程数据缺失')).toBeTruthy();
  expect(screen.queryByText('100%')).toBeNull();
});
