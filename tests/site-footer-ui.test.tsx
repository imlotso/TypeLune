// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SiteFooter } from '../src/components/SiteFooter';
import { I18nProvider } from '../src/lib/i18n';
const api = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/api', () => ({ api }));
beforeEach(() => { api.mockReset(); localStorage.clear(); });
afterEach(cleanup);
it('keeps helpful links and SiteTalk attribution without an unconfigured donation button', async () => {
  api.mockResolvedValue({ enabled: false });
  const navigate = vi.fn();
  render(<SiteFooter ready onNavigate={navigate} />);
  await waitFor(() => expect(api).toHaveBeenCalledWith('/api/site/support', expect.any(Object)));
  expect(screen.queryByRole('button', { name: '支持 TypeLune' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '使用帮助' }));
  expect(navigate).toHaveBeenCalledWith('help');
  expect(screen.getByRole('link', { name: 'SiteTalk' }).getAttribute('href')).toBe('https://www.sitetalk.net');
});
it('shows only configured QR images in a dismissible dialog and no external payment link', async () => {
  api.mockResolvedValue({ enabled: true, alipay: { dataUrl: 'data:image/png;base64,YQ==' } });
  render(<SiteFooter ready onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: '支持 TypeLune' }));
  expect(await screen.findByRole('img', { name: '支付宝收款码' })).toBeTruthy();
  expect(screen.queryByRole('img', { name: '微信收款码' })).toBeNull();
  expect(screen.getAllByRole('link')).toHaveLength(1);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('does not advertise missing images or unsafe URL payloads', async () => {
  api.mockResolvedValue({ enabled: true, alipay: { dataUrl: 'https://untrusted.example/image.svg' }, wechat: { dataUrl: 'data:image/svg+xml;base64,YQ==' } });
  render(<SiteFooter ready onNavigate={vi.fn()} />);
  await waitFor(() => expect(api).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: '支持 TypeLune' })).toBeNull();
});
it('translates footer and donation labels independently of practice text', async () => {
  localStorage.setItem('typelune.ui-locale.v1', 'en');
  api.mockResolvedValue({ enabled: true, wechat: { dataUrl: 'data:image/webp;base64,YQ==' } });
  render(<I18nProvider><SiteFooter ready onNavigate={vi.fn()} /></I18nProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Support TypeLune' }));
  expect(await screen.findByRole('img', { name: 'WeChat payment QR code' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Privacy' })).toBeTruthy();
});
