// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FeedbackView, type FeedbackDraft } from '../src/components/FeedbackView';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('does not show a late response for a previous feedback detail', async () => {
  let resolveOld!: (value: Response) => void;
  const old = new Promise<Response>((resolve) => { resolveOld = resolve; });
  const detail = (id: string, title: string) => ({ id, title, description: '内容', category: 'issue', status: 'pending', revision: 1, createdAt: 1000, updatedAt: 1000, messages: [], attachments: [] });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/feedback/old') return old;
    if (url === '/api/feedback/new') return new Response(JSON.stringify({ feedback: detail('new', '新反馈') }));
    return new Response(JSON.stringify({ entries: [], total: 0, page: 1, pageSize: 20 }));
  }));
  const draft: FeedbackDraft = { requestId: 'draft', category: 'issue', title: '', description: '', attachments: [] };
  const props = { ownerId: 'user', draft, setDraft: () => {}, onLogin: () => {}, onOpenFeedback: () => {}, onCloseFeedback: () => {} };
  const view = render(<FeedbackView {...props} routeFeedbackId="old" />);
  view.rerender(<FeedbackView {...props} routeFeedbackId="new" />);
  expect(await screen.findByRole('heading', { name: '新反馈' })).toBeTruthy();
  await act(async () => resolveOld(new Response(JSON.stringify({ feedback: detail('old', '旧反馈') }))));
  expect(screen.getByRole('heading', { name: '新反馈' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '旧反馈' })).toBeNull();
});


it('does not redirect away from a newer route when a previous submission finishes', async () => {
  let finish!: (value: Response) => void;
  const response = (id: string, title: string) => ({ id, title, description: '内容', category: 'issue', status: 'pending', revision: 1, createdAt: 1000, updatedAt: 1000, messages: [], attachments: [] });
  vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) => {
    if (url === '/api/feedback' && options?.method === 'POST') return new Promise<Response>((resolve) => { finish = resolve; });
    if (url === '/api/feedback/other') return Promise.resolve(new Response(JSON.stringify({ feedback: response('other', '另一条反馈') })));
    return Promise.resolve(new Response(JSON.stringify({ entries: [], total: 0, page: 1, pageSize: 20 })));
  }));
  const draft: FeedbackDraft = { requestId: 'draft', category: 'issue', title: '待提交', description: '内容', attachments: [] };
  const open = vi.fn();
  const props = { ownerId: 'user', draft, setDraft: () => {}, onLogin: () => {}, onOpenFeedback: open, onCloseFeedback: () => {} };
  const view = render(<FeedbackView {...props} />);
  fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  view.rerender(<FeedbackView {...props} routeFeedbackId="other" />);
  expect(await screen.findByRole('heading', { name: '另一条反馈' })).toBeTruthy();
  await act(async () => finish(new Response(JSON.stringify({ feedback: response('submitted', '已提交') }))));
  expect(open).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: '另一条反馈' })).toBeTruthy();
});

it('reports an unreadable feedback list and can retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify({ entries: [], total: 0, page: 1, pageSize: 20 }))));
  const draft: FeedbackDraft = { requestId: 'draft', category: 'issue', title: '', description: '', attachments: [] };
  render(<FeedbackView ownerId="user" draft={draft} setDraft={() => {}} onLogin={() => {}} />);
  expect((await screen.findByRole('alert')).textContent).toContain('反馈列表无法读取');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByText('暂无反馈')).toBeTruthy();
});
