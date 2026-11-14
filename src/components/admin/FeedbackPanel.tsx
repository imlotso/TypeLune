import { useEffect, useState, type FormEvent } from 'react';
import { FeedbackThread, feedbackCategories, feedbackStatuses, type FeedbackCategory, type FeedbackDetail } from '../FeedbackView';
import { adminWrite, DateTime, LoadState, Pagination, ScrollList, SelectField, useAdminList, useAdminResource, type AdminProps } from './common';

type Summary = { id: string; title: string; category: FeedbackCategory; status: string; createdAt: number; updatedAt: number; articleId?: string | null; articleTitle?: string | null };

function FeedbackEditor({ ownerId, id, onBack, onChange, onArticle }: AdminProps & { id: string; onBack: () => void; onChange: () => void; onArticle: (id: string) => void }) {
  const [revision, setRevision] = useState(0);
  const { data, error: loadError, retry } = useAdminResource<{ feedback: FeedbackDetail }>(ownerId, `/feedback/${encodeURIComponent(id)}`, revision);
  const [status, setStatus] = useState('pending');
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (data) setStatus(data.feedback.status); }, [data?.feedback.revision]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!data) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      await adminWrite(ownerId, `/feedback/${encodeURIComponent(id)}/handle`, { revision: data.feedback.revision, status, reply, note });
      setReply(''); setNote(''); setSaved(true); setRevision((value) => value + 1); onChange();
    } catch (problem) { setError(problem instanceof Error ? problem.message : '保存失败'); }
    finally { setBusy(false); }
  }
  if (!data) return <><button className="outline-button" onClick={onBack}>返回</button><LoadState error={loadError} retry={retry} /></>;
  const feedback = data.feedback;
  const leave = (action: () => void) => {
    if ((reply.trim() || note.trim() || status !== feedback.status) && !window.confirm('未保存的处理内容将丢失。继续？')) return;
    action();
  };
  return <>
    <FeedbackThread feedback={feedback} />
    {feedback.article && <button className="outline-button feature-action-button" onClick={() => leave(() => onArticle(feedback.article!.id))}>查看关联文章</button>}
    <form className="feature-form" onSubmit={submit}>
      <SelectField label="处理状态" options={Object.entries(feedbackStatuses)} value={status} onChange={setStatus} disabled={busy} />
      <label>公开回复<textarea value={reply} maxLength={5000} disabled={busy} onChange={(event) => setReply(event.target.value)} /></label>
      <label>内部备注<textarea value={note} maxLength={5000} disabled={busy} onChange={(event) => setNote(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="form-notice" role="status">已保存</p>}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => leave(onBack)}>返回</button>
        {error && <button type="button" className="outline-button" onClick={() => { setRevision((value) => value + 1); setError(''); }}>刷新反馈</button>}
        <button className="primary-button" disabled={busy}>{busy ? '保存中…' : '保存处理'}</button></div>
    </form>
  </>;
}

export function FeedbackPanel({ ownerId, onArticle }: AdminProps & { onArticle: (id: string) => void }) {
  const list = useAdminList<Summary>(ownerId, '/feedback');
  const [selected, setSelected] = useState<string>();
  if (selected) return <FeedbackEditor ownerId={ownerId} id={selected} onBack={() => setSelected(undefined)} onChange={list.refresh} onArticle={onArticle} />;
  return <>
    <div className="admin-filters feature-filters">
      <SelectField label="反馈分类" options={Object.entries(feedbackCategories)} all value={list.filters.category ?? ''} onChange={(value) => list.filter('category', value)} />
      <SelectField label="反馈状态" options={Object.entries(feedbackStatuses)} all value={list.filters.status ?? ''} onChange={(value) => list.filter('status', value)} />
      <label>起始日期<input type="date" value={list.filters.from ?? ''} onChange={(event) => list.filter('from', event.target.value)} /></label>
      <label>结束日期<input type="date" value={list.filters.to ?? ''} onChange={(event) => list.filter('to', event.target.value)} /></label>
    </div>
    {!list.data ? <LoadState error={list.error} retry={list.retry} /> : <>
      {list.data.entries.length ? <ScrollList label="反馈列表">{list.data.entries.map((item) => <li className="feature-row" key={item.id}>
        <div className="feature-row-main"><h3>{item.title}</h3><div className="feature-meta"><span>{feedbackCategories[item.category]}</span><span>{feedbackStatuses[item.status] ?? item.status}</span><DateTime value={item.createdAt} /></div></div>
        <button className="outline-button feature-action-button" aria-label={`查看反馈 ${item.title}`} onClick={() => setSelected(item.id)}>详情</button>
      </li>)}</ScrollList> : <p className="admin-load-state feature-muted">暂无反馈</p>}
      <Pagination data={list.data} setPage={list.setPage} />
    </>}
  </>;
}
