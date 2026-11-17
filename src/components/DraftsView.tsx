import { useI18n } from '../lib/i18n';
import { useState } from 'react';
import { Archive } from '@phosphor-icons/react/Archive';
import { Trash } from '@phosphor-icons/react/Trash';
import type { SavedPractice } from '../lib/models';
import { splitCharacters } from '../lib/scoring';
import { Dialog } from './Dialog';
import { SystemMessage } from './SystemMessage';

type Props = {
  drafts: SavedPractice[];
  onResume: (draft: SavedPractice) => void;
  onDelete: (drafts: SavedPractice[]) => Promise<void>;
  recovery?: { id: string; title: string; savedAt?: number; recover: () => void }[];
};

export function DraftsView({ drafts, onResume, onDelete, recovery = [] }: Props) {
  const { t, locale } = useI18n();

  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState<SavedPractice[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = drafts.filter(draft => chosen.has(draft.id));
  const allSelected = drafts.length > 0 && selected.length === drafts.length;
  function requestDelete(items: SavedPractice[]) { setError(''); setDeleting(items); }
  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true); setError('');
    try { await onDelete(deleting); setChosen(current => new Set([...current].filter(id => !deleting.some(draft => draft.id === id)))); setDeleting(undefined); }
    catch (problem) { setError(problem instanceof Error ? problem.message : t('草稿删除失败，请重试', 'Could not delete drafts. Try again.')); }
    finally { setBusy(false); }
  }
  return <section className="content-panel drafts feature-panel">
    <div className="content-heading"><h1><Archive size={25} aria-hidden="true" /> {t("练习草稿", "Practice drafts")}</h1>
      {!!drafts.length && <button type="button" className="outline-button" onClick={() => { setSelecting(!selecting); setChosen(new Set()); }}>{selecting ? t('取消选择', 'Cancel selection') : t('批量选择', 'Select drafts')}</button>}
    </div>
    {selecting && !!drafts.length && <div className="draft-selection-bar">
      <label className="settings-check"><input type="checkbox" aria-label={t('全选草稿', 'Select all drafts')} checked={allSelected} ref={element => { if (element) element.indeterminate = selected.length > 0 && !allSelected; }} onChange={event => setChosen(event.target.checked ? new Set(drafts.map(draft => draft.id)) : new Set())} />{t('全选', 'Select all')}</label>
      <span role="status">{t(`已选 ${selected.length} 项`, `${selected.length} selected`)}</span>
      <button type="button" className="outline-button" disabled={!selected.length} onClick={() => requestDelete(selected)}>{t(`删除所选（${selected.length}）`, `Delete selected (${selected.length})`)}</button>
    </div>}
    {!!recovery.length && <ul className="feature-list" aria-label={t("待恢复成绩", "Scores to recover")}>{recovery.map((entry) => <li className="feature-row" key={entry.id}>
      <div className="feature-row-main">
        <h2>{entry.title}</h2>
        {entry.savedAt != null && <div className="feature-meta"><time dateTime={new Date(entry.savedAt).toISOString()}>{new Date(entry.savedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</time></div>}
      </div>
      <button className="outline-button feature-action-button" aria-label={t(`恢复《${entry.title}》成绩`, `Recover score for ${entry.title}`)} onClick={entry.recover}>{t("恢复成绩", "Recover score")}</button>
    </li>)}</ul>}
    {!drafts.length && !recovery.length ? <p className="empty-state">{t("暂无草稿", "No drafts")}</p> : !!drafts.length && <ul className="feature-list">
      {[...drafts].sort((a, b) => b.savedAt - a.savedAt).map((draft) => {
        const total = splitCharacters(draft.article.text).length;
        const entered = splitCharacters(draft.typed).length;
        const savedAt = new Date(draft.savedAt);
        return <li key={draft.id} className="feature-row">
          {selecting && <input className="draft-select" type="checkbox" aria-label={t(`选择《${draft.article.title}》`, `Select ${draft.article.title}`)} checked={chosen.has(draft.id)} onChange={event => { const checked = event.target.checked; setChosen(current => { const next = new Set(current); if (checked) next.add(draft.id); else next.delete(draft.id); return next; }); }} />}
          <div className="feature-row-main">
            <h2>{draft.article.title}</h2>
            <div className="feature-meta">
              <span>{draft.article.language === 'zh' ? t("中文", "Chinese") : 'English'}</span>
              <time dateTime={savedAt.toISOString()}>{savedAt.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</time>
              <span>{entered.toLocaleString()} / {total.toLocaleString()} {t("字符", "characters")}</span>
            </div>
            <progress className="feature-progress" aria-label={t(`《${draft.article.title}》进度`, `Progress for ${draft.article.title}`)} max={total || 1} value={entered} />
          </div>
          {!selecting && <div className="feature-actions">
            <button className="icon-button" aria-label={t(`删除《${draft.article.title}》`, `Delete ${draft.article.title}`)} onClick={() => requestDelete([draft])}><Trash size={19} aria-hidden="true" /></button>
            <button className="outline-button feature-action-button" aria-label={t(`继续《${draft.article.title}》`, `Resume ${draft.article.title}`)} onClick={() => onResume(draft)}>{t("继续", "Resume")}</button>
          </div>}
        </li>;
      })}
    </ul>}
    {deleting && <Dialog title={deleting.length === 1 ? t(`删除《${deleting[0].article.title}》草稿？`, `Delete draft for ${deleting[0].article.title}?`) : t(`删除 ${deleting.length} 份草稿？`, `Delete ${deleting.length} drafts?`)} dismissible={!busy} onClose={() => { if (!busy) setDeleting(undefined); }}>
      <div className="feature-form">
        <p className="feature-muted">{t("未完成的进度将被删除。", "Unfinished progress will be deleted.")}</p>
        {error && <p className="form-error" role="alert"><SystemMessage text={error} /></p>}
        <div className="feature-actions">
          <button className="outline-button" disabled={busy} onClick={() => setDeleting(undefined)}>{t("取消", "Cancel")}</button>
          <button className="primary-button" disabled={busy} onClick={() => void confirmDelete()}>{busy ? t('删除中…', 'Deleting…') : t("删除", "Delete")}</button>
        </div>
      </div>
    </Dialog>}
  </section>;
}
