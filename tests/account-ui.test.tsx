// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { allowLocalAccount, blockLocalAccount, putWorkspaceValue } from '../src/lib/workspace';

const member = { id: 'reader-id', username: 'reader', email: 'reader@example.test', isAdmin: false, displayName: '云光', avatar: null as null | 'star' };
let account: typeof member | null;
let requests: string[];
let revokedSessions: Set<string>;

beforeEach(() => {
  account = member; requests = []; revokedSessions = new Set(); localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, '', '/');
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
    requests.push(path);
    let body: unknown = {};
    if (path === '/api/me') body = { user: account };
    else if (path.startsWith('/api/workspace')) body = { items: [], serverTime: Date.now() };
    else if (path === '/api/articles') body = { articles: [] };
    else if (path === '/api/history') body = { entries: [] };
    else if (path === '/api/account/username') {
      const submitted = JSON.parse(String(options?.body));
      account = { ...member, username: submitted.username }; body = { user: account };
    } else if (path === '/api/account/profile') {
      const submitted = JSON.parse(String(options?.body));
      account = { ...account!, displayName: submitted.displayName, avatar: submitted.avatar }; body = { user: account };
    } else if (path === '/api/account/email/code') { body = { ok: true }; }
    else if (path === '/api/account/email/confirm') { account = null; body = { ok: true }; }
    else if (path === '/api/account/sessions') body = { sessions: [
      { id: 'current-id', current: true, device: 'Chrome · Linux', createdAt: 1000, lastActiveAt: 2000 },
      { id: 'other-id', current: false, device: 'Chrome · Windows', createdAt: 1000, lastActiveAt: 2000 },
    ].filter((session) => !revokedSessions.has(session.id)) };
    else if (path === '/api/account/sessions/revoke') {
      const submitted = JSON.parse(String(options?.body));
      revokedSessions.add(submitted.id);
      if (submitted.id === 'current-id') account = null;
      body = { ok: true, current: submitted.id === 'current-id' };
    }
    else if (path === '/api/account/password' || path === '/api/auth/logout') { account = null; body = { ok: true }; }
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  }));
});

it('refreshes the device list after another session has been revoked elsewhere', async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '云光' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '账号设置' }));
  const dialog = await screen.findByRole('dialog', { name: '账号设置' });
  fireEvent.click(within(dialog).getByText('登录设备'));
  await within(dialog).findByText('Chrome · Windows');
  revokedSessions.add('other-id');
  fireEvent.focus(window);
  await waitFor(() => expect(within(dialog).queryByText('Chrome · Windows')).toBeNull());
});

it('requests a new-email code and signs out only after verification succeeds', async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '云光' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '账号设置' }));
  const dialog = await screen.findByRole('dialog', { name: '账号设置' });
  fireEvent.click(within(dialog).getByText('更换邮箱'));
  fireEvent.change(within(dialog).getByLabelText('新邮箱'), { target: { value: 'new@example.test' } });
  fireEvent.change(within(dialog).getByLabelText('当前密码（邮箱）'), { target: { value: 'original-password' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '获取邮箱验证码' }));
  await within(dialog).findByText('验证码请求已提交');
  expect(within(dialog).getByText(/reader@example\.test/)).toBeTruthy();
  expect((within(dialog).getByRole('button', { name: /秒后重发/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(within(dialog).getByLabelText('新邮箱验证码'), { target: { value: '123456' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '验证并更换邮箱' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '登录' })).toBeTruthy());
  expect(screen.getByText('邮箱已更新，请重新登录')).toBeTruthy();
  expect(requests).toContain('/api/account/email/code');
  expect(requests).toContain('/api/account/email/confirm');
});
afterEach(() => { cleanup(); allowLocalAccount(member.id); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

it('does not reopen a blocked local account when an old session check returns', async () => {
  render(<App />);
  await screen.findByRole('button', { name: '云光' });
  blockLocalAccount(member.id);
  fireEvent.focus(window);
  await screen.findByRole('button', { name: '登录' });
  await expect(putWorkspaceValue(member.id, 'favorite', 'late', { articleId: 'late' })).rejects.toThrow();
});

it('unblocks local data if logout fails before cleanup', async () => {
  const original = vi.mocked(fetch).getMockImplementation()!;
  vi.stubGlobal('fetch', vi.fn((path: string, options?: RequestInit) => path === '/api/auth/logout'
    ? Promise.reject(new Error('offline')) : original(path, options)));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '云光' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '退出登录' }));
  const dialog = await screen.findByRole('dialog', { name: '退出登录' });
  fireEvent.click(within(dialog).getByRole('checkbox', { name: '同时清除此设备的账号数据' }));
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /确认清除本机数据|确认放弃未同步资料/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: '确认退出' }));
  expect(await within(dialog).findByRole('alert')).toBeTruthy();
  await expect(putWorkspaceValue(member.id, 'favorite', 'kept', { articleId: 'kept' })).resolves.toBeUndefined();
  expect(screen.getByRole('button', { name: '云光' })).toBeTruthy();
});

