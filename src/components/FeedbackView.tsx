import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ChatCircleText } from '@phosphor-icons/react/ChatCircleText';
import { api } from '../lib/api';

export type FeedbackCategory = 'issue' | 'suggestion' | 'article';
export type FeedbackLink = { id: string; title: string; snapshotKey: string; position: string; wrongText: string };
export type FeedbackDraft = { requestId: string; category: FeedbackCategory; title: string; description: string; attachments: File[]; article?: FeedbackLink };
type FeedbackMessage = { id: string; authorKind: 'user' | 'admin' | 'status'; text: string; createdAt: number; internal?: number };
export type FeedbackDetail = {
  id: string; category: FeedbackCategory; title: string; description: string; status: string; revision: number; createdAt: number; updatedAt: number;
  handledBy?: string | null; handledAt?: number | null;
  article?: FeedbackLink; messages: FeedbackMessage[]; attachments: Array<{ id: string; name: string; url: string }>;
};
type Summary = Pick<FeedbackDetail, 'id' | 'title' | 'category' | 'status' | 'createdAt' | 'updatedAt'>;
type Page = { entries: Summary[]; total: number; page: number; pageSize: number };
const validDate = (value: unknown) => typeof value === 'number' && Number.isFinite(new Date(value).getTime());
function validSummary(value: unknown): value is Summary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && !!item.id && item.id.length <= 200 && typeof item.title === 'string' &&
    ['issue', 'suggestion', 'article'].includes(item.category as string) && typeof item.status === 'string' && validDate(item.createdAt) && validDate(item.updatedAt);
}
function validPage(data: Page) {
  return Array.isArray(data.entries) && data.entries.every(validSummary) && Number.isSafeInteger(data.total) && data.total >= 0 &&
    Number.isSafeInteger(data.page) && data.page >= 1 && Number.isSafeInteger(data.pageSize) && data.pageSize >= 1 && data.pageSize <= 100;
}
function validDetail(value: unknown, expectedId?: string): value is FeedbackDetail {
  if (!validSummary(value)) return false;
  const item = value as unknown as Record<string, unknown>;
  if ((expectedId !== undefined && item.id !== expectedId) || /[\p{Cc}\p{Cf}]/u.test(item.id as string) || typeof item.description !== 'string' ||
    !Number.isSafeInteger(item.revision) || (item.revision as number) < 1 || !Array.isArray(item.messages) || !Array.isArray(item.attachments)) return false;
  return item.messages.every((message: unknown) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
    const row = message as Record<string, unknown>;
    return typeof row.id === 'string' && ['user', 'admin', 'status'].includes(row.authorKind as string) && typeof row.text === 'string' && validDate(row.createdAt);
  }) && item.attachments.every((attachment: unknown) => {
    if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) return false;
    const row = attachment as Record<string, unknown>;
    return typeof row.id === 'string' && typeof row.name === 'string' && typeof row.url === 'string' && row.url.startsWith(`/api/feedback/${encodeURIComponent(item.id as string)}/attachments/`);
  });
}
const maxFileBytes = 5 * 1024 * 1024;
export const feedbackCategories: Record<FeedbackCategory, string> = { issue: '问题反馈', suggestion: '功能建议', article: '文章问题' };
export const feedbackStatuses: Record<string, string> = { pending: '待处理', processing: '处理中', resolved: '已解决', closed: '已关闭' };

function uuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function newFeedbackDraft(article?: FeedbackLink): FeedbackDraft {
  return { requestId: uuid(), category: article ? 'article' : 'issue', title: '', description: '', attachments: [], article };
}
const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('无法读取截图'));
  reader.onerror = () => reject(new Error('无法读取截图'));
  reader.readAsDataURL(file);
});
const dateText = (value: number) => new Date(value).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

