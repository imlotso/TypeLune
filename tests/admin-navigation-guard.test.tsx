// @vitest-environment jsdom
import { act, waitFor, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminWorkspace } from '../src/components/AdminWorkspace';
import { api } from '../src/lib/api';
vi.mock('../src/lib/api', async (original) => ({ ...await original<typeof import('../src/lib/api')>(), api: vi.fn() }));
vi.mock('../src/hooks/useWorkspace', () => ({ useWorkspace: () => ({ settings: {theme:'light'}, settingsReady:true, updateSettings:vi.fn() }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('preserves unsaved SMTP edits when leaving is canceled, including refresh and preview', async () => {
  vi.mocked(api).mockImplementation(async (url) => url.endsWith('/smtp') ? { source:'unconfigured', fallback:'unconfigured', revision:0, editable:true, config:null, passwordState:'empty' } : { metrics:{}, recentActions:[] });
  const preview = vi.fn();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<AdminWorkspace user={{id:'admin',username:'admin',email:'admin@example.test',isAdmin:true}} onLogout={vi.fn()} onPreview={preview} />);
  fireEvent.click(screen.getByRole('button', {name:'邮件'}));
  fireEvent.change(await screen.findByLabelText('SMTP 主机'), {target:{value:'smtp.example.test'}});
  fireEvent.click(screen.getByRole('button', {name:'概览'}));
  expect((screen.getByLabelText('SMTP 主机') as HTMLInputElement).value).toBe('smtp.example.test');
  fireEvent.click(screen.getByRole('button', {name:'预览网站'}));
  expect(preview).not.toHaveBeenCalled();
  const unload = new Event('beforeunload', {cancelable:true});
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', {name:'概览'}));
  expect(screen.queryByLabelText('SMTP 主机')).toBeNull();
  const cleanUnload = new Event('beforeunload', {cancelable:true});
  window.dispatchEvent(cleanUnload);
  expect(cleanUnload.defaultPrevented).toBe(false);
});

it('blocks logout while SMTP connection verification is in flight, then releases saved edits', async () => {
  let complete!: () => void;
  const config = { host:'smtp.example.test', from:'sender@example.test', username:'', port:587, security:'starttls' };
  vi.mocked(api).mockImplementation(async (url, options) => {
    if (url.endsWith('/smtp/verify')) return new Promise<void>((resolve) => { complete = resolve; });
    if (url.endsWith('/smtp')) return { source:'admin', fallback:'unconfigured', revision:1, editable:true, config: options?.method === 'POST' ? { ...config, host:'smtp.changed.test' } : config, passwordState:'saved' };
    return {metrics:{},recentActions:[]};
  });
  const logout = vi.fn();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<AdminWorkspace user={{id:'admin',username:'admin',email:'admin@example.test',isAdmin:true}} onLogout={logout} onPreview={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', {name:'邮件'}));
  await screen.findByLabelText('SMTP 主机');
  fireEvent.click(screen.getByRole('button', {name:'测试连接'}));
  fireEvent.click(screen.getByTitle('退出登录'));
  expect(vi.mocked(api).mock.calls.some(([url]) => url === '/api/auth/logout')).toBe(false);
  await act(async () => complete());
  fireEvent.change(screen.getByLabelText('SMTP 主机'), {target:{value:'smtp.changed.test'}});
  fireEvent.click(screen.getByRole('button', {name:'保存'}));
  await screen.findByText('已保存');
  const unload = new Event('beforeunload', {cancelable:true});
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(false);
  fireEvent.click(screen.getByTitle('退出登录'));
  await waitFor(() => expect(logout).toHaveBeenCalled());
});