it('reports incomplete cleanup after logout if legacy local data cannot be read', async () => {
  localStorage.setItem('cloudtyping.history.v1', 'not-json');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '云光' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '个人数据' }));
  fireEvent.click(await screen.findByRole('button', { name: '清除此设备数据' }));
  const dialog = await screen.findByRole('dialog', { name: '退出登录' });
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /确认清除本机数据|确认放弃未同步资料/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: '确认退出' }));
  expect(await screen.findByText('已退出，但本机数据未能完全清理；可重新登录后重试')).toBeTruthy();
});

it('opens an account menu without signing out and restores focus on Escape', async () => {
  render(<App />);
  const trigger = await screen.findByRole('button', { name: '云光' });
  fireEvent.click(trigger);
  const menu = screen.getByRole('menu');
  expect(within(menu).getByRole('menuitem', { name: '账号设置' })).toBeTruthy();
  expect(within(menu).getByRole('menuitem', { name: '我的记录' })).toBeTruthy();
  expect(within(menu).getByRole('menuitem', { name: '个人数据' })).toBeTruthy();
  expect(within(menu).getByRole('menuitem', { name: '退出登录' })).toBeTruthy();
  expect(requests).not.toContain('/api/auth/logout');
  fireEvent.keyDown(menu, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('hides a revealed password when its account section closes without erasing the value', async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '云光' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '账号设置' }));
  const dialog = await screen.findByRole('dialog', { name: '账号设置' });
  const section = within(dialog).getByText('更换邮箱');
  fireEvent.click(section);
  let input = within(dialog).getByLabelText('当前密码（邮箱）') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'typed-password' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '显示当前密码（邮箱）' }));
  expect(input.type).toBe('text');
  fireEvent.click(section);
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.click(section);
  input = within(dialog).getByLabelText('当前密码（邮箱）') as HTMLInputElement;
  await waitFor(() => expect((within(dialog).getByLabelText('当前密码（邮箱）') as HTMLInputElement).type).toBe('password'));
  expect(input.value).toBe('typed-password');
});

it('shows active devices and signs out immediately when the current session is revoked', async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '云光' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '账号设置' }));
  const dialog = await screen.findByRole('dialog', { name: '账号设置' });
  fireEvent.click(within(dialog).getByText('登录设备'));
  await within(dialog).findByText('Chrome · Windows');
  fireEvent.click(within(dialog).getByRole('button', { name: '退出 Chrome · Windows' }));
  await waitFor(() => expect(within(dialog).queryByText('Chrome · Windows')).toBeNull());
  fireEvent.click(within(dialog).getByRole('button', { name: '退出当前设备' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '登录' })).toBeTruthy());
  expect(screen.getByText('已退出当前设备')).toBeTruthy();
});

it('updates a username in the account center and signs out after a password change', async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '云光' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '账号设置' }));
  const dialog = await screen.findByRole('dialog', { name: '账号设置' });
  expect(within(dialog).getByText(/reader@example\.test/)).toBeTruthy();
  fireEvent.click(within(dialog).getByText('更改用户名'));
  fireEvent.change(within(dialog).getByLabelText('用户名'), { target: { value: 'reader_new' } });
  fireEvent.change(within(dialog).getByLabelText('当前密码（用户名）'), { target: { value: 'original-password' } });
  const usernameSave = within(dialog).getByRole('button', { name: '保存用户名' });
  const usernameForm = usernameSave.closest('form')!;
  fireEvent.click(usernameSave);
  await within(usernameForm).findByText('用户名已保存');
  expect(screen.getByRole('button', { name: '云光' })).toBeTruthy();
  fireEvent.change(within(dialog).getByLabelText('公开昵称'), { target: { value: '小星' } });
  fireEvent.change(within(dialog).getByLabelText('头像'), { target: { value: 'star' } });
  const profileSave = within(dialog).getByRole('button', { name: '保存资料' });
  const profileForm = profileSave.closest('form')!;
  fireEvent.click(profileSave);
  await within(profileForm).findByText('资料已保存');
  expect(screen.getByRole('button', { name: '小星' })).toBeTruthy();
  fireEvent.click(within(dialog).getByText('修改密码', { selector: 'summary' }));
  fireEvent.change(within(dialog).getByLabelText('当前密码'), { target: { value: 'original-password' } });
  fireEvent.change(within(dialog).getByLabelText('新密码'), { target: { value: 'new-password-123' } });
  fireEvent.change(within(dialog).getByLabelText('确认新密码'), { target: { value: 'new-password-123' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '修改密码' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '登录' })).toBeTruthy());
  expect(screen.getByRole('status').textContent).toContain('密码已更新，请重新登录');
  expect(requests).toContain('/api/account/password');
});
