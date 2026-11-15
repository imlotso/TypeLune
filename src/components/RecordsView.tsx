import { useI18n } from '../lib/i18n';
import { useState } from 'react';
import { Clock } from '@phosphor-icons/react/Clock';
import type { Difficulty, Language } from '../data/articles';
import { recordMistakes } from '../lib/analysis';
import { emptyHistoryFilters, filterPracticeRecords, type HistoryFilters } from '../lib/history-filter';
import type { ArticleSnapshot, PracticeRecord } from '../lib/models';
import { readableCharacter } from '../lib/practice-lines';
import { stableRecordId } from '../lib/records';
import { splitCharacters } from '../lib/scoring';
import { useScoreStatus } from '../hooks/useScoreStatus';
import { ScoreStatusView, scoreStatusText } from './ScoreStatusView';
import { Dialog } from './Dialog';
import { ProcessChart } from './ProcessChart';

type Props = {
  records: PracticeRecord[];
  ownerId?: string | null;
  onReplay: (article: ArticleSnapshot) => void;
  onContinue: (record: PracticeRecord) => void;
  onDelete: (records: PracticeRecord[]) => Promise<void>;
  routeRecordId?: string;
  routeLoading?: boolean;
  routePartial?: boolean;
  onOpenRecord?: (id: string) => void;
  onCloseRecord?: () => void;
  onRetryRecords?: () => void;
  recoveryFor?: (record: PracticeRecord) => { available: boolean; reason?: string; recover?: () => void };
};


