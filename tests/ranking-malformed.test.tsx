// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RankingView } from '../src/components/RankingView';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });
it('reports an unreadable leaderboard and can retry without crashing the page', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify({ entries: [], self: null, total: 0 })));
  vi.stubGlobal('fetch', fetcher);
  render(<RankingView initial={{ language: 'zh', difficulty: 'beginner', duration: 300, mode: 'timed', strict: false }} articles={[]} isAdmin={false} ownerId={null} />);
  expect((await screen.findByRole('alert')).textContent).toContain('排行榜数据无法读取');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByText('暂无成绩')).toBeTruthy();
});

it('keeps the selected board and practice filters in the link across remounts', async () => {
  window.history.replaceState({ navigation: 1 }, '', '/rankings?board=guest&language=en&difficulty=advanced&duration=120&mode=timed&strict=false&period=week');
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ entries: [], self: null, total: 0 })));
  vi.stubGlobal('fetch', fetcher);
  const props = { initial: { language: 'zh' as const, difficulty: 'beginner' as const, duration: 300, mode: 'timed' as const, strict: false }, articles: [], isAdmin: false, ownerId: null };
  const first = render(<RankingView {...props} />);
  expect(await screen.findByText('暂无成绩')).toBeTruthy();
  expect(screen.getByRole('button', { name: '游客榜' }).getAttribute('aria-pressed')).toBe('true');
  expect((screen.getByLabelText('难度') as HTMLSelectElement).value).toBe('advanced');
  expect((screen.getByLabelText('限时（分钟）') as HTMLInputElement).value).toBe('2');
  fireEvent.click(screen.getByRole('button', { name: '用户榜' }));
  expect(new URLSearchParams(window.location.search).get('board')).toBe('user');
  expect(new URLSearchParams(window.location.search).get('language')).toBe('en');
  first.unmount();
  render(<RankingView {...props} />);
  expect(screen.getByRole('button', { name: '用户榜' }).getAttribute('aria-pressed')).toBe('true');
  expect((screen.getByLabelText('限时（分钟）') as HTMLInputElement).value).toBe('2');
  expect(window.history.state).toEqual({ navigation: 1 });
});

it('reads ranking filters from a shared address with a trailing slash', async () => {
  window.history.replaceState(null, '', '/rankings/?board=user&language=en&difficulty=advanced&duration=120');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ entries: [], self: null, total: 0 }))));
  render(<RankingView initial={{ language: 'zh', difficulty: 'beginner', duration: 300, mode: 'timed', strict: false }} articles={[]} isAdmin={false} ownerId={null} />);
  expect(await screen.findByText('暂无成绩')).toBeTruthy();
  expect(screen.getByRole('button', { name: '用户榜' }).getAttribute('aria-pressed')).toBe('true');
  expect((screen.getByLabelText('难度') as HTMLSelectElement).value).toBe('advanced');
  expect((screen.getByLabelText('限时（分钟）') as HTMLInputElement).value).toBe('2');
});
