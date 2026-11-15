import { useState } from 'react';
import type { Difficulty, Language } from '../../data/articles';
import type { PracticeMode } from '../../lib/models';
import { Dialog } from '../Dialog';
import {
  adminWrite, ConfirmationForm, DateTime, difficulties, languages, LoadState, Pagination, QueryField, reasonLabels,
  ScrollList, SelectField, useAdminList, type AdminProps, type Confirmation,
} from './common';

type ScoreRow = {
  id: string; nickname: string; language: Language; difficulty: Difficulty;
  articleId: string | null; articleTitle: string | null; status: keyof typeof statuses; duration: number; mode: PracticeMode;
  strict: boolean; speed: number; accuracy: number; checkpoints: number; reasons: string[]; finishedAt: number;
  board?: 'guest' | 'user' | 'other';
};
const statuses = { pending: '待审核', published: '已发布', rejected: '已拒绝', removed: '已下架' };
const actions = { approve: '通过', reject: '拒绝', remove: '下架' };
type Action = keyof typeof actions;

function localDate(value: string, nextDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1970 || year > 9999) return undefined;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.getTime();
}

function permitted(status: string): Action[] {
  if (status === 'pending') return ['approve', 'reject'];
  return status === 'published' ? ['reject', 'remove'] : [];
}

