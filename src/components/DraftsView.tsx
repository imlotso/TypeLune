import { useI18n } from '../lib/i18n';
import { useState } from 'react';
import { Archive } from '@phosphor-icons/react/Archive';
import { Trash } from '@phosphor-icons/react/Trash';
import type { SavedPractice } from '../lib/models';
import { splitCharacters } from '../lib/scoring';
import { Dialog } from './Dialog';

type Props = {
  drafts: SavedPractice[];
  onResume: (draft: SavedPractice) => void;
  onDelete: (id: string) => void;
  recovery?: { id: string; title: string; savedAt?: number; recover: () => void }[];
};

export function DraftsView({ drafts, onResume, onDelete, recovery = [] }: Props) {
  const { t, locale } = useI18n();

  const [deleting, setDeleting] = useState<SavedPractice>();
  return <section className="content-panel drafts feature-panel">
    <div className="content-heading"><h1><Archive size={25} aria-hidden="true" /> {t("练习草稿", "Practice drafts")}</h1></div>
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
          <div className="feature-row-main">
            <h2>{draft.article.title}</h2>
            <div className="feature-meta">
              <span>{draft.article.language === 'zh' ? t("中文", "Chinese") : 'English'}</span>
              <time dateTime={savedAt.toISOString()}>{savedAt.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</time>
              <span>{entered.toLocaleString()} / {total.toLocaleString()} {t("字符", "characters")}</span>
            </div>
            <progress className="feature-progress" aria-label={t(`《${draft.article.title}》进度`, `Progress for ${draft.article.title}`)} max={total || 1} value={entered} />
          </div>
          <div className="feature-actions">
            <button className="icon-button" aria-label={t(`删除《${draft.article.title}》`, `Delete ${draft.article.title}`)} onClick={() => setDeleting(draft)}><Trash size={19} aria-hidden="true" /></button>
            <button className="outline-button feature-action-button" aria-label={t(`继续《${draft.article.title}》`, `Resume ${draft.article.title}`)} onClick={() => onResume(draft)}>{t("继续", "Resume")}</button>
          </div>
        </li>;
      })}
    </ul>}
    {deleting && <Dialog title={t(`删除《${deleting.article.title}》草稿？`, `Delete draft for ${deleting.article.title}?`)} onClose={() => setDeleting(undefined)}>
      <div className="feature-form">
        <p className="feature-muted">{t("未完成的进度将被删除。", "Unfinished progress will be deleted.")}</p>
        <div className="feature-actions">
          <button className="outline-button" onClick={() => setDeleting(undefined)}>{t("取消", "Cancel")}</button>
          <button className="primary-button" onClick={() => { onDelete(deleting.id); setDeleting(undefined); }}>{t("删除", "Delete")}</button>
        </div>
      </div>
    </Dialog>}
  </section>;
}
