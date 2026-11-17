// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { DraftsView } from '../src/components/DraftsView';
import { canDiscardSavedDraft } from '../src/hooks/usePractice';
import { deleteWorkspaceDrafts, putWorkspaceValue, readWorkspace, workspaceValue } from '../src/lib/workspace';
import type { SavedPractice } from '../src/lib/models';

const draft = (id: string): SavedPractice => ({ id, recordId: id, article: { id, title: `草稿 ${id}`, text: '春风细雨。', language: 'zh', difficulty: 'beginner', custom: true }, typed: '春', elapsedMs: 1000, backspaces: 0, duration: 300, mode: 'timed', strict: false, offset: 0, offline: true, ownerId: null, savedAt: 10 });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('selects several drafts, cancels one confirmation, then deletes the selection together', async () => {
  const deleted = vi.fn();
  function Harness() {
    const [drafts, setDrafts] = useState(['a', 'b', 'c'].map(draft));
    return <DraftsView drafts={drafts} onResume={() => {}} onDelete={async selected => { deleted(selected); setDrafts(current => current.filter(item => !selected.some(value => value.id === item.id))); }} />;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '批量选择' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '全选草稿' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '选择《草稿 c》' }));
  expect((screen.getByRole('checkbox', { name: '全选草稿' }) as HTMLInputElement).indeterminate).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '删除所选（2）' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '取消' }));
  expect(deleted).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '删除所选（2）' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '删除' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(deleted).toHaveBeenCalledOnce();
  expect(deleted.mock.calls[0][0].map((value: SavedPractice) => value.id)).toEqual(['a', 'b']);
  expect(screen.queryByText('草稿 a')).toBeNull(); expect(screen.getByText('草稿 c')).toBeTruthy();
});

it('keeps the selected drafts and permits retry when deletion fails', async () => {
  const onDelete = vi.fn().mockRejectedValueOnce(new Error('暂时无法保存')).mockResolvedValue(undefined);
  render(<DraftsView drafts={[draft('a'), draft('b')]} onResume={() => {}} onDelete={onDelete} />);
  fireEvent.click(screen.getByRole('button', { name: '批量选择' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '全选草稿' }));
  fireEvent.click(screen.getByRole('button', { name: '删除所选（2）' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '删除' }));
  await screen.findByRole('alert');
  expect((screen.getByRole('checkbox', { name: '选择《草稿 a》' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '删除' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(onDelete).toHaveBeenCalledTimes(2);
});

it('checks every lease before deleting any selected workspace drafts', async () => {
  const selected = [draft('a'), draft('b')];
  for (const item of selected) await putWorkspaceValue(null, 'draft', item.id, item);
  localStorage.setItem('cloudtyping.practice.v2.b', JSON.stringify({ ownerId: null, articleId: 'b', target: '春风细雨。', leaseOwner: 'another-tab', leaseAt: Date.now() }));
  await expect(deleteWorkspaceDrafts(null, selected, () => { if (!selected.every(canDiscardSavedDraft)) throw new Error('leased'); })).rejects.toThrow('leased');
  const retained = await readWorkspace(null);
  expect(selected.every(item => !!workspaceValue(retained, 'draft', item.id))).toBe(true);
});

it('rejects changed or foreign snapshots and persists all valid tombstones together', async () => {
  const selected = [draft('a'), draft('b')];
  for (const item of selected) await putWorkspaceValue(null, 'draft', item.id, item);
  await expect(deleteWorkspaceDrafts(null, [selected[0], { ...selected[1], typed: '春风' }], () => {})).rejects.toThrow('草稿已更新');
  await expect(deleteWorkspaceDrafts(null, [selected[0], { ...selected[1], ownerId: 'another-account' }], () => {})).rejects.toThrow('所属账号');
  expect((await readWorkspace(null)).some(item => item.deleted)).toBe(false);
  const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
  await expect(deleteWorkspaceDrafts(null, selected, () => {})).rejects.toThrow(); fail.mockRestore();
  expect((await readWorkspace(null)).some(item => item.deleted)).toBe(false);
  await deleteWorkspaceDrafts(null, selected, () => {});
  expect((await readWorkspace(null)).filter(item => item.kind === 'draft' && item.deleted)).toHaveLength(2);
});
