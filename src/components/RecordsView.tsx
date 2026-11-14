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

const difficultyNames: Record<Difficulty, string> = { beginner: '入门', intermediate: '进阶', advanced: '挑战' };
const languageNames: Record<Language, string> = { zh: '中文', en: 'English' };
const recordTitle = (record: PracticeRecord) => record.article?.title ?? `${languageNames[record.language]} · ${difficultyNames[record.difficulty]}`;
const speedLabel = (record: PracticeRecord) => `${record.speed} ${record.language === 'zh' ? '字/分' : 'WPM'}`;
const dateText = (date: Date) => date.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

function RecordDetail({ record, ownerId, onClose, onReplay, onContinue, recovery }: {
  record: PracticeRecord;
  ownerId: string | null;
  onClose: () => void;
  onReplay: Props['onReplay'];
  onContinue: Props['onContinue'];
  recovery?: ReturnType<NonNullable<Props['recoveryFor']>>;
}) {
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

  return <Dialog title="练习详情" onClose={onClose}>
    <div className="feature-form record-detail">
      <div>
        <h3>{recordTitle(record)}</h3>
        <div className="feature-meta">
          {article?.author && <span>{article.author}</span>}
          <time dateTime={date.toISOString()}>{dateText(date)}</time>
          <span>{record.mode === 'article' ? '整篇' : `限时 ${record.duration / 60} 分钟`}</span>
          {record.strict && <span>严格纠错</span>}
        </div>
      </div>
      {scoreStatus ? <ScoreStatusView status={scoreStatus} /> : remoteStatus.loading ? <p role="status">正在读取成绩状态…</p> : remoteStatus.error ? <div><p className="form-error" role="alert">{remoteStatus.error}</p><button type="button" className="text-button" onClick={remoteStatus.retry}>重试状态</button></div> : <p className="score-status">{personal ? (recovery ? '无法恢复：个人练习不参与排行' : '个人练习，不参与排行。') : record.localOnly ? '本机记录，排行状态未确认。' : '成绩状态暂不可用。'}</p>}
      <dl className="feature-metrics">
        <div><dt>速度</dt><dd>{speedLabel(record)}</dd></div>
        <div><dt>准确率</dt><dd>{record.accuracy}%</dd></div>
        {record.elapsedMs != null && <div><dt>练习用时</dt><dd>{Math.round(record.elapsedMs / 1000)} 秒</dd></div>}
        {roundCount != null && <div><dt>本轮输入</dt><dd>{roundCount} 字符</dd></div>}
        {record.correct != null && <div><dt>本轮正确</dt><dd>{record.correct} 字符</dd></div>}
        {entered != null && articleTotal != null && <div><dt>整篇进度</dt><dd>{entered.toLocaleString()} / {articleTotal.toLocaleString()}</dd></div>}
        {record.errors != null && <div><dt>错误</dt><dd>{record.errors}</dd></div>}
        {record.backspaces != null && <div><dt>退格</dt><dd>{record.backspaces}</dd></div>}
      </dl>
      <ProcessChart trace={record.processTrace} language={record.language} />
      {!!mistakes.length && <details className="feature-details" open>
        <summary>误输记录 · {mistakes.length}</summary>
        <ol className="feature-scroll">
          {mistakes.map((mistake, index) => <li key={index}>
            <span>第 {mistake.position + 1} 字符</span><strong>{readableCharacter(mistake.expected)}</strong><del>{readableCharacter(mistake.actual) || '空'}</del>
          </li>)}
        </ol>
      </details>}
      {recovery && !personal && !remoteStatus.loading && (finalized ? <p className="feature-muted">无法恢复：{scoreStatus?.state === 'ineligible' ? '不符合排行条件' : '成绩已提交或审核结束'}</p> : recovery.available && recovery.recover ? <div className="feature-actions"><button type="button" className="outline-button" onClick={() => { onClose(); recovery.recover?.(); }}>恢复成绩</button></div> : <p className="feature-muted">无法恢复：{recovery.reason}</p>)}
      {article && <details className="feature-details">
        <summary>文章原文</summary>
        <p className="feature-scroll record-source" tabIndex={0}>{article.text}</p>
      </details>}
      {article && <div className="feature-actions">
        <button className="outline-button" onClick={() => { onClose(); onReplay(article); }}>重练</button>
        {canContinue && <button className="primary-button" onClick={() => { onClose(); onContinue(record); }}>继续练习</button>}
      </div>}
    </div>
  </Dialog>;
}

