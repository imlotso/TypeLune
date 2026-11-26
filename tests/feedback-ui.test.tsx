// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../src/App';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, '', '/'); });

it('preserves a guest feedback draft through login and shows the submitted feedback number', async () => {
  const member = { id: 'member', username: 'reader', email: 'reader@example.test', isAdmin: false };
  let current: typeof member | null = null;
  let submitted: Record<string, unknown> | undefined;
  let storedFeedback: Record<string, unknown> | undefined;
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
    let body: unknown = {};
    if (path === '/api/me') body = { user: current };
    else if (path === '/api/auth/login') { current = member; body = { user: member }; }
    else if (path === '/api/articles') body = { articles: [] };
    else if (path.startsWith('/api/workspace')) body = { items: [], serverTime: Date.now() };
    else if (path === '/api/feedback' && options?.method === 'POST') {
      submitted = JSON.parse(String(options.body));
      storedFeedback = { id: 'feedback-id-123', category: 'issue', title: submitted!.title, description: submitted!.description, status: 'pending', revision: 1, createdAt: Date.now(), updatedAt: Date.now(), attachments: [], messages: [] };
      body = { feedback: storedFeedback };
    } else if (path === '/api/feedback/feedback-id-123') body = { feedback: storedFeedback };
    else if (path.startsWith('/api/feedback')) body = { entries: [], total: 0, page: 1, pageSize: 20 };
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  }));
  render(<App />);
  const feedbackEntry = await screen.findByRole('button', { name: '功能反馈' });
  await waitFor(() => expect((feedbackEntry as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(feedbackEntry);
  fireEvent.change(await screen.findByLabelText('标题'), { target: { value: '输入问题' } });
  fireEvent.change(screen.getByLabelText('详细描述'), { target: { value: '换行时出现问题' } });
  fireEvent.click(screen.getByRole('button', { name: '登录后提交' }));
  const login = await screen.findByRole('dialog', { name: '登录' });
  fireEvent.change(within(login).getByLabelText('用户名或邮箱'), { target: { value: 'reader' } });
  fireEvent.change(within(login).getByLabelText('密码'), { target: { value: 'a-long-password' } });
  fireEvent.click(within(login).getByRole('button', { name: '登录' }));
  await waitFor(() => expect((screen.getByLabelText('标题') as HTMLInputElement).value).toBe('输入问题'));
  expect((screen.getByLabelText('详细描述') as HTMLTextAreaElement).value).toBe('换行时出现问题');
  fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));
  expect(await screen.findByText(/feedback-id-123/)).toBeTruthy();
  expect(await screen.findByLabelText('补充信息')).toBeTruthy();
  expect(submitted).toMatchObject({ title: '输入问题', description: '换行时出现问题', attachments: [] });
});

