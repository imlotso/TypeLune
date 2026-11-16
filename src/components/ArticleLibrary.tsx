import { SystemMessage } from './SystemMessage';
import { useI18n } from '../lib/i18n';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Books } from '@phosphor-icons/react/Books';
import { FileText } from '@phosphor-icons/react/FileText';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Plus } from '@phosphor-icons/react/Plus';
import { Star } from '@phosphor-icons/react/Star';
import { Trash } from '@phosphor-icons/react/Trash';
import type { Difficulty, Language } from '../data/articles';
import { articleLength, MAX_PRIVATE_BYTES, MAX_PRIVATE_CHARACTERS } from '../lib/analysis';
import type { ArticleSnapshot, PrivateArticle } from '../lib/models';
import { splitCharacters } from '../lib/scoring';
import { Dialog } from './Dialog';

type Props = {
  articles: ArticleSnapshot[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onSelect: (article: ArticleSnapshot) => void;
  onOpenArticle?: (id: string) => void;
  onSave: (article: PrivateArticle) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  initialTab?: 'all' | 'favorites' | 'private';
  isSignedIn?: boolean;
  onLogin?: () => void;
};


const emotionsOf = (article: ArticleSnapshot) => article.theme?.split(/[与、]/u).map((part) => part.trim()).filter(Boolean) ?? [];
const normalizeText = (value: string) => value.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n').normalize('NFC');

function validateText(text: string, t: (zh: string, en: string) => string) {
  if (!text.trim()) return t("请输入正文", "Enter article text");
  if (text.length > MAX_PRIVATE_CHARACTERS) return t("正文不能超过 20,000 字符", "Text must not exceed 20,000 characters");
  if (new TextEncoder().encode(text).length > MAX_PRIVATE_BYTES) return t("正文不能超过 100 KB", "Text must not exceed 100 KB");
  return '';
}

function privateArticleId() {
  if (typeof crypto.randomUUID === 'function') return `my-${crypto.randomUUID()}`;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `my-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readTxt(file: File, t: (zh: string, en: string) => string) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(new TextDecoder('utf-8', { fatal: true }).decode(reader.result as ArrayBuffer)); }
      catch { reject(new Error(t("TXT 编码须为 UTF-8", "TXT must use UTF-8 encoding"))); }
    };
    reader.onerror = () => reject(new Error(t("无法读取 TXT", "Could not read TXT")));
    reader.readAsArrayBuffer(file);
  });
}

function ArticleEditor({ article, initialLanguage, onSave, onClose }: {
  article: PrivateArticle | null;
  initialLanguage: Language;
  onSave: (article: PrivateArticle) => Promise<void>;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
const difficultyNames: Record<Difficulty, string> = { beginner: t("入门", "Beginner"), intermediate: t("进阶", "Intermediate"), advanced: t("挑战", "Advanced") };

  const [title, setTitle] = useState(article?.title ?? '');
  const [language, setLanguage] = useState(article?.language ?? initialLanguage);
  const [difficulty, setDifficulty] = useState<Difficulty>(article?.difficulty ?? 'beginner');
  const [body, setBody] = useState(article?.text ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{ type: 'discard' } | { type: 'replace'; text: string; filename: string }>();
  const safeAction = useRef<HTMLButtonElement>(null);
  const bodyField = useRef<HTMLTextAreaElement>(null);
  const hadConfirmation = useRef(false);
  const changed = title !== (article?.title ?? '') || body !== (article?.text ?? '') ||
    language !== (article?.language ?? initialLanguage) || difficulty !== (article?.difficulty ?? 'beginner');
  useEffect(() => {
    if (confirmation) { hadConfirmation.current = true; safeAction.current?.focus(); }
    else if (hadConfirmation.current) { bodyField.current?.focus(); hadConfirmation.current = false; }
  }, [confirmation]);

  function closeEditor() {
    if (busy) return;
    if (confirmation) { setConfirmation(undefined); return; }
    if (changed) setConfirmation({ type: 'discard' });
    else onClose();
  }
  function applyImport(text: string, filename: string) {
    setBody(text);
    setTitle((current) => current.trim() ? current : filename.replace(/\.txt$/iu, '').slice(0, 200));
    setConfirmation(undefined);
  }

  async function importTxt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.txt$/iu.test(file.name)) { setError(t("请选择 TXT 文件", "Choose a TXT file")); return; }
    if (file.size > MAX_PRIVATE_BYTES) { setError(t("TXT 文件不能超过 100 KB", "TXT must not exceed 100 KB")); return; }
    setBusy(true);
    setError('');
    try {
      const text = normalizeText(await readTxt(file, t));
      const invalid = validateText(text, t);
      if (invalid) { setError(invalid); return; }
      if (body && body !== text) setConfirmation({ type: 'replace', text, filename: file.name });
      else applyImport(text, file.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("无法读取 TXT", "Could not read TXT"));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const cleanTitle = title.trim();
    const text = normalizeText(body);
    const invalid = cleanTitle ? validateText(text, t) : t("请输入标题", "Enter a title");
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    setError('');
    try {
      const id = article?.id ?? privateArticleId();
      await onSave({ ...article, id, title: cleanTitle, language, difficulty, text, custom: true });
    } catch {
      setError(t("保存失败", "Could not save"));
      setBusy(false);
    }
  }

  const dialogTitle = confirmation?.type === 'discard' ? t("放弃未保存的修改？", "Discard unsaved changes?") : confirmation?.type === 'replace' ? t("替换当前正文？", "Replace current text?") : article ? t("编辑文章", "Edit article") : t("新建文章", "New article");
  return <Dialog title={dialogTitle} onClose={closeEditor} dismissible={!busy}>
    {confirmation ? <div className="feature-form">
      <p>{confirmation.type === 'discard' ? t("未保存的文章修改将丢失。", "Unsaved article changes will be lost.") : t("当前正文将被 TXT 内容替换。", "The TXT content will replace the current text.")}</p>
      <div className="feature-actions">
        <button ref={safeAction} type="button" className="outline-button" onClick={() => setConfirmation(undefined)}>{confirmation.type === 'discard' ? t("继续编辑", "Keep editing") : t("取消", "Cancel")}</button>
        <button type="button" className="primary-button" onClick={() => confirmation.type === 'discard' ? onClose() : applyImport(confirmation.text, confirmation.filename)}>{confirmation.type === 'discard' ? t("放弃修改", "Discard changes") : t("替换正文", "Replace text")}</button>
      </div>
    </div> : <form className="feature-form" onSubmit={submit}>
      <label>{t("标题", "Title")}<input value={title} maxLength={200} disabled={busy} onChange={(event) => setTitle(event.target.value)} /></label>
      <div className="feature-form-pair">
        <label>{t("语言", "Article language")}<select value={language} disabled={busy} onChange={(event) => setLanguage(event.target.value as Language)}><option value="zh">{t("中文", "Chinese")}</option><option value="en">English</option></select></label>
        <label>{t("难度", "Difficulty")}<select value={difficulty} disabled={busy} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>{Object.entries(difficultyNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
      </div>
      <label>{t("正文", "Text")}<textarea ref={bodyField} value={body} rows={7} disabled={busy} onChange={(event) => setBody(event.target.value)} /></label>
      <span className="feature-muted feature-editor-count">{splitCharacters(body.slice(0, MAX_PRIVATE_CHARACTERS + 1)).length.toLocaleString()} {t("字符", "characters")}</span>
      <label className="feature-file"><span><FileText size={16} /> {t("导入 TXT", "Import TXT")}</span><input type="file" accept=".txt,text/plain" disabled={busy} onChange={(event) => void importTxt(event)} /></label>
      {error && <p className="form-error" role="alert">{<SystemMessage text={error} />}</p>}
      <div className="feature-actions">
        <button type="button" className="outline-button" disabled={busy} onClick={closeEditor}>{t("取消", "Cancel")}</button>
        <button type="submit" className="primary-button" disabled={busy}>{t("保存", "Save")}</button>
      </div>
    </form>}
  </Dialog>;
}

export function ArticleLibrary({ articles, favorites, onToggleFavorite, onSelect, onOpenArticle, onSave, onDelete, initialTab = 'all', isSignedIn = false, onLogin }: Props) {
  const { t, locale } = useI18n();
const difficultyNames: Record<Difficulty, string> = { beginner: t("入门", "Beginner"), intermediate: t("进阶", "Intermediate"), advanced: t("挑战", "Advanced") };
const libraryTabs = { all: t("全部", "All"), favorites: t("收藏", "Favorites"), private: t("我的文章", "My articles") } as const;
const lengthRanges = [
  { min: 0, max: 999, label: t("少于 1,000", "Under 1,000") },
  { min: 1000, max: 1999, label: '1,000–1,999' },
  { min: 2000, max: Infinity, label: t("2,000 以上", "2,000 or more") },
];

  const [language, setLanguage] = useState<Language>('zh');
  const [tab, setTab] = useState<keyof typeof libraryTabs>(initialTab);
  const [search, setSearch] = useState('');
  const [emotion, setEmotion] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [length, setLength] = useState('');
  const [editor, setEditor] = useState<PrivateArticle | null>();
  const [deleting, setDeleting] = useState<ArticleSnapshot>();
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const catalog = useMemo(() => articles.map((article) => ({ article, size: articleLength(article), emotions: emotionsOf(article) })), [articles]);
  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);
  const collection = catalog.filter(({ article }) => article.language === language);
  const themes = [...new Set(collection.flatMap(({ emotions }) => emotions))];
  const query = search.trim().toLocaleLowerCase();
  const range = length ? lengthRanges[Number(length)] : undefined;
  const matches = collection.filter(({ article, emotions, size }) =>
    (tab !== 'private' || article.custom) &&
    (tab !== 'favorites' || favoriteIds.has(article.id)) &&
    (!query || [article.title, article.author, article.theme].some((value) => value?.toLocaleLowerCase().includes(query))) &&
    (!emotion || emotions.includes(emotion)) &&
    (!difficulty || article.difficulty === difficulty) &&
    (!range || (size >= range.min && size <= range.max)));

  async function saveArticle(article: PrivateArticle) {
    await onSave(article);
    setEditor(undefined);
    setTab('private');
    setLanguage(article.language);
    setSearch('');
    setEmotion('');
    setDifficulty('');
    setLength('');
  }

  async function deleteArticle() {
    if (!deleting || deletePending) return;
    setDeletePending(true);
    setDeleteError(false);
    try {
      await onDelete(deleting.id);
      setDeleting(undefined);
    } catch {
      setDeleteError(true);
    } finally {
      setDeletePending(false);
    }
  }

  return <section className="content-panel library feature-panel">
    <div className="content-heading">
      <h1><Books size={25} aria-hidden="true" /> {t("文章库", "Library")}</h1>
      <button className="outline-button feature-action-button" onClick={() => setEditor(null)}><Plus size={16} aria-hidden="true" /> {t("新建文章", "New article")}</button>
    </div>
    <div className="feature-toolbar">
      <div className="segmented feature-segments" role="group" aria-label={t("文章语言", "Article language")}>
        <button aria-pressed={language === 'zh'} onClick={() => { setLanguage('zh'); setEmotion(''); }}>{t("中文", "Chinese")}</button>
        <button aria-pressed={language === 'en'} onClick={() => { setLanguage('en'); setEmotion(''); }}>English</button>
      </div>
      <div className="segmented feature-segments" role="group" aria-label={t("文章分类", "Article collection")}>
        {Object.entries(libraryTabs).map(([key, name]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key as keyof typeof libraryTabs)}>{name}</button>)}
      </div>
    </div>
    <div className="feature-filters">
      <label>{t("搜索", "Search")}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label>{t("情绪", "Mood")}<select value={emotion} onChange={(event) => setEmotion(event.target.value)}><option value="">{t("全部", "All")}</option>{themes.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>{t("难度", "Difficulty")}<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="">{t("全部", "All")}</option>{Object.entries(difficultyNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label>{t("篇幅", "Length")}<select value={length} onChange={(event) => setLength(event.target.value)}><option value="">{t("全部", "All")}</option>{lengthRanges.map(({ label }, index) => <option key={label} value={index}>{label}</option>)}</select></label>
    </div>
    <ul className="feature-list">
    {!matches.length && <li><p className="empty-state">{t("暂无匹配文章", "No matching articles")}</p></li>}
      {matches.map(({ article, size }) => <li key={article.id} className="feature-row">
        <div className="feature-row-main">
          <h2>{article.title}</h2>
          <div className="feature-meta">
            {article.author && <span>{article.author}</span>}
            {article.theme && <span>{article.theme}</span>}
            <span>{difficultyNames[article.difficulty]}</span>
            <span>{size.toLocaleString()} {language === 'zh' ? t("字", "characters") : t("词", "words")}</span>
            {article.source && /^https?:\/\//iu.test(article.source.url) && <a href={article.source.url} target="_blank" rel="noreferrer" aria-label={t(`查看《${article.title}》原文`, `Source for ${article.title}`)}>{t("原文", "Source")}</a>}
          </div>
        </div>
        <div className="feature-actions">
          <button className="icon-button feature-star" aria-label={t(`收藏《${article.title}》`, `Favorite ${article.title}`)} aria-pressed={favoriteIds.has(article.id)} onClick={() => onToggleFavorite(article.id)}><Star size={19} weight={favoriteIds.has(article.id) ? 'fill' : 'regular'} aria-hidden="true" /></button>
          {article.custom && <>
            <button className="icon-button" aria-label={t(`编辑《${article.title}》`, `Edit ${article.title}`)} onClick={() => setEditor({ ...article, custom: true })}><PencilSimple size={19} aria-hidden="true" /></button>
            <button className="icon-button" aria-label={t(`删除《${article.title}》`, `Delete ${article.title}`)} onClick={() => { setDeleting(article); setDeleteError(false); }}><Trash size={19} aria-hidden="true" /></button>
          </>}
          {!article.custom && onOpenArticle && <button type="button" className="text-button" aria-label={t(`查看《${article.title}》`, `View ${article.title}`)} onClick={() => onOpenArticle(article.id)}>{t("详情", "Details")}</button>}
          <button className="outline-button feature-action-button" aria-label={t(`练习《${article.title}》`, `Practice ${article.title}`)} onClick={() => onSelect(article)}>{t("练习", "Practice")}</button>
        </div>
      </li>)}
      <li className="library-import-row"><div className="library-import-card">
        <span className="library-import-icon" aria-hidden="true"><FileText size={24} /></span>
        <div className="library-import-copy"><h2>{t("还没找到想练的文章？", "Not finding the right article?")}</h2>
          <p>{isSignedIn ? t("导入喜欢的内容，开始自己的练习。", "Import something you love and make it your next practice.") : t("可直接导入，保存在此浏览器；登录后可导入账号并同步。", "Import locally in this browser. Sign in to copy your articles to your account and sync.")}</p>
        </div>
        <div className="library-import-actions">
          <button type="button" className="outline-button" onClick={() => setEditor(null)}>{t("导入自己的文章", "Import your article")} <span aria-hidden="true">→</span></button>
          {!isSignedIn && onLogin && <button type="button" className="text-button" onClick={onLogin}>{t("登录同步", "Sign in to sync")}</button>}
        </div>
      </div></li>
    </ul>
    {editor !== undefined && <ArticleEditor article={editor} initialLanguage={language} onSave={saveArticle} onClose={() => setEditor(undefined)} />}
    {deleting && <Dialog title={t(`删除《${deleting.title}》？`, `Delete ${deleting.title}?`)} onClose={() => { if (!deletePending) setDeleting(undefined); }}>
      <div className="feature-form">
        <p>{t("已有草稿和历史记录保留原文章快照。", "Existing drafts and history keep the original article snapshot.")}</p>
        {deleteError && <p className="form-error" role="alert">{t("删除失败", "Deletion failed")}</p>}
        <div className="feature-actions">
          <button className="outline-button" disabled={deletePending} onClick={() => setDeleting(undefined)}>{t("取消", "Cancel")}</button>
          <button className="primary-button" disabled={deletePending} onClick={() => void deleteArticle()}>{t("删除", "Delete")}</button>
        </div>
      </div>
    </Dialog>}
  </section>;
}
