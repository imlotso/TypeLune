// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../src/App';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, '', '/'); });

it('shows the supplied operator, contact and effective policy versions', async () => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (path: string) => new Response(JSON.stringify(path === '/api/me' ? { user: null } : path === '/api/articles' ? { articles: [] } : { items: [], serverTime: Date.now() }))));
  render(<App />);
  const help = await screen.findByRole('button', { name: '使用帮助' });
  await waitFor(() => expect((help as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(help);
  expect(await screen.findByRole('heading', { name: '使用帮助' })).toBeTruthy();
  expect(screen.getByText(/首次输入/)).toBeTruthy();
  expect(screen.getByText(/WPM/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '关于与联系' }));
  expect(await screen.findByRole('heading', { name: '关于与联系' })).toBeTruthy();
  expect(screen.getByText('运营主体：www.sitetalk.net')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'admin@imlotso.com' }).getAttribute('href')).toBe('mailto:admin@imlotso.com');
  fireEvent.click(screen.getByRole('button', { name: '隐私政策' }));
  expect(await screen.findByRole('heading', { name: '隐私政策' })).toBeTruthy();
  expect(screen.getByText(/反馈截图/)).toBeTruthy();
  expect(screen.getByText('版本：1.0 · 生效日期：2026-11-15')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '服务条款' }));
  expect(await screen.findByRole('heading', { name: '服务条款' })).toBeTruthy();
  expect(screen.getByText('版本：1.0 · 生效日期：2026-11-15')).toBeTruthy();
});