export function FeedbackThread({ feedback }: { feedback: FeedbackDetail }) {
  return <div className="feedback-thread">
    <h2>{feedback.title}</h2>
    <div className="feature-meta"><span>{feedbackStatuses[feedback.status] ?? feedback.status}</span><span>编号：{feedback.id}</span><time dateTime={new Date(feedback.createdAt).toISOString()}>{dateText(feedback.createdAt)}</time></div>
    {feedback.handledAt != null && <div className="feature-meta"><span>处理人：{feedback.handledBy || '管理员'}</span><time dateTime={new Date(feedback.handledAt).toISOString()}>{dateText(feedback.handledAt)}</time></div>}
    {feedback.article && <p className="feature-muted">文章：{feedback.article.title} · {feedback.article.id}{feedback.article.position && ` · ${feedback.article.position}`}{feedback.article.wrongText && ` · ${feedback.article.wrongText}`}</p>}
    <p className="feedback-text">{feedback.description}</p>
    {!!feedback.attachments.length && <div className="feedback-attachments">{feedback.attachments.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"><img src={item.url} alt={item.name} loading="lazy" /></a>)}</div>}
    {!!feedback.messages.length && <ol className="feedback-messages">{feedback.messages.map((message) => <li key={message.id}>
      <div className="feature-meta"><strong>{message.internal ? '内部备注' : message.authorKind === 'status' ? '状态' : message.authorKind === 'admin' ? '管理员回复' : '补充信息'}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{dateText(message.createdAt)}</time></div>
      <p className="feedback-text">{message.authorKind === 'status' ? feedbackStatuses[message.text] ?? message.text : message.text}</p>
    </li>)}</ol>}
  </div>;
}

export function FeedbackView({ ownerId, draft, setDraft, onLogin, routeFeedbackId, onOpenFeedback, onCloseFeedback }: {
  ownerId: string | null; draft: FeedbackDraft; setDraft: (draft: FeedbackDraft) => void; onLogin: (draft: FeedbackDraft) => void;
  routeFeedbackId?: string; onOpenFeedback?: (id: string) => void; onCloseFeedback?: () => void;
}) {
  const [list, setList] = useState<Page>();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<FeedbackDetail>();
  const [supplement, setSupplement] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const mounted = useRef(true);
  const routeRef = useRef(routeFeedbackId); routeRef.current = routeFeedbackId;
  const shownDetail = onOpenFeedback ? (routeFeedbackId && detail?.id === routeFeedbackId ? detail : undefined) : detail;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const patch = (change: Partial<FeedbackDraft>) => setDraft({ ...draft, ...change, requestId: uuid() });

  useEffect(() => {
    if (!ownerId) { setList(undefined); return; }
    const controller = new AbortController();
    setListError('');
    api<Page>(`/api/feedback?page=${page}&pageSize=20`, { headers: { 'X-Workspace-Owner': ownerId }, signal: controller.signal })
      .then((data) => { if (!validPage(data)) throw new Error('反馈列表无法读取'); if (!controller.signal.aborted) setList(data); })
      .catch((problem: unknown) => { if (!controller.signal.aborted) setListError(problem instanceof Error ? problem.message : '加载失败'); });
    return () => controller.abort();
  }, [ownerId, page, revision]);

  useEffect(() => {
    if (!onOpenFeedback) return;
    setDetailError('');
    if (!routeFeedbackId || !ownerId) { setDetail(undefined); setDetailLoading(false); return; }
    const controller = new AbortController();
    setDetail(undefined); setDetailLoading(true);
    api<{ feedback: FeedbackDetail }>(`/api/feedback/${encodeURIComponent(routeFeedbackId)}`, { headers: { 'X-Workspace-Owner': ownerId }, signal: controller.signal })
      .then(({ feedback }) => {
        if (!validDetail(feedback, routeFeedbackId)) throw new Error('反馈数据无法读取');
        if (!controller.signal.aborted) { setDetail(feedback); setSupplement(''); }
      }).catch((problem: unknown) => { if (!controller.signal.aborted) setDetailError(problem instanceof Error ? problem.message : '加载失败'); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [ownerId, routeFeedbackId, detailRetry]); // eslint-disable-line react-hooks/exhaustive-deps

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]; event.target.value = '';
    if (files.length + draft.attachments.length > 3 || files.some((file) => file.size > maxFileBytes || (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)))) {
      setError('最多 3 张 JPG、PNG 或 WebP 截图，每张不超过 5 MiB'); return;
    }
    setError(''); patch({ attachments: [...draft.attachments, ...files] });
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!ownerId) { onLogin(draft); return; }
    const routeAtStart = routeRef.current;
    setBusy(true);
    try {
      const attachments = await Promise.all(draft.attachments.map(async (file) => ({ name: file.name, data: await readFile(file) })));
      const article = draft.article && { id: draft.article.id, snapshotKey: draft.article.snapshotKey, position: draft.article.position, wrongText: draft.article.wrongText };
      const response = await api<{ feedback: FeedbackDetail }>('/api/feedback', { method: 'POST', headers: { 'X-Workspace-Owner': ownerId }, timeoutMs: 60_000,
        body: { requestId: draft.requestId, category: draft.category, title: draft.title, description: draft.description, attachments, ...(article && { article }) } });
      if (!validDetail(response.feedback)) throw new Error('提交结果无法确认，请重试');
      if (!mounted.current) return;
      setDraft(newFeedbackDraft()); setPage(1); setRevision((value) => value + 1);
      if (onOpenFeedback && routeRef.current !== routeAtStart) return;
      setDetail(response.feedback); onOpenFeedback?.(response.feedback.id);
    } catch (problem) { if (mounted.current) setError(problem instanceof Error ? problem.message : '提交失败'); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function openDetail(id: string) {
    if (!ownerId) return;
    if (onOpenFeedback) { onOpenFeedback(id); return; }
    setBusy(true); setError('');
    try {
      const response = await api<{ feedback: FeedbackDetail }>(`/api/feedback/${encodeURIComponent(id)}`, { headers: { 'X-Workspace-Owner': ownerId } });
      if (!validDetail(response.feedback, id)) throw new Error('反馈数据无法读取');
      setDetail(response.feedback); setSupplement('');
    } catch (problem) { setError(problem instanceof Error ? problem.message : '加载失败'); }
    finally { setBusy(false); }
  }
  async function addMessage(event: FormEvent) {
    event.preventDefault(); if (!ownerId || !detail) return;
    const requestedId = detail.id;
    setBusy(true); setError('');
    try {
      const response = await api<{ feedback: FeedbackDetail }>(`/api/feedback/${encodeURIComponent(requestedId)}/messages`, { method: 'POST', headers: { 'X-Workspace-Owner': ownerId }, body: { text: supplement } });
      if (!validDetail(response.feedback, requestedId)) throw new Error('反馈数据无法读取');
      if (!mounted.current || (onOpenFeedback && routeRef.current !== requestedId)) return;
      setDetail(response.feedback); setSupplement(''); setRevision((value) => value + 1);
    } catch (problem) { if (mounted.current && (!onOpenFeedback || routeRef.current === requestedId)) setError(problem instanceof Error ? problem.message : '补充失败'); }
    finally { if (mounted.current) setBusy(false); }
  }

  return <section className="content-panel feature-panel feedback-panel">
    <div className="content-heading"><h1><ChatCircleText size={25} aria-hidden="true" />功能反馈</h1></div>
    {routeFeedbackId && !ownerId ? <div className="feature-form"><p>请先登录</p><button type="button" className="outline-button" onClick={() => onLogin(draft)}>登录</button></div> :
      routeFeedbackId && !shownDetail ? <div className="feature-form">{detailLoading || !detailError ? <p role="status">正在读取反馈…</p> : <><p className="form-error" role="alert">{detailError}</p><button type="button" className="outline-button" onClick={() => setDetailRetry((value) => value + 1)}>重试</button></>}<button type="button" className="outline-button" onClick={onCloseFeedback}>返回反馈</button></div> :
      shownDetail ? <>
      <FeedbackThread feedback={shownDetail} />
      <form className="feature-form" onSubmit={addMessage}><label>补充信息<textarea value={supplement} maxLength={5000} required disabled={busy} onChange={(event) => setSupplement(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="feature-actions"><button className="outline-button" type="button" disabled={busy} onClick={() => { setError(''); if (onCloseFeedback) onCloseFeedback(); else setDetail(undefined); }}>返回</button><button className="primary-button" disabled={busy}>提交补充</button></div>
      </form>
    </> : <>
      <form className="feature-form" onSubmit={submit}>
        <label>分类<select value={draft.category} disabled={busy} onChange={(event) => { const value = event.target.value as FeedbackCategory; patch({ category: value, ...(value !== 'article' && { article: undefined }) }); }}>{Object.entries(feedbackCategories).map(([value, name]) => <option value={value} key={value}>{name}</option>)}</select></label>
        {draft.article && <><p className="feature-muted">文章：{draft.article.title}</p>
          <label>位置<input value={draft.article.position} maxLength={200} disabled={busy} onChange={(event) => patch({ article: { ...draft.article!, position: event.target.value } })} /></label>
          <label>错误内容<input value={draft.article.wrongText} maxLength={500} disabled={busy} onChange={(event) => patch({ article: { ...draft.article!, wrongText: event.target.value } })} /></label></>}
        <label>标题<input value={draft.title} maxLength={160} required disabled={busy} onChange={(event) => patch({ title: event.target.value })} /></label>
        <label>详细描述<textarea value={draft.description} maxLength={5000} required disabled={busy} onChange={(event) => patch({ description: event.target.value })} /></label>
        <label>截图（最多 3 张，每张 5 MiB）<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={chooseFiles} /></label>
        {!!draft.attachments.length && <ul className="feedback-files">{draft.attachments.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" className="text-button" disabled={busy} aria-label={`移除 ${file.name}`} onClick={() => patch({ attachments: draft.attachments.filter((_, position) => position !== index) })}>移除</button></li>)}</ul>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="feature-actions"><button className="primary-button" disabled={busy}>{busy ? '提交中…' : ownerId ? '提交反馈' : '登录后提交'}</button></div>
      </form>
      {ownerId && <div className="feedback-list"><h2>我的反馈</h2>
        {listError ? <><p className="form-error" role="alert">{listError}</p><button className="outline-button" onClick={() => setRevision((value) => value + 1)}>重试</button></> : !list ? <p role="status">加载中…</p> : !list.entries.length ? <p className="feature-muted">暂无反馈</p> : <>
          <ul className="feature-list">{list.entries.map((item) => <li className="feature-row" key={item.id}><div className="feature-row-main"><h3>{item.title}</h3><div className="feature-meta"><span>{feedbackCategories[item.category]}</span><span>{feedbackStatuses[item.status] ?? item.status}</span><time dateTime={new Date(item.createdAt).toISOString()}>{dateText(item.createdAt)}</time></div></div><button className="outline-button" disabled={busy} onClick={() => void openDetail(item.id)}>详情</button></li>)}</ul>
          {list.total > list.pageSize && <div className="feature-actions"><button className="outline-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button><span>{page}</span><button className="outline-button" disabled={page * list.pageSize >= list.total} onClick={() => setPage(page + 1)}>下一页</button></div>}
        </>}
      </div>}
    </>}
  </section>;
}
