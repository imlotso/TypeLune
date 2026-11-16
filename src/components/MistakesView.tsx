import { useI18n } from '../lib/i18n';
import { useMemo, useState } from 'react';
import { Notebook } from '@phosphor-icons/react/Notebook';
import { Play } from '@phosphor-icons/react/Play';
import type { Language } from '../data/articles';
import { collectMistakes, createMistakeDrill } from '../lib/analysis';
import type { ArticleSnapshot, MistakeStatus, PracticeRecord } from '../lib/models';
import { readableCharacter } from '../lib/practice-lines';

type Props = { records: PracticeRecord[]; states: Record<string, MistakeStatus>; onStatus: (id: string, status?: MistakeStatus) => void; onPractice: (article: ArticleSnapshot) => void };

export function MistakesView({ records, states, onStatus, onPractice }: Props) {
  const { t, locale } = useI18n();

  const [language, setLanguage] = useState<Language>('zh');
  const [selected, setSelected] = useState(new Set<string>());
  const [status, setStatus] = useState<'active' | 'mastered' | 'ignored' | 'all'>('active');
  const [period, setPeriod] = useState('');
  const [frequency, setFrequency] = useState('');
  const entries = useMemo(() => collectMistakes(records), [records]);
  const shown = entries.filter((entry) => entry.language === language && (status === 'all' || (states[entry.id] ?? 'active') === status) &&
    (!period || entry.lastSeen >= Date.now() - Number(period) * 86_400_000) && (!frequency || entry.count >= Number(frequency)));
  const drill = createMistakeDrill(shown.filter(({ id }) => selected.has(id)), language);
  const allSelected = shown.length > 0 && shown.every((entry) => selected.has(entry.id));
  const truncated = records.some((record) => record.language === language && (record.mistakesTruncated || (record.mistakes?.length ?? 0) >= 500));

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const entry of shown) { if (allSelected) next.delete(entry.id); else next.add(entry.id); }
      return next;
    });
  }

  return <section className="content-panel mistakes feature-panel">
    <div className="content-heading">
      <h1><Notebook size={25} aria-hidden="true" /> {t("错字本", "Mistakes")}</h1>
      <button className="primary-button feature-action-button" disabled={!drill.text.trim()} onClick={() => onPractice(drill)}><Play size={16} aria-hidden="true" /> {t("专项练习", "Targeted practice")}</button>
    </div>
    <div className="feature-toolbar">
      <div className="segmented feature-segments" role="group" aria-label={t("错字语言", "Article language")}>
        <button aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>{t("中文", "Chinese")}</button>
        <button aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
      </div>
      <button className="outline-button feature-action-button" disabled={!shown.length} onClick={toggleAll}>{allSelected ? t("取消全选", "Deselect all") : t("全选", "Select all")}</button>
    </div>
    <div className="feature-filters">
      <label>{t("状态", "Status")}<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="active">{t("待练习", "To practice")}</option><option value="mastered">{t("已掌握", "Mastered")}</option><option value="ignored">{t("已忽略", "Ignored")}</option><option value="all">{t("全部", "All")}</option></select></label>
      <label>{t("时间", "Time")}<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="">{t("全部", "All")}</option><option value="7">{t("近 7 天", "Last 7 days")}</option><option value="30">{t("近 30 天", "Last 30 days")}</option></select></label>
      <label>{t("频次", "Frequency")}<select value={frequency} onChange={(event) => setFrequency(event.target.value)}><option value="">{t("全部", "All")}</option><option value="2">{t("至少 2 次", "At least twice")}</option><option value="5">{t("至少 5 次", "At least 5 times")}</option></select></label>
    </div>
    {truncated && <p className="feature-muted" role="status">{t("错字样本可能不完整", "Mistake samples may be incomplete")}</p>}
    {!shown.length ? <p className="empty-state">{t("暂无错字", "No mistakes")}</p> : <ul className="feature-list">
      {shown.map((entry) => {
        const expected = readableCharacter(entry.expected);
        const date = new Date(entry.lastSeen);
        const current = states[entry.id];
        return <li key={entry.id} className="feature-row">
          <div className="feature-row-main">
            <label className="mistake-option">
              <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggle(entry.id)} />
              <strong>{expected}</strong>
            </label>
            <div className="feature-meta">
              <span>{entry.count} {t("次", "times")}</span>
              <time dateTime={date.toISOString()}>{date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}</time>
              <span>{t("误输 ", "Typed:  ")}{entry.actual.map((value) => readableCharacter(value) || t("空", "empty")).join('、')}</span>
            </div>
            {entry.contexts[0] && <p className="mistake-context">{entry.contexts[0]}</p>}
          </div>
          <div className="feature-actions">
            <button className="outline-button feature-action-button" onClick={() => onStatus(entry.id, current === 'mastered' ? undefined : 'mastered')}>{current === 'mastered' ? t("取消掌握", "Unmark mastered") : t("标记已掌握", "Mark mastered")}</button>
            <button className="text-button" onClick={() => onStatus(entry.id, current === 'ignored' ? undefined : 'ignored')}>{current === 'ignored' ? t("恢复", "Restore") : t("忽略", "Ignore")}</button>
          </div>
        </li>;
      })}
    </ul>}
  </section>;
}