function RecordDetail({ record, ownerId, onClose, onReplay, onContinue, recovery }: {
  record: PracticeRecord;
  ownerId: string | null;
  onClose: () => void;
  onReplay: Props['onReplay'];
  onContinue: Props['onContinue'];
  recovery?: ReturnType<NonNullable<Props['recoveryFor']>>;
}) {
  const { t, locale } = useI18n();
const difficultyNames: Record<Difficulty, string> = { beginner: t("入门", "Beginner"), intermediate: t("进阶", "Intermediate"), advanced: t("挑战", "Advanced") };
const languageNames: Record<Language, string> = { zh: t("中文", "Chinese"), en: 'English' };
const recordTitle = (record: PracticeRecord) => record.article?.title ?? `${languageNames[record.language]} · ${difficultyNames[record.difficulty]}`;
const speedLabel = (record: PracticeRecord) => `${record.speed} ${record.language === 'zh' ? t("字/分", "chars/min") : 'WPM'}`;
const dateText = (date: Date) => date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  const article = record.article;
  const remoteStatus = useScoreStatus(record.recordId, ownerId, !record.scoreStatus && record.localOnly === false && !!record.recordId, 0);
  const scoreStatus = record.scoreStatus ?? remoteStatus.status;
  const finalized = scoreStatus && ['pending', 'ranked', 'published', 'rejected', 'removed', 'ineligible'].includes(scoreStatus.state);
  const personal = !scoreStatus && (!!article?.custom || (record.offset ?? 0) > 0);
  const target = splitCharacters(article?.text ?? '');
  const typed = record.typed == null ? undefined : splitCharacters(record.typed);
  const articleTotal = article ? target.length : record.articleTotal;
  const offset = record.offset ?? 0;
  const roundCount = record.total ?? (typed ? Math.max(0, typed.length - offset) : undefined);
  const entered = typed?.length ?? (roundCount == null ? undefined : offset + roundCount);
  const mistakes = recordMistakes(record, target);
  const canContinue = !!article && !!typed && (typed.length < target.length ||
    (record.strict && typed.some((character, index) => character !== target[index])));
  const date = new Date(record.finishedAt);

  return <Dialog title={t("练习详情", "Practice details")} onClose={onClose}>
    <div className="feature-form record-detail">
      <div>
        <h3>{recordTitle(record)}</h3>
        <div className="feature-meta">
          {article?.author && <span>{article.author}</span>}
          <time dateTime={date.toISOString()}>{dateText(date)}</time>
          <span>{record.mode === 'article' ? t("整篇", "Full article") : t(`限时 ${record.duration / 60} 分钟`, `Timed ${record.duration / 60} min`)}</span>
          {record.strict && <span>{t("严格纠错", "Strict correction")}</span>}
        </div>
      </div>
      {scoreStatus ? <ScoreStatusView status={scoreStatus} /> : remoteStatus.loading ? <p role="status">{t("正在读取成绩状态…", "Loading score status…")}</p> : remoteStatus.error ? <div><p className="form-error" role="alert">{remoteStatus.error}</p><button type="button" className="text-button" onClick={remoteStatus.retry}>{t("重试状态", "Retry status")}</button></div> : <p className="score-status">{personal ? (recovery ? t("无法恢复：个人练习不参与排行", "Cannot recover: personal practice is not ranked") : t("个人练习，不参与排行。", "Personal practice is not ranked.")) : record.localOnly ? t("本机记录，排行状态未确认。", "Local record; ranking status unconfirmed.") : t("成绩状态暂不可用。", "Score status unavailable.")}</p>}
      <dl className="feature-metrics">
        <div><dt>{t("速度", "Speed")}</dt><dd>{speedLabel(record)}</dd></div>
        <div><dt>{t("准确率", "Accuracy")}</dt><dd>{record.accuracy}%</dd></div>
        {record.elapsedMs != null && <div><dt>{t("练习用时", "Active time")}</dt><dd>{Math.round(record.elapsedMs / 1000)} {t("秒", "seconds")}</dd></div>}
        {roundCount != null && <div><dt>{t("本轮输入", "Typed this round")}</dt><dd>{roundCount} {t("字符", "characters")}</dd></div>}
        {record.correct != null && <div><dt>{t("本轮正确", "Correct this round")}</dt><dd>{record.correct} {t("字符", "characters")}</dd></div>}
        {entered != null && articleTotal != null && <div><dt>{t("整篇进度", "Article progress")}</dt><dd>{entered.toLocaleString()} / {articleTotal.toLocaleString()}</dd></div>}
        {record.errors != null && <div><dt>{t("错误", "Errors")}</dt><dd>{record.errors}</dd></div>}
        {record.backspaces != null && <div><dt>{t("退格", "Backspaces")}</dt><dd>{record.backspaces}</dd></div>}
      </dl>
      <ProcessChart trace={record.processTrace} language={record.language} />
      {!!mistakes.length && <details className="feature-details" open>
        <summary>{t("误输记录 · ", "Mistakes ·  ")}{mistakes.length}</summary>
        <ol className="feature-scroll">
          {mistakes.map((mistake, index) => <li key={index}>
            <span>{t("第 ", "# ")}{mistake.position + 1} {t("字符", "characters")}</span><strong>{readableCharacter(mistake.expected)}</strong><del>{readableCharacter(mistake.actual) || t("空", "empty")}</del>
          </li>)}
        </ol>
      </details>}
      {recovery && !personal && !remoteStatus.loading && (finalized ? <p className="feature-muted">{t("无法恢复：", "Cannot recover: ")}{scoreStatus?.state === 'ineligible' ? t("不符合排行条件", "Not eligible for ranking") : t("成绩已提交或审核结束", "Score already submitted or reviewed")}</p> : recovery.available && recovery.recover ? <div className="feature-actions"><button type="button" className="outline-button" onClick={() => { onClose(); recovery.recover?.(); }}>{t("恢复成绩", "Recover score")}</button></div> : <p className="feature-muted">{t("无法恢复：", "Cannot recover: ")}{recovery.reason}</p>)}
      {article && <details className="feature-details">
        <summary>{t("文章原文", "Original article")}</summary>
        <p className="feature-scroll record-source" tabIndex={0}>{article.text}</p>
      </details>}
      {article && <div className="feature-actions">
        <button className="outline-button" onClick={() => { onClose(); onReplay(article); }}>{t("重练", "Practice again")}</button>
        {canContinue && <button className="primary-button" onClick={() => { onClose(); onContinue(record); }}>{t("继续练习", "Resume practice")}</button>}
      </div>}
    </div>
  </Dialog>;
}

