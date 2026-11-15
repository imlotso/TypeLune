import { SystemMessage } from '../SystemMessage';
import { useAdminText } from './i18n';
import { useAdminEdits } from '../AdminNavigationGuard';
import { useState, type FormEvent } from 'react';
import { FeedbackThread, feedbackCategories, feedbackStatuses, type FeedbackCategory, type FeedbackDetail } from '../FeedbackView';
import { adminWrite, DateTime, LoadState, Pagination, ScrollList, SelectField, useAdminList, useAdminResource, type AdminProps } from './common';

type Summary = { id: string; title: string; category: FeedbackCategory; status: string; createdAt: number; updatedAt: number; articleId?: string | null; articleTitle?: string | null };

function FeedbackEditor({ ownerId, id, onBack, onChange, onArticle }: AdminProps & { id: string; onBack: () => void; onChange: () => void; onArticle: (id: string) => void }) {
  const { at } = useAdminText();
  const [revision, setRevision] = useState(0);
  const { data, error: loadError, retry } = useAdminResource<{ feedback: FeedbackDetail }>(ownerId, `/feedback/${encodeURIComponent(id)}`, revision);
  const [statusEdit, setStatusEdit] = useState<{ revision: number; value: string }>();
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const status = statusEdit && data && statusEdit.revision === data.feedback.revision ? statusEdit.value : data?.feedback.status ?? 'pending';
  useAdminEdits(!!(reply.trim() || note.trim() || (data && status !== data.feedback.status)), busy);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!data) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      await adminWrite(ownerId, `/feedback/${encodeURIComponent(id)}/handle`, { revision: data.feedback.revision, status, reply, note });
      setReply(''); setNote(''); setSaved(true); setRevision((value) => value + 1); onChange();
    } catch (problem) { setError(problem instanceof Error ? problem.message : at('保存失败')); }
    finally { setBusy(false); }
  }
  if (!data) return <><button className="outline-button" onClick={onBack}>{at("返回")}</button><LoadState error={loadError} retry={retry} /></>;
  const feedback = data.feedback;
  const leave = (action: () => void) => {
    if ((reply.trim() || note.trim() || status !== feedback.status) && !window.confirm(at('未保存的处理内容将丢失。继续？'))) return;
    action();
  };
  return <>
    <FeedbackThread feedback={feedback} />
    {feedback.article && <button className="outline-button feature-action-button" onClick={() => onArticle(feedback.article!.id)}>{at("查看关联文章")}</button>}
    <form className="feature-form" onSubmit={submit}>
      <SelectField label={at("处理状态")} options={Object.entries(feedbackStatuses)} value={status} onChange={(value) => setStatusEdit({ revision: feedback.revision, value })} disabled={busy} />
      <label>{at("公开回复")}<textarea value={reply} maxLength={5000} disabled={busy} onChange={(event) => setReply(event.target.value)} /></label>
      <label>{at("内部备注")}<textarea value={note} maxLength={5000} disabled={busy} onChange={(event) => setNote(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{<SystemMessage text={error} />}</p>}
      {saved && <p className="form-notice" role="status">{at("已保存")}</p>}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => leave(onBack)}>{at("返回")}</button>
        {error && <button type="button" className="outline-button" onClick={() => { setRevision((value) => value + 1); setError(''); }}>{at("刷新反馈")}</button>}
        <button className="primary-button" disabled={busy}>{busy ? at('保存中…') : at('保存处理')}</button></div>
    </form>
  </>;
}

export function FeedbackPanel({ ownerId, onArticle }: AdminProps & { onArticle: (id: string) => void }) {
  const { at, locale } = useAdminText();
  const list = useAdminList<Summary>(ownerId, '/feedback');
  const [selected, setSelected] = useState<string>();
  if (selected) return <FeedbackEditor ownerId={ownerId} id={selected} onBack={() => setSelected(undefined)} onChange={list.refresh} onArticle={onArticle} />;
  return <>
    <div className="admin-filters feature-filters">
      <SelectField label={at("反馈分类")} options={Object.entries(feedbackCategories)} all value={list.filters.category ?? ''} onChange={(value) => list.filter('category', value)} />
      <SelectField label={at("反馈状态")} options={Object.entries(feedbackStatuses)} all value={list.filters.status ?? ''} onChange={(value) => list.filter('status', value)} />
      <label>{at("起始日期")}<input type="date" value={list.filters.from ?? ''} onChange={(event) => list.filter('from', event.target.value)} /></label>
      <label>{at("结束日期")}<input type="date" value={list.filters.to ?? ''} onChange={(event) => list.filter('to', event.target.value)} /></label>
    </div>
    {!list.data ? <LoadState error={list.error} retry={list.retry} /> : <>
      {list.data.entries.length ? <ScrollList label={at("反馈列表")}>{list.data.entries.map((item) => <li className="feature-row" key={item.id}>
        <div className="feature-row-main"><h3>{item.title}</h3><div className="feature-meta"><span>{at(feedbackCategories[item.category])}</span><span>{at(feedbackStatuses[item.status] ?? item.status)}</span><DateTime value={item.createdAt} /></div></div>
        <button className="outline-button feature-action-button" aria-label={`${locale === 'en' ? 'View feedback' : '查看反馈'} ${item.title}`} onClick={() => setSelected(item.id)}>{at("详情")}</button>
      </li>)}</ScrollList> : <p className="admin-load-state feature-muted">{at("暂无反馈")}</p>}
      <Pagination data={list.data} setPage={list.setPage} />
    </>}
  </>;
}
