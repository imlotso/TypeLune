// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ArticleLibrary } from '../src/components/ArticleLibrary';
import type { PrivateArticle } from '../src/lib/models';

const original: PrivateArticle = { id: 'private', title: '旧标题', text: '原来的正文', language: 'zh', difficulty: 'beginner', custom: true };
afterEach(cleanup);
function renderLibrary(onSave: (value: PrivateArticle) => Promise<void> | void = () => {}) {
  render(<ArticleLibrary articles={[original]} favorites={[]} onToggleFavorite={() => {}} onSelect={() => {}} onSave={onSave} onDelete={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: '编辑《旧标题》' }));
}

it('requires confirmation on Escape and cancellation while preserving unsaved edits', () => {
  renderLibrary();
  const editor = screen.getByRole('dialog', { name: '编辑文章' });
  fireEvent.change(within(editor).getByLabelText('标题'), { target: { value: '未保存标题' } });
  fireEvent.change(within(editor).getByLabelText('正文'), { target: { value: '未保存正文' } });
  fireEvent.keyDown(document, { key: 'Escape' });
  let confirm = screen.getByRole('dialog', { name: '放弃未保存的修改？' });
  expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: '继续编辑' }));
  fireEvent.click(within(confirm).getByRole('button', { name: '继续编辑' }));
  expect((screen.getByLabelText('标题') as HTMLInputElement).value).toBe('未保存标题');
  expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe('未保存正文');
  expect(document.activeElement).toBe(screen.getByLabelText('正文'));
  fireEvent.click(within(screen.getByRole('dialog', { name: '编辑文章' })).getByRole('button', { name: '取消' }));
  confirm = screen.getByRole('dialog', { name: '放弃未保存的修改？' });
  fireEvent.click(within(confirm).getByRole('button', { name: '放弃修改' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('heading', { name: '旧标题' })).toBeTruthy();
});

it('confirms before overwriting text from a TXT file and leaves edits intact after save failure', async () => {
  renderLibrary(vi.fn().mockRejectedValue(new Error('storage full')));
  let editor = screen.getByRole('dialog', { name: '编辑文章' });
  const input = within(editor).getByLabelText('导入 TXT');
  const file = new File([new TextEncoder().encode('新正文')], '新.txt', { type: 'text/plain' });
  fireEvent.change(input, { target: { files: [file] } });
  let confirm = await screen.findByRole('dialog', { name: '替换当前正文？' });
  fireEvent.click(within(confirm).getByRole('button', { name: '取消' }));
  expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe('原来的正文');
  editor = screen.getByRole('dialog', { name: '编辑文章' });
  fireEvent.change(within(editor).getByLabelText('导入 TXT'), { target: { files: [file] } });
  confirm = await screen.findByRole('dialog', { name: '替换当前正文？' });
  fireEvent.click(within(confirm).getByRole('button', { name: '替换正文' }));
  editor = screen.getByRole('dialog', { name: '编辑文章' });
  expect((within(editor).getByLabelText('正文') as HTMLTextAreaElement).value).toBe('新正文');
  fireEvent.click(within(editor).getByRole('button', { name: '保存' }));
  await waitFor(() => expect(within(editor).getByRole('alert').textContent).toContain('保存失败'));
  expect((within(editor).getByLabelText('正文') as HTMLTextAreaElement).value).toBe('新正文');
});

it('explains what happens to existing practice snapshots before deletion', () => {
  renderLibrary();
  fireEvent.click(within(screen.getByRole('dialog', { name: '编辑文章' })).getByRole('button', { name: '关闭' }));
  fireEvent.click(screen.getByRole('button', { name: '删除《旧标题》' }));
  expect(screen.getByRole('dialog', { name: '删除《旧标题》？' }).textContent).toContain('已有草稿和历史记录保留原文章快照');
});
