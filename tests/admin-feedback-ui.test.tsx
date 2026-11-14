// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminConsole } from '../src/components/AdminConsole';
import { api } from '../src/lib/api';

vi.mock('../src/lib/api', () => ({ api: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('loads a feedback thread and submits a public reply and a separate internal note', async () => {
  const feedback = { id: 'f1', title: '输入问题', description: '出现错误', category: 'issue', status: 'pending', revision: 1, createdAt: 1000, updatedAt: 1000, attachments: [], messages: [] };
  const call = vi.mocked(api);
  call.mockImplementation(async (url, options) => {
    if (url === '/api/admin/overview') return { metrics: { users: 1 }, recentActions: [] };
    if (url.startsWith('/api/admin/feedback?')) return { entries: [feedback], total: 1, page: 1, pageSize: 20 };
    if (url === '/api/admin/feedback/f1') return { feedback };
    if (url === '/api/admin/feedback/f1/handle' && options?.method === 'POST') return { feedback: { ...feedback, status: 'resolved', revision: 2 } };
    throw new Error('unexpected request');
  });
  render(<AdminConsole ownerId="admin-id" onCatalogChange={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: '反馈' }));
  fireEvent.click(await screen.findByRole('button', { name: '查看反馈 输入问题' }));
  await screen.findByText('出现错误');
  fireEvent.change(screen.getByLabelText('处理状态'), { target: { value: 'resolved' } });
  fireEvent.change(screen.getByLabelText('公开回复'), { target: { value: '已处理' } });
  fireEvent.change(screen.getByLabelText('内部备注'), { target: { value: '内部内容' } });
  fireEvent.click(screen.getByRole('button', { name: '保存处理' }));
  await waitFor(() => expect(call.mock.calls.some(([url]) => url === '/api/admin/feedback/f1/handle')).toBe(true));
  const request = call.mock.calls.find(([url]) => url === '/api/admin/feedback/f1/handle')?.[1];
  expect(request?.body).toEqual({ revision: 1, status: 'resolved', reply: '已处理', note: '内部内容' });
  expect(await screen.findByText('已保存')).toBeTruthy();
});

it('retains unsaved text on a revision conflict and requires a refreshed revision', async () => {
  const feedback = { id: 'f1', title: '输入问题', description: '出现错误', category: 'issue', status: 'pending', revision: 1, createdAt: 1000, updatedAt: 1000, attachments: [], messages: [] };
  let version = 1; let writes = 0;
  const call = vi.mocked(api);
  call.mockImplementation(async (url, options) => {
    if (url === '/api/admin/overview') return { metrics: { users: 1 }, recentActions: [] };
    if (url.startsWith('/api/admin/feedback?')) return { entries: [feedback], total: 1, page: 1, pageSize: 20 };
    if (url === '/api/admin/feedback/f1') return { feedback: { ...feedback, revision: version } };
    if (url === '/api/admin/feedback/f1/handle' && options?.method === 'POST') {
      if (++writes === 1) { version = 2; throw new Error('反馈已更新，请刷新后重试'); }
      return { feedback: { ...feedback, revision: 3 } };
    }
    throw new Error('unexpected request');
  });
  render(<AdminConsole ownerId="admin-id" onCatalogChange={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: '反馈' }));
  fireEvent.click(await screen.findByRole('button', { name: '查看反馈 输入问题' }));
  const reply = await screen.findByLabelText('公开回复') as HTMLTextAreaElement;
  fireEvent.change(reply, { target: { value: '保留回复' } });
  fireEvent.click(screen.getByRole('button', { name: '保存处理' }));
  expect((await screen.findByRole('alert')).textContent).toBe('反馈已更新，请刷新后重试');
  expect(reply.value).toBe('保留回复');
  fireEvent.click(screen.getByRole('button', { name: '刷新反馈' }));
  await screen.findByLabelText('公开回复');
  expect((screen.getByLabelText('公开回复') as HTMLTextAreaElement).value).toBe('保留回复');
  fireEvent.click(screen.getByRole('button', { name: '保存处理' }));
  await waitFor(() => expect(writes).toBe(2));
  const requests = call.mock.calls.filter(([url]) => url === '/api/admin/feedback/f1/handle');
  expect(requests[1][1]?.body).toMatchObject({ revision: 2, reply: '保留回复' });
});