export function RecordsView({ records, ownerId = null, onReplay, onContinue, onDelete, routeRecordId, routeLoading, routePartial, onOpenRecord, onCloseRecord, onRetryRecords, recoveryFor }: Props) {
  const { t, locale } = useI18n();
const difficultyNames: Record<Difficulty, string> = { beginner: t("入门", "Beginner"), intermediate: t("进阶", "Intermediate"), advanced: t("挑战", "Advanced") };
const languageNames: Record<Language, string> = { zh: t("中文", "Chinese"), en: 'English' };
const recordTitle = (record: PracticeRecord) => record.article?.title ?? `${languageNames[record.language]} · ${difficultyNames[record.difficulty]}`;
const speedLabel = (record: PracticeRecord) => `${record.speed} ${record.language === 'zh' ? t("字/分", "chars/min") : 'WPM'}`;
const dateText = (date: Date) => date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  const [filters, setFilters] = useState<HistoryFilters>(emptyHistoryFilters);
  const [limit, setLimit] = useState(20);
  const [selected, setSelected] = useState<PracticeRecord>();
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState<PracticeRecord[]>();
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState(false);
  const detail = routeRecordId ? records.find((record) => stableRecordId(record) === routeRecordId) : selected;
  const closeDetail = () => { if (routeRecordId && onCloseRecord) onCloseRecord(); else setSelected(undefined); };
  const filtered = filterPracticeRecords(records, filters);
  const setFilter = <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value })); setLimit(20);
  };

  const selectedRecords = records.filter((record) => chosen.has(stableRecordId(record)));
  async function confirmDelete() {
    if (!deleting?.length || busy) return;
    setBusy(true); setDeleteError('');
    try { await onDelete(deleting); setChosen(new Set()); setDeleting(undefined); }
    catch (error) { setDeleteError(error instanceof Error ? error.message : t("删除失败，请重试", "Deletion failed. Please retry")); }
    finally { setBusy(false); }
  }
  return <section className="content-panel records feature-panel">
    <div className="content-heading"><h1><Clock size={25} aria-hidden="true" /> {t("我的记录", "My history")}</h1></div>
    <div className="feature-toolbar">
      <div className="segmented feature-segments" role="group" aria-label={t("记录语言", "Article language")}>
        <button aria-pressed={filters.language === ''} onClick={() => setFilter('language', '')}>{t("全部", "All")}</button>
        <button aria-pressed={filters.language === 'zh'} onClick={() => setFilter('language', 'zh')}>{t("中文", "Chinese")}</button>
        <button aria-pressed={filters.language === 'en'} onClick={() => setFilter('language', 'en')}>English</button>
      </div>
      {selectedRecords.length > 0 && <button type="button" className="outline-button" onClick={() => { setDeleteError(''); setDeleting(selectedRecords); }}>{t("删除所选（", "Delete selected (")}{selectedRecords.length}）</button>}
    </div>
    <details className="record-filters">
      <summary>{t("筛选", "Filters")}</summary>
      <div className="feature-form record-filter-grid">
        <label>{t("文章", "Article")}<input type="search" value={filters.query} onChange={(event) => setFilter('query', event.target.value)} /></label>
        <label>{t("开始日期", "Start date")}<input type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} /></label>
        <label>{t("结束日期", "End date")}<input type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} /></label>
        <label>{t("模式", "Mode")}<select value={filters.mode} onChange={(event) => setFilter('mode', event.target.value as HistoryFilters['mode'])}><option value="">{t("全部", "All")}</option><option value="timed">{t("限时", "Timed")}</option><option value="article">{t("整篇", "Full article")}</option></select></label>
        <label>{t("时长（分钟）", "Duration (minutes)")}<input type="number" min="1" max="60" step="1" value={filters.minutes} onChange={(event) => setFilter('minutes', event.target.value)} /></label>
        <label>{t("严格纠错", "Strict correction")}<select value={filters.strict} onChange={(event) => setFilter('strict', event.target.value as HistoryFilters['strict'])}><option value="">{t("全部", "All")}</option><option value="yes">{t("开启", "On")}</option><option value="no">{t("关闭", "Off")}</option></select></label>
      </div>
    </details>
    {!filtered.length ? <p className="empty-state">{records.length ? t("没有匹配的记录", "No matching records") : t("暂无记录", "No records")}</p> : <ul className="feature-list">
      {filtered.slice(0, limit).map((record, index) => {
        const date = new Date(record.finishedAt);
        const title = recordTitle(record);
        const id = stableRecordId(record);
        return <li className="feature-row" key={record.recordId ?? `${record.finishedAt}-${index}`}>
          <div className="feature-row-main">
            <div className="record-title-row"><input type="checkbox" aria-label={t(`选择《${title}》`, `Select ${title}`)} checked={chosen.has(id)} disabled={!chosen.has(id) && selectedRecords.length >= 100} onChange={(event) => setChosen((current) => { const next = new Set(current); if (event.target.checked) next.add(id); else next.delete(id); return next; })} /><h2>{title}</h2></div>
            <div className="feature-meta">
              <time dateTime={date.toISOString()}>{dateText(date)}</time>
              {record.article && <span>{languageNames[record.language]} · {difficultyNames[record.difficulty]}</span>}
              {record.localOnly && <span>{record.article?.custom || (record.offset ?? 0) > 0 ? t("个人练习", "Personal practice") : t("本机记录", "Local record")}</span>}
              {record.legacyIdConflict && <span>{t("记录标识冲突", "Record ID conflict")}</span>}
              {record.scoreStatus && <span>{scoreStatusText(record.scoreStatus, locale)}</span>}
            </div>
          </div>
          <div className="feature-actions">
            <div className="record-speed"><strong>{speedLabel(record)}</strong><span>{t("准确率 ", "Accuracy ")}{record.accuracy}%</span></div>
            <button className="outline-button feature-action-button" aria-label={t(`${record.article ? `《${title}》` : title}详情`, `Details for ${title}`)} onClick={() => onOpenRecord ? onOpenRecord(stableRecordId(record)) : setSelected(record)}>{t("详情", "Details")}</button>
            <button type="button" className="text-button" aria-label={t(`删除《${title}》`, `Delete ${title}`)} onClick={() => { setDeleteError(''); setDeleting([record]); }}>{t("删除", "Delete")}</button>
          </div>
        </li>;
      })}
    </ul>}
    {limit < filtered.length && <div className="feature-actions"><button type="button" className="outline-button" onClick={() => setLimit((current) => current + 20)}>{t("加载更多", "Load more")}</button></div>}
    {deleting && <Dialog title={t("删除记录", "Delete records")} onClose={() => setDeleting(undefined)} dismissible={!busy}>
      <div className="feature-form"><p>{t("删除 ", "Delete ")}{deleting.length} {t("条记录并撤回关联的公开成绩；统计和个人最佳会重新计算。此操作无法撤销。", "records and withdraw their public scores. Statistics and personal bests will be recalculated. This cannot be undone.")}</p>
        {deleting.some((record) => record.legacyIdConflict) && <p>{t("标识冲突的本机旧副本会单独删除，其他记录保留。", "Only conflicting legacy local copies will be deleted. Other records are kept.")}</p>}
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => setDeleting(undefined)}>{t("取消", "Cancel")}</button><button type="button" className="primary-button" disabled={busy} onClick={() => void confirmDelete()}>{t("删除", "Delete")}</button></div>
      </div>
    </Dialog>}
    {routeRecordId && !detail && <div className="feature-form">{routeLoading ? <p role="status">{t("正在读取记录…", "Loading records…")}</p> : routePartial ? <><p className="form-error" role="alert">{t("记录尚未完整读取", "Records are not fully loaded")}</p>{onRetryRecords && <button type="button" className="outline-button" onClick={onRetryRecords}>{t("重试", "Retry")}</button>}</> : <p role="status">{t("记录未找到", "Record not found")}</p>}<button type="button" className="outline-button" onClick={onCloseRecord}>{t("返回记录", "Back to history")}</button></div>}
    {detail && <RecordDetail record={detail} ownerId={ownerId} recovery={recoveryFor?.(detail)} onClose={closeDetail} onReplay={onReplay} onContinue={onContinue} />}
  </section>;
}
