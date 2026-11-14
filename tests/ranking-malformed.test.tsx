// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RankingView } from '../src/components/RankingView';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('reports an unreadable leaderboard and can retry without crashing the page', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify({ entries: [], self: null, total: 0 })));
  vi.stubGlobal('fetch', fetcher);
  render(<RankingView initial={{ language: 'zh', difficulty: 'beginner', duration: 300, mode: 'timed', strict: false }} articles={[]} isAdmin={false} ownerId={null} />);
  expect((await screen.findByRole('alert')).textContent).toContain('排行榜数据无法读取');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByText('暂无成绩')).toBeTruthy();
});
