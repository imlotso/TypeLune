// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ScoreStatusView } from '../src/components/ScoreStatusView';
import { useScoreStatus } from '../src/hooks/useScoreStatus';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('renders clear states without turning a pending review into a ranking', () => {
  const view = render(<ScoreStatusView status={{ state: 'not_submitted', eligible: true, expired: false }} />);
  expect(screen.getByText('尚未提交。')).toBeTruthy();
  view.rerender(<ScoreStatusView status={{ state: 'pending', eligible: true }} />);
  expect(screen.getByText('已提交，待复核。')).toBeTruthy();
  expect(screen.queryByText('已上榜。')).toBeNull();
  view.rerender(<ScoreStatusView status={{ state: 'published', eligible: true, message: '榜单显示同条件最高成绩' }} />);
  expect(screen.getByText('已发布，榜单显示同条件最高成绩。')).toBeTruthy();
});
it('does not infer success from an invalid response and supports retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify({ state: 'rejected', eligible: false, message: '审核未通过。' }))));
  function Harness() {
    const result = useScoreStatus('attempt', 'user', true, 0);
    return <>{result.loading && <span>读取中</span>}{result.error && <><span role="alert">{result.error}</span><button onClick={result.retry}>重试</button></>}{result.status && <ScoreStatusView status={result.status} />}</>;
  }
  render(<Harness />);
  expect((await screen.findByRole('alert')).textContent).toContain('成绩状态无法读取');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByText('审核未通过。')).toBeTruthy();
  expect(screen.queryByText('已上榜。')).toBeNull();
});
