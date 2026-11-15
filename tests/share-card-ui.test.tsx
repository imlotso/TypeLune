// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ShareCardDialog } from '../src/components/ShareCardDialog';

vi.mock('../src/lib/share-card', () => ({ drawShareCard: vi.fn() }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('keeps optional identity fields hidden by default and leaves download available if copying is unsupported', async () => {
  vi.stubGlobal('ClipboardItem', undefined);
  render(<ShareCardDialog data={{ siteName: 'TypeLune', siteUrl: 'https://example.test', language: 'zh', mode: 'timed', duration: 300, elapsedMs: 1000, speed: 60, accuracy: 90, nickname: '云朵', title: '私文', personalBest: false }} theme="light" onClose={() => {}} />);
  expect((screen.getByRole('checkbox', { name: '显示昵称' }) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole('checkbox', { name: '显示文章标题' }) as HTMLInputElement).checked).toBe(false);
  expect(screen.queryByLabelText('昵称')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '复制图片' }));
  expect((await screen.findByRole('alert')).textContent).toContain('下载');
  expect((screen.getByRole('button', { name: '下载图片' }) as HTMLButtonElement).disabled).toBe(false);
});
