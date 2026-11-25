import {X} from '@phosphor-icons/react/X';
import { SystemMessage } from './SystemMessage';
import { useI18n, type UiLocale } from '../lib/i18n';
import { useSiteFooter } from '../hooks/useSiteFooter';
import { renderMarkdownToHtml } from '../lib/markdown';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ChatCircleText } from '@phosphor-icons/react/ChatCircleText';
import { api } from '../lib/api';
import { stageFeedbackAttachments } from '../lib/feedback-upload';

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

export function feedbackCategoryLabel(category: FeedbackCategory, locale: UiLocale) {
  return locale === 'en' ? ({ issue: 'Issue', suggestion: 'Suggestion', article: 'Article issue' } as const)[category] : feedbackCategories[category];
}
export function feedbackStatusLabel(status: string, locale: UiLocale) {
  const english: Record<string, string> = { pending: 'Pending', processing: 'In progress', resolved: 'Resolved', closed: 'Closed' };
  return (locale === 'en' ? english[status] : feedbackStatuses[status]) ?? status;
}

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
const dateText = (value: number, locale: UiLocale) => new Date(value).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

export function FeedbackThread({ feedback }: { feedback: FeedbackDetail }) {
  const { t, locale } = useI18n();
  return <div className="feedback-thread">
    <h2>{feedback.title}</h2>
    <div className="feature-meta"><span>{feedbackStatusLabel(feedback.status, locale)}</span><span>{t("编号：", "ID:")}{feedback.id}</span><time dateTime={new Date(feedback.createdAt).toISOString()}>{dateText(feedback.createdAt, locale)}</time></div>
    {feedback.handledAt != null && <div className="feature-meta"><span>{t("处理人：", "Assigned to:")}{feedback.handledBy || t("管理员", "Administrator")}</span><time dateTime={new Date(feedback.handledAt).toISOString()}>{dateText(feedback.handledAt, locale)}</time></div>}
    {feedback.article && <p className="feature-muted">{t("文章：", "Article:")}{feedback.article.title} · {feedback.article.id}{feedback.article.position && ` · ${feedback.article.position}`}{feedback.article.wrongText && ` · ${feedback.article.wrongText}`}</p>}
    <p className="feedback-text">{feedback.description}</p>
    {!!feedback.attachments.length && <div className="feedback-attachments">{feedback.attachments.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"><img src={item.url} alt={item.name} loading="lazy" /></a>)}</div>}
    {!!feedback.messages.length && <ol className="feedback-messages">{feedback.messages.map((message) => <li key={message.id}>
      <div className="feature-meta"><strong>{message.internal ? t("内部备注", "Internal note") : message.authorKind === 'status' ? t("状态", "Status") : message.authorKind === 'admin' ? t("管理员回复", "Admin reply") : t("补充信息", "Add information")}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{dateText(message.createdAt, locale)}</time></div>
      <p className="feedback-text">{message.authorKind === 'status' ? feedbackStatusLabel(message.text, locale) : message.text}</p>
    </li>)}</ol>}
  </div>;
}

export function FeedbackView({ ownerId, draft, setDraft, onLogin, routeFeedbackId, onOpenFeedback, onCloseFeedback,onClose }: {
  ownerId: string | null; draft: FeedbackDraft; setDraft: (draft: FeedbackDraft) => void; onLogin: (draft: FeedbackDraft) => void;
  onClose?:()=>void;routeFeedbackId?: string; onOpenFeedback?: (id: string) => void; onCloseFeedback?: () => void;
}) {
  const { t, locale } = useI18n();
  const footer = useSiteFooter();
  const feedbackButton = footer.buttons.find((item) => item.id === 'feedback');
  const feedbackHeading = feedbackButton ? (locale === 'en' ? (feedbackButton.labelEn || 'Feedback') : (feedbackButton.labelZh || '功能反馈')) : t('功能反馈', 'Feedback');
  const feedbackIntroMd = (locale === 'en' ? (footer.pages.feedback?.en || footer.pages.feedback?.zh) : (footer.pages.feedback?.zh || footer.pages.feedback?.en))?.trim() ?? '';
  const feedbackIntroHtml = feedbackIntroMd ? renderMarkdownToHtml(feedbackIntroMd) : '';
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
      .then((data) => { if (!validPage(data)) throw new Error(t("反馈列表无法读取", "Could not read feedback list")); if (!controller.signal.aborted) setList(data); })
      .catch((problem: unknown) => { if (!controller.signal.aborted) setListError(problem instanceof Error ? problem.message : t("加载失败", "Loading failed")); });
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
        if (!validDetail(feedback, routeFeedbackId)) throw new Error(t("反馈数据无法读取", "Could not read feedback"));
        if (!controller.signal.aborted) { setDetail(feedback); setSupplement(''); }
      }).catch((problem: unknown) => { if (!controller.signal.aborted) setDetailError(problem instanceof Error ? problem.message : t("加载失败", "Loading failed")); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [ownerId, routeFeedbackId, detailRetry]); // eslint-disable-line react-hooks/exhaustive-deps

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]; event.target.value = '';
    if (files.length + draft.attachments.length > 3 || files.some((file) => file.size > maxFileBytes || (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)))) {
      setError(t("最多 3 张 JPG、PNG 或 WebP 截图，每张不超过 5 MiB", "Up to 3 JPG, PNG or WebP screenshots, each under 5 MiB")); return;
    }
    setError(''); patch({ attachments: [...draft.attachments, ...files] });
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!ownerId) { onLogin(draft); return; }
    const routeAtStart = routeRef.current;
    setBusy(true);
    try {
      const attachments = await stageFeedbackAttachments(draft.attachments, ownerId, draft.requestId);
      const article = draft.article && { id: draft.article.id, snapshotKey: draft.article.snapshotKey, position: draft.article.position, wrongText: draft.article.wrongText };
      const response = await api<{ feedback: FeedbackDetail }>('/api/feedback', { method: 'POST', headers: { 'X-Workspace-Owner': ownerId }, timeoutMs: 60_000,
        body: { requestId: draft.requestId, category: draft.category, title: draft.title, description: draft.description, attachments, ...(article && { article }) } });
      if (!validDetail(response.feedback)) throw new Error(t("提交结果无法确认，请重试", "Could not confirm submission. Please retry."));
      if (!mounted.current) return;
      setDraft(newFeedbackDraft()); setPage(1); setRevision((value) => value + 1);
      if (onOpenFeedback && routeRef.current !== routeAtStart) return;
      setDetail(response.feedback); onOpenFeedback?.(response.feedback.id);
    } catch (problem) { if (mounted.current) setError(problem instanceof Error ? problem.message : t("提交失败", "Submission failed")); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function openDetail(id: string) {
    if (!ownerId) return;
    if (onOpenFeedback) { onOpenFeedback(id); return; }
    setBusy(true); setError('');
    try {
      const response = await api<{ feedback: FeedbackDetail }>(`/api/feedback/${encodeURIComponent(id)}`, { headers: { 'X-Workspace-Owner': ownerId } });
      if (!validDetail(response.feedback, id)) throw new Error(t("反馈数据无法读取", "Could not read feedback"));
      setDetail(response.feedback); setSupplement('');
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("加载失败", "Loading failed")); }
    finally { setBusy(false); }
  }
  async function addMessage(event: FormEvent) {
    event.preventDefault(); if (!ownerId || !detail) return;
    const requestedId = detail.id;
    setBusy(true); setError('');
    try {
      const response = await api<{ feedback: FeedbackDetail }>(`/api/feedback/${encodeURIComponent(requestedId)}/messages`, { method: 'POST', headers: { 'X-Workspace-Owner': ownerId }, body: { text: supplement } });
      if (!validDetail(response.feedback, requestedId)) throw new Error(t("反馈数据无法读取", "Could not read feedback"));
      if (!mounted.current || (onOpenFeedback && routeRef.current !== requestedId)) return;
      setDetail(response.feedback); setSupplement(''); setRevision((value) => value + 1);
    } catch (problem) { if (mounted.current && (!onOpenFeedback || routeRef.current === requestedId)) setError(problem instanceof Error ? problem.message : t("补充失败", "Could not add information")); }
    finally { if (mounted.current) setBusy(false); }
  }

  return <section className="content-panel feature-panel feedback-panel">
    <div className="content-heading"><h1><ChatCircleText size={25} aria-hidden="true" />{feedbackHeading}</h1>{onClose&&<button type="button" className="icon-button" aria-label={t('关闭功能反馈','Close feedback')} title={t('关闭','Close')} disabled={busy} onClick={onClose}><X size={22} aria-hidden="true"/></button>}</div>
    {!routeFeedbackId && feedbackIntroHtml && <div className="markdown-body feedback-intro" dangerouslySetInnerHTML={{ __html: feedbackIntroHtml }} />}
    {routeFeedbackId && !ownerId ? <div className="feature-form"><p>{t("请先登录", "Please sign in")}</p><button type="button" className="outline-button" onClick={() => onLogin(draft)}>{t("登录", "Sign in")}</button></div> :
      routeFeedbackId && !shownDetail ? <div className="feature-form">{detailLoading || !detailError ? <p role="status">{t("正在读取反馈…", "Loading feedback…")}</p> : <><p className="form-error" role="alert">{detailError}</p><button type="button" className="outline-button" onClick={() => setDetailRetry((value) => value + 1)}>{t("重试", "Retry")}</button></>}<button type="button" className="outline-button" onClick={onCloseFeedback}>{t("返回反馈", "Back to feedback")}</button></div> :
      shownDetail ? <>
      <FeedbackThread feedback={shownDetail} />
      <form className="feature-form" onSubmit={addMessage}><label>{t("补充信息", "Add information")}<textarea value={supplement} maxLength={5000} required disabled={busy} onChange={(event) => setSupplement(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{<SystemMessage text={error} />}</p>}
        <div className="feature-actions"><button className="outline-button" type="button" disabled={busy} onClick={() => { setError(''); if (onCloseFeedback) onCloseFeedback(); else setDetail(undefined); }}>{t("返回", "Back")}</button><button className="primary-button" disabled={busy}>{t("提交补充", "Submit update")}</button></div>
      </form>
    </> : <>
      <form className="feature-form" onSubmit={submit}>
        <label>{t("分类", "Category")}<select value={draft.category} disabled={busy} onChange={(event) => { const value = event.target.value as FeedbackCategory; patch({ category: value, ...(value !== 'article' && { article: undefined }) }); }}>{Object.entries(feedbackCategories).map(([value, name]) => <option value={value} key={value}>{feedbackCategoryLabel(value as FeedbackCategory, locale)}</option>)}</select></label>
        {draft.article && <><p className="feature-muted">{t("文章：", "Article:")}{draft.article.title}</p>
          <label>{t("位置", "Location")}<input value={draft.article.position} maxLength={200} disabled={busy} onChange={(event) => patch({ article: { ...draft.article!, position: event.target.value } })} /></label>
          <label>{t("错误内容", "Incorrect text")}<input value={draft.article.wrongText} maxLength={500} disabled={busy} onChange={(event) => patch({ article: { ...draft.article!, wrongText: event.target.value } })} /></label></>}
        <label>{t("标题", "Title")}<input value={draft.title} maxLength={160} required disabled={busy} onChange={(event) => patch({ title: event.target.value })} /></label>
        <label>{t("详细描述", "Description")}<textarea value={draft.description} maxLength={5000} required disabled={busy} onChange={(event) => patch({ description: event.target.value })} /></label>
        <label>{t("截图（最多 3 张，每张 5 MiB）", "Screenshots (up to 3, 5 MiB each)")}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={chooseFiles} /></label>
        {!!draft.attachments.length && <ul className="feedback-files">{draft.attachments.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" className="text-button" disabled={busy} aria-label={`${t('移除', 'Remove')} ${file.name}`} onClick={() => patch({ attachments: draft.attachments.filter((_, position) => position !== index) })}>{t("移除", "Remove")}</button></li>)}</ul>}
        {error && <p className="form-error" role="alert">{<SystemMessage text={error} />}</p>}
        <div className="feature-actions"><button className="primary-button" disabled={busy}>{busy ? t("提交中…", "Submitting…") : ownerId ? t("提交反馈", "Submit feedback") : t("登录后提交", "Sign in to submit")}</button></div>
      </form>
      {ownerId && <div className="feedback-list"><h2>{t("我的反馈", "My feedback")}</h2>
        {listError ? <><p className="form-error" role="alert">{listError}</p><button className="outline-button" onClick={() => setRevision((value) => value + 1)}>{t("重试", "Retry")}</button></> : !list ? <p role="status">{t("加载中…", "Loading…")}</p> : !list.entries.length ? <p className="feature-muted">{t("暂无反馈", "No feedback")}</p> : <>
          <ul className="feature-list">{list.entries.map((item) => <li className="feature-row" key={item.id}><div className="feature-row-main"><h3>{item.title}</h3><div className="feature-meta"><span>{feedbackCategoryLabel(item.category, locale)}</span><span>{feedbackStatusLabel(item.status, locale)}</span><time dateTime={new Date(item.createdAt).toISOString()}>{dateText(item.createdAt, locale)}</time></div></div><button className="outline-button" disabled={busy} onClick={() => void openDetail(item.id)}>{t("详情", "Details")}</button></li>)}</ul>
          {list.total > list.pageSize && <div className="feature-actions"><button className="outline-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("上一页", "Previous")}</button><span>{page}</span><button className="outline-button" disabled={page * list.pageSize >= list.total} onClick={() => setPage(page + 1)}>{t("下一页", "Next")}</button></div>}
        </>}
      </div>}
    </>}
  </section>;
}