it('keeps the draft and retry key when a submission fails', async () => {
  const member = { id: 'member', username: 'reader', email: 'reader@example.test', isAdmin: false };
  const submitted: Array<Record<string, unknown>> = [];
  const storedFeedback = { id: 'feedback-retry', category: 'issue', title: '重试', description: '保留内容', status: 'pending', revision: 1, createdAt: Date.now(), updatedAt: Date.now(), attachments: [], messages: [] };
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
    let body: unknown = {};
    let status = 200;
    if (path === '/api/me') body = { user: member };
    else if (path === '/api/articles') body = { articles: [] };
    else if (path.startsWith('/api/workspace')) body = { items: [], serverTime: Date.now() };
    else if (path === '/api/feedback/uploads') body = { ok: true };
    else if (path === '/api/feedback' && options?.method === 'POST') {
      submitted.push(JSON.parse(String(options.body)));
      if (submitted.length === 1) { status = 503; body = { error: '暂时无法提交' }; }
      else body = { feedback: storedFeedback };
    } else if (path === '/api/feedback/feedback-retry') body = { feedback: storedFeedback };
    else if (path.startsWith('/api/feedback')) body = { entries: [], total: 0, page: 1, pageSize: 20 };
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }));
  render(<App />);
  await screen.findByRole('button', { name: 'reader' });
  fireEvent.click(await screen.findByRole('button', { name: '功能反馈' }));
  fireEvent.change(await screen.findByLabelText('标题'), { target: { value: '重试' } });
  fireEvent.change(screen.getByLabelText('详细描述'), { target: { value: '保留内容' } });
  fireEvent.change(screen.getByLabelText('截图（最多 3 张，每张 5 MiB）'), { target: { files: [new File(['image'], 'screen.png', { type: 'image/png' })] } });
  fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));
  expect((await screen.findByRole('alert')).textContent).toBe('暂时无法提交');
  expect((screen.getByLabelText('标题') as HTMLInputElement).value).toBe('重试');
  expect((screen.getByLabelText('详细描述') as HTMLTextAreaElement).value).toBe('保留内容');
  expect(screen.getByText('screen.png')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));
  expect(await screen.findByText(/feedback-retry/)).toBeTruthy();
  expect(await screen.findByLabelText('补充信息')).toBeTruthy();
  expect(submitted[0].requestId).toBe(submitted[1].requestId);
});

it('does not navigate to feedback before the current account has finished loading', async () => {
  let resolveAccount!: (response: Response) => void;
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn((path: string) => {
    if (path === '/api/me') return new Promise<Response>((resolve) => { resolveAccount = resolve; });
    return Promise.resolve(new Response(JSON.stringify(path === '/api/articles' ? { articles: [] } : { items: [], serverTime: Date.now() })));
  }));
  render(<App />);
  const feedback = screen.getByRole('button', { name: '功能反馈' }) as HTMLButtonElement;
  expect(feedback.disabled).toBe(true);
  resolveAccount(new Response(JSON.stringify({ user: null })));
  await waitFor(() => expect(feedback.disabled).toBe(false));
  fireEvent.click(feedback);
  expect(await screen.findByLabelText('标题')).toBeTruthy();
});

it('prevents edits while a feedback submission is in flight', async () => {
  const member = { id: 'member', username: 'reader', email: 'reader@example.test', isAdmin: false };
  let finish!: (response: Response) => void;
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn((path: string, options?: RequestInit) => {
    if (path === '/api/feedback' && options?.method === 'POST') return new Promise<Response>((resolve) => { finish = resolve; });
    if (path === '/api/feedback/f') return Promise.resolve(new Response(JSON.stringify({ feedback: { id: 'f', category: 'issue', title: '问题', description: '内容', status: 'pending', revision: 1, createdAt: Date.now(), updatedAt: Date.now(), attachments: [], messages: [] } })));
    const body = path === '/api/me' ? { user: member } : path === '/api/articles' ? { articles: [] } : path.startsWith('/api/workspace') ? { items: [], serverTime: Date.now() } : { entries: [], total: 0, page: 1, pageSize: 20 };
    return Promise.resolve(new Response(JSON.stringify(body)));
  }));
  render(<App />);
  await screen.findByRole('button', { name: 'reader' });
  fireEvent.click(await screen.findByRole('button', { name: '功能反馈' }));
  fireEvent.change(await screen.findByLabelText('标题'), { target: { value: '问题' } });
  fireEvent.change(screen.getByLabelText('详细描述'), { target: { value: '内容' } });
  fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  expect((screen.getByLabelText('标题') as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByLabelText('详细描述') as HTMLTextAreaElement).disabled).toBe(true);
  finish(new Response(JSON.stringify({ feedback: { id: 'f', category: 'issue', title: '问题', description: '内容', status: 'pending', revision: 1, createdAt: Date.now(), updatedAt: Date.now(), attachments: [], messages: [] } })));
  await screen.findByText(/编号：f/);
  expect(await screen.findByLabelText('补充信息')).toBeTruthy();
});