export function ScoresPanel({ ownerId }: AdminProps) {
  const list = useAdminList<ScoreRow>(ownerId, '/scores', { status: 'pending' });
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [busy, setBusy] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateError, setDateError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewNotice, setPreviewNotice] = useState('');
  const rows = list.data?.entries ?? [];
  const batch = permitted(list.filters.status);
  const visibleIds = rows.map(({ id }) => id);
  const selected = selection?.key === list.identity ? selection.ids.filter((id) => visibleIds.includes(id)) : [];
  const allSelected = rows.length > 0 && selected.length === rows.length;

  function updateSelection(ids: string[]) {
    setSelection({ key: list.identity, ids });
  }

  function filter(key: string, value: string) {
    setSelection(undefined);
    setPreviewNotice('');
    list.filter(key, value);
  }

  function applyDates() {
    const from = dateFrom ? localDate(dateFrom) : undefined;
    const to = dateTo ? localDate(dateTo, true) : undefined;
    if ((dateFrom && from === undefined) || (dateTo && to === undefined) || (from !== undefined && to !== undefined && from >= to)) {
      setDateError('请选择有效的日期范围'); return;
    }
    setDateError(''); setPreviewNotice(''); setSelection(undefined);
    list.filterMany({ from: from === undefined ? '' : String(from), to: to === undefined ? '' : String(to) });
  }

  async function previewCleanup() {
    const from = Number(list.filters.from); const to = Number(list.filters.to);
    if (previewing || list.filters.status !== 'published' || !list.filters.from || !list.filters.to || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from >= to) return;
    const filter = { from, to, board: list.filters.board || 'all', ...(list.filters.language && { language: list.filters.language }),
      ...(list.filters.difficulty && { difficulty: list.filters.difficulty }), ...(list.filters.q && { q: list.filters.q }) };
    setPreviewing(true); setPreviewNotice('');
    try {
      const preview = await adminWrite<{ count: number; digest: string }>(ownerId, '/scores/cleanup/preview', filter);
      if (!Number.isSafeInteger(preview.count) || preview.count < 0 || preview.count > 5000 || !/^[a-f0-9]{64}$/u.test(preview.digest)) throw new Error('清理预览无法读取');
      if (!preview.count) { setPreviewNotice('筛选范围内没有已上榜成绩'); return; }
      const dates = `${new Date(from).toLocaleDateString('zh-CN')} 至 ${new Date(to - 1).toLocaleDateString('zh-CN')}`;
      setConfirmation({ title: '按日期清理排行榜', action: '清理', target: `${dates} · ${preview.count} 条成绩`, allowPublicMessage: true,
        note: '将下架筛选范围内的公开成绩，保留个人练习历史。筛选结果变化时需要重新预览。',
        submit: (reason, publicMessage) => adminWrite(ownerId, '/scores/cleanup', { ...filter, ...preview, reason, ...(publicMessage && { publicMessage }) }),
      });
    } catch (problem) { setPreviewNotice(problem instanceof Error ? problem.message : '清理预览失败'); }
    finally { setPreviewing(false); }
  }

  function changePage(page: number) {
    setSelection(undefined);
    list.setPage(page);
  }

  function moderate(action: Action, ids: string[], target: string) {
    const name = actions[action];
    setConfirmation({
      title: `${name}成绩`, action: name, target, allowPublicMessage: action !== 'approve',
      submit: (reason, publicMessage) => adminWrite(ownerId, '/scores/moderate', { ids, action, reason, ...(publicMessage && { publicMessage }) }),
    });
  }

  return <>
    <div className="admin-filters feature-filters">
      <QueryField label="昵称或文章" onSearch={(value) => filter('q', value)} />
      <SelectField label="成绩状态" options={Object.entries(statuses)} value={list.filters.status} onChange={(value) => filter('status', value)} />
      <SelectField label="语言" options={Object.entries(languages)} all value={list.filters.language ?? ''} onChange={(value) => filter('language', value)} />
      <SelectField label="难度" options={Object.entries(difficulties)} all value={list.filters.difficulty ?? ''} onChange={(value) => filter('difficulty', value)} />
      <SelectField label="榜单类型" options={[[ 'guest', '游客榜' ], [ 'user', '用户榜' ]]} all value={list.filters.board ?? ''} onChange={(value) => filter('board', value)} />
      <label>开始日期<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
      <label>结束日期<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
      <button type="button" className="outline-button feature-action-button" onClick={applyDates}>筛选日期</button>
    </div>
    {dateError && <p className="form-error" role="alert">{dateError}</p>}
    {previewNotice && <p className="feature-muted" role="status">{previewNotice}</p>}
    {list.filters.status === 'published' && !!list.filters.from && !!list.filters.to && <button type="button" className="outline-button feature-action-button"
      disabled={previewing || !list.data} onClick={() => void previewCleanup()}>{previewing ? '正在预览…' : '清理筛选范围内的排行榜'}</button>}
    {!list.data ? <LoadState error={list.error} retry={list.retry} /> : <>
      {!!rows.length && !!batch.length && <div className="admin-bulk">
        <label><input type="checkbox" checked={allSelected} ref={(input) => { if (input) input.indeterminate = selected.length > 0 && !allSelected; }}
          onChange={(event) => updateSelection(event.target.checked ? visibleIds : [])} />全选本页</label>
        <span className="feature-muted">已选 {selected.length} 项</span>
        <div className="feature-actions">{batch.map((action) => <button key={action} className="outline-button feature-action-button"
          disabled={!selected.length} onClick={() => moderate(action, selected, `${selected.length} 条成绩`)}>{actions[action]}所选</button>)}</div>
      </div>}
      {rows.length ? <ScrollList label="成绩列表">{rows.map((score) => <li className="feature-row admin-score-row" key={score.id}>
        {!!batch.length && <input type="checkbox" className="admin-row-checkbox" aria-label={`选择 ${score.nickname}`} checked={selected.includes(score.id)}
          onChange={(event) => updateSelection(event.target.checked ? [...selected, score.id] : selected.filter((id) => id !== score.id))} />}
        <div className="feature-row-main">
          <h3>{score.nickname}</h3>
          <div className="feature-meta">
            {score.articleTitle && <span>{score.articleTitle}</span>}
            {score.board && score.board !== 'other' && <span>{score.board === 'guest' ? '游客榜' : '用户榜'}</span>}
            <span>{languages[score.language]} · {difficulties[score.difficulty]}</span>
            <span>{score.mode === 'article' ? '整篇' : `${score.duration / 60} 分钟`}{score.strict ? ' · 严格纠错' : ''}</span>
            <DateTime value={score.finishedAt} />
          </div>
          <div className="feature-meta">
            <span className="admin-score-metric">{score.speed} {score.language === 'zh' ? '字/分' : 'WPM'}</span>
            <span>准确率 {score.accuracy}%</span><span>进度记录 {score.checkpoints} 次</span>
          </div>
          {!!score.reasons.length && <p className="admin-reason feature-muted">{score.reasons.map((reason) => reasonLabels[reason] ?? reason).join('、')}</p>}
        </div>
        <div className="feature-actions">{permitted(score.status).map((action) => <button key={action} className="outline-button feature-action-button"
          onClick={() => moderate(action, [score.id], score.nickname)}>{actions[action]}</button>)}</div>
      </li>)}</ScrollList> : <p className="admin-load-state feature-muted">暂无匹配成绩</p>}
      <Pagination data={list.data} setPage={changePage} />
    </>}
    {confirmation && <Dialog title={confirmation.title} onClose={() => setConfirmation(undefined)} dismissible={!busy}>
      <ConfirmationForm confirmation={confirmation} busy={busy} setBusy={setBusy}
        onCancel={() => setConfirmation(undefined)} onSuccess={() => { setConfirmation(undefined); setSelection(undefined); list.refresh(); }} />
    </Dialog>}
  </>;
}
