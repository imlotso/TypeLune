import { useMemo, useState } from 'react';
import { ChartBar } from '@phosphor-icons/react/ChartBar';
import type { Difficulty, Language } from '../data/articles';
import type { PracticeRecord } from '../lib/models';
import { browserStatisticsTimeZone, groupComparableRecords, selectStatisticsRecords, statsDayKey, summarizeStatistics, type StatisticsFilters, type StatisticsGroup, type StatisticsRange } from '../lib/long-term-stats';
import { stableRecordId } from '../lib/records';

export type StatisticsCoverage = 'loading' | 'complete' | 'partial' | 'local';
const difficultyNames: Record<Difficulty, string> = { beginner: '入门', intermediate: '进阶', advanced: '挑战' };
const unitFor = (language: Language) => language === 'zh' ? '字/分' : 'WPM';
const valueLabel = (value: number | null, suffix: string) => value === null ? '—' : `${value} ${suffix}`;
function elapsedLabel(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} 分 ${seconds % 60} 秒` : `${seconds} 秒`;
}
function groupTitle(group: StatisticsGroup) {
  return `${group.articleTitle || '无文章快照'}${group.version ? ` · 版本 ${group.version}` : ''} · ${difficultyNames[group.difficulty]} · ${group.mode === 'article' ? '整篇' : `${group.duration / 60} 分钟`} · ${group.strict ? '严格纠错' : '普通纠错'}${group.offset ? ` · 续练 ${group.offset}` : ''}`;
}

function TrendGroup({ group, timeZone, onOpenRecord, tableName }: { group: StatisticsGroup; timeZone: string; onOpenRecord?: (id: string) => void; tableName: string }) {
  const [page, setPage] = useState(() => Math.max(0, Math.ceil(group.records.length / 30) - 1));
  const [dailyLimit, setDailyLimit] = useState(30);
  const summary = summarizeStatistics(group.records);
  const unit = unitFor(group.language);
  const pages = Math.max(1, Math.ceil(group.records.length / 30));
  const currentPage = Math.min(page, pages - 1);
  const shown = group.records.slice(currentPage * 30, currentPage * 30 + 30);
  const maxSpeed = Math.max(1, summary.bestSpeed ?? 0);
  const daily = new Map<string, PracticeRecord[]>();
  for (const record of group.records) {
    const day = statsDayKey(record.finishedAt, timeZone);
    const entries = daily.get(day);
    if (entries) entries.push(record); else daily.set(day, [record]);
  }
  return <section className="stats-group" role="region" aria-label={`同条件统计：${groupTitle(group)}`}>
    <h2>{groupTitle(group)}</h2>
    <dl className="feature-metrics stats-group-metrics">
      <div><dt>次数</dt><dd>{summary.sessions}</dd></div>
      <div><dt>最高速度</dt><dd>{valueLabel(summary.bestSpeed, unit)}</dd></div>
      <div><dt>平均速度</dt><dd>{valueLabel(summary.averageSpeed, unit)}</dd></div>
      <div><dt>平均准确率</dt><dd>{valueLabel(summary.averageAccuracy, '%')}</dd></div>
    </dl>
    <p className="feature-muted stats-legend">柱：速度 · 点：准确率</p>
    <div className="stats-chart" role="group" aria-label={`单次趋势：${groupTitle(group)}`}>
      {shown.map((record, index) => <button key={stableRecordId(record)} type="button" className="stats-point" disabled={!onOpenRecord}
        aria-label={`查看记录：${statsDayKey(record.finishedAt, timeZone)}，第 ${currentPage * 30 + index + 1} 次，${record.speed} ${unit}，准确率 ${record.accuracy}%`}
        onClick={() => onOpenRecord?.(stableRecordId(record))}>
        <span className="stats-plot"><span className="stats-speed-bar" style={{ height: `${Math.max(0, Math.min(100, record.speed / maxSpeed * 100))}%` }} />
          <span className="stats-accuracy-dot" style={{ bottom: `${Math.max(0, Math.min(100, record.accuracy))}%` }} /></span>
        <small>{statsDayKey(record.finishedAt, timeZone).slice(5)}</small>
      </button>)}
    </div>
    {pages > 1 && <div className="feature-actions stats-pages"><button type="button" className="outline-button feature-action-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button>
      <span>{currentPage + 1} / {pages}</span><button type="button" className="outline-button feature-action-button" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>下一页</button></div>}
    <div className="stats-trend" tabIndex={0} role="region" aria-label={`每日统计列表：${groupTitle(group)}`}>
      <table aria-label={tableName}>
        <thead><tr><th scope="col">日期</th><th scope="col">次数</th><th scope="col">速度</th><th scope="col">准确率</th><th scope="col">有效用时</th></tr></thead>
        <tbody>{[...daily.entries()].reverse().slice(0, dailyLimit).map(([day, entries]) => {
          const dailySummary = summarizeStatistics(entries);
          return <tr key={day}><th scope="row">{day}</th><td>{dailySummary.sessions}</td><td>{valueLabel(dailySummary.averageSpeed, unit)}</td>
            <td>{valueLabel(dailySummary.averageAccuracy, '%')}</td><td>{dailySummary.timedSessions ? elapsedLabel(dailySummary.elapsedMs) : '—'}{dailySummary.missingElapsed > 0 && <small> · {dailySummary.missingElapsed} 条未知</small>}</td></tr>;
        })}</tbody>
      </table>
    </div>
    {daily.size > dailyLimit && <div className="feature-actions"><button type="button" className="outline-button feature-action-button" onClick={() => setDailyLimit((value) => value + 30)}>加载更多日期</button></div>}
  </section>;
}

export function StatsView({ records, coverage = 'local', onOpenRecord, timeZone = browserStatisticsTimeZone() }: { records: PracticeRecord[]; coverage?: StatisticsCoverage; onOpenRecord?: (id: string) => void; timeZone?: string }) {
  const [filters, setFilters] = useState<StatisticsFilters>({ language: 'zh', article: '', mode: '', duration: '', difficulty: '', strict: '', range: '7', from: '', to: '' });
  const [groupLimit, setGroupLimit] = useState(10);
  const change = <K extends keyof StatisticsFilters>(key: K, value: StatisticsFilters[K]) => { setFilters((current) => ({ ...current, [key]: value })); setGroupLimit(10); };
  const invalidDates = filters.range === 'custom' && !!filters.from && !!filters.to && filters.from > filters.to;
  const selected = useMemo(() => invalidDates ? [] : selectStatisticsRecords(records, filters, timeZone), [records, filters, timeZone, invalidDates]);
  const groups = useMemo(() => groupComparableRecords(selected), [selected]);
  const summary = summarizeStatistics(selected);
  const options = new Map<string, string>();
  for (const record of records) if (record.language === filters.language) options.set(record.article ? `id:${record.article.id}` : 'missing', record.article?.title ?? '无文章快照');
  const durations = [...new Set(records.filter((record) => record.language === filters.language && (record.mode ?? 'timed') === 'timed').map((record) => record.duration))].sort((a, b) => a - b);
  return <section className="content-panel stats feature-panel">
    <div className="content-heading"><h1><ChartBar size={25} aria-hidden="true" /> 练习统计</h1></div>
    <div className="feature-toolbar"><div className="segmented feature-segments" role="group" aria-label="统计语言">
      <button aria-pressed={filters.language === 'zh'} onClick={() => { setFilters((current) => ({ ...current, language: 'zh', article: '', duration: '' })); setGroupLimit(10); }}>中文</button>
      <button aria-pressed={filters.language === 'en'} onClick={() => { setFilters((current) => ({ ...current, language: 'en', article: '', duration: '' })); setGroupLimit(10); }}>English</button>
    </div></div>
    <div className="feature-form stats-filters">
      <label>时间范围<select aria-label="统计时间范围" value={filters.range} onChange={(event) => change('range', event.target.value as StatisticsRange)}><option value="7">7 天</option><option value="30">30 天</option><option value="90">90 天</option><option value="365">一年</option><option value="all">全部</option><option value="custom">自定义</option></select></label>
      {filters.range === 'custom' && <><label>开始日期<input type="date" value={filters.from} onChange={(event) => change('from', event.target.value)} /></label><label>结束日期<input type="date" value={filters.to} onChange={(event) => change('to', event.target.value)} /></label></>}
      <label>文章<select aria-label="统计文章" value={filters.article} onChange={(event) => change('article', event.target.value)}><option value="">全部</option>{[...options].map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
      <label>模式<select aria-label="统计模式" value={filters.mode} onChange={(event) => { const mode = event.target.value as StatisticsFilters['mode']; setFilters((current) => ({ ...current, mode, ...(mode === 'article' && { duration: '' }) })); setGroupLimit(10); }}><option value="">全部</option><option value="timed">限时</option><option value="article">整篇</option></select></label>
      <label>限时时长<select aria-label="统计时长" disabled={filters.mode === 'article'} value={filters.duration} onChange={(event) => change('duration', event.target.value)}><option value="">全部</option>{durations.map((duration) => <option key={duration} value={duration}>{duration % 60 === 0 ? `${duration / 60} 分钟` : `${duration} 秒`}</option>)}</select></label>
      <label>难度<select aria-label="统计难度" value={filters.difficulty} onChange={(event) => change('difficulty', event.target.value as StatisticsFilters['difficulty'])}><option value="">全部</option>{Object.entries(difficultyNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>严格纠错<select aria-label="统计严格纠错" value={filters.strict} onChange={(event) => change('strict', event.target.value as StatisticsFilters['strict'])}><option value="">全部</option><option value="yes">开启</option><option value="no">关闭</option></select></label>
    </div>
    {invalidDates && <p className="form-error" role="alert">日期范围无效</p>}
    {coverage !== 'complete' && <p className="feature-muted" role="status">{coverage === 'loading' ? '正在读取历史…' : coverage === 'partial' ? '统计基于已读取的记录' : '仅本机记录'}</p>}
    <dl className="feature-metrics"><div><dt>练习次数</dt><dd>{summary.sessions}</dd></div><div><dt>累计有效用时</dt><dd>{summary.timedSessions ? elapsedLabel(summary.elapsedMs) : '—'}</dd></div></dl>
    {summary.missingElapsed > 0 && <p className="feature-muted">{summary.missingElapsed} 条记录缺少有效用时</p>}
    {!!groups.length && <p className="feature-muted">速度和准确率按同条件每次练习等权平均</p>}
    {!groups.length ? <p className="empty-state">暂无练习</p> : <div className="stats-groups">{groups.slice(0, groupLimit).map((group) => <TrendGroup key={`${JSON.stringify(filters)}:${group.key}`} group={group} timeZone={timeZone} onOpenRecord={onOpenRecord} tableName={groups.length === 1 ? '每日统计' : `每日统计：${groupTitle(group)}`} />)}
      {groupLimit < groups.length && <div className="feature-actions"><button type="button" className="outline-button" onClick={() => setGroupLimit((value) => value + 10)}>加载更多条件</button></div>}</div>}
  </section>;
}