export function RecordsView({ records, ownerId = null, onReplay, onContinue, onDelete, routeRecordId, routeLoading, routePartial, onOpenRecord, onCloseRecord, onRetryRecords, recoveryFor }: Props) {
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
    catch (error) { setDeleteError(error instanceof Error ? error.message : '删除失败，请重试'); }
    finally { setBusy(false); }
  }
  return <section className="content-panel records feature-panel">
    <div className="content-heading"><h1><Clock size={25} aria-hidden="true" /> 我的记录</h1></div>
    <div className="feature-toolbar">
      <div className="segmented feature-segments" role="group" aria-label="记录语言">
        <button aria-pressed={filters.language === ''} onClick={() => setFilter('language', '')}>全部</button>
        <button aria-pressed={filters.language === 'zh'} onClick={() => setFilter('language', 'zh')}>中文</button>
        <button aria-pressed={filters.language === 'en'} onClick={() => setFilter('language', 'en')}>English</button>
      </div>
      {selectedRecords.length > 0 && <button type="button" className="outline-button" onClick={() => { setDeleteError(''); setDeleting(selectedRecords); }}>删除所选（{selectedRecords.length}）</button>}
    </div>
    <details className="record-filters">
      <summary>筛选</summary>
      <div className="feature-form record-filter-grid">
        <label>文章<input type="search" value={filters.query} onChange={(event) => setFilter('query', event.target.value)} /></label>
        <label>开始日期<input type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} /></label>
        <label>结束日期<input type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} /></label>
        <label>模式<select value={filters.mode} onChange={(event) => setFilter('mode', event.target.value as HistoryFilters['mode'])}><option value="">全部</option><option value="timed">限时</option><option value="article">整篇</option></select></label>
        <label>时长（分钟）<input type="number" min="1" max="60" step="1" value={filters.minutes} onChange={(event) => setFilter('minutes', event.target.value)} /></label>
        <label>严格纠错<select value={filters.strict} onChange={(event) => setFilter('strict', event.target.value as HistoryFilters['strict'])}><option value="">全部</option><option value="yes">开启</option><option value="no">关闭</option></select></label>
      </div>
    </details>
    {!filtered.length ? <p className="empty-state">{records.length ? '没有匹配的记录' : '暂无记录'}</p> : <ul className="feature-list">
      {filtered.slice(0, limit).map((record, index) => {
        const date = new Date(record.finishedAt);
        const title = recordTitle(record);
        const id = stableRecordId(record);
        return <li className="feature-row" key={record.recordId ?? `${record.finishedAt}-${index}`}>
          <div className="feature-row-main">
            <div className="record-title-row"><input type="checkbox" aria-label={`选择《${title}》`} checked={chosen.has(id)} disabled={!chosen.has(id) && selectedRecords.length >= 100} onChange={(event) => setChosen((current) => { const next = new Set(current); if (event.target.checked) next.add(id); else next.delete(id); return next; })} /><h2>{title}</h2></div>
            <div className="feature-meta">
              <time dateTime={date.toISOString()}>{dateText(date)}</time>
              {record.article && <span>{languageNames[record.language]} · {difficultyNames[record.difficulty]}</span>}
              {record.localOnly && <span>{record.article?.custom || (record.offset ?? 0) > 0 ? '个人练习' : '本机记录'}</span>}
              {record.scoreStatus && <span>{scoreStatusText(record.scoreStatus)}</span>}
            </div>
          </div>
          <div className="feature-actions">
            <div className="record-speed"><strong>{speedLabel(record)}</strong><span>准确率 {record.accuracy}%</span></div>
            <button className="outline-button feature-action-button" aria-label={`${record.article ? `《${title}》` : title}详情`} onClick={() => onOpenRecord ? onOpenRecord(stableRecordId(record)) : setSelected(record)}>详情</button>
            <button type="button" className="text-button" aria-label={`删除《${title}》`} onClick={() => { setDeleteError(''); setDeleting([record]); }}>删除</button>
          </div>
        </li>;
      })}
    </ul>}
    {limit < filtered.length && <div className="feature-actions"><button type="button" className="outline-button" onClick={() => setLimit((current) => current + 20)}>加载更多</button></div>}
    {deleting && <Dialog title="删除记录" onClose={() => setDeleting(undefined)} dismissible={!busy}>
      <div className="feature-form"><p>删除 {deleting.length} 条记录并撤回关联的公开成绩；统计和个人最佳会重新计算。此操作无法撤销。</p>
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => setDeleting(undefined)}>取消</button><button type="button" className="primary-button" disabled={busy} onClick={() => void confirmDelete()}>删除</button></div>
      </div>
    </Dialog>}
    {routeRecordId && !detail && <div className="feature-form">{routeLoading ? <p role="status">正在读取记录…</p> : routePartial ? <><p className="form-error" role="alert">记录尚未完整读取</p>{onRetryRecords && <button type="button" className="outline-button" onClick={onRetryRecords}>重试</button>}</> : <p role="status">记录未找到</p>}<button type="button" className="outline-button" onClick={onCloseRecord}>返回记录</button></div>}
    {detail && <RecordDetail record={detail} ownerId={ownerId} recovery={recoveryFor?.(detail)} onClose={closeDetail} onReplay={onReplay} onContinue={onContinue} />}
  </section>;
}
