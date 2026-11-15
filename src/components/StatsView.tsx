import { useI18n, type UiLocale } from '../lib/i18n';
import { useMemo, useState } from 'react';
import { ChartBar } from '@phosphor-icons/react/ChartBar';
import type { Difficulty, Language } from '../data/articles';
import type { PracticeRecord } from '../lib/models';
import { browserStatisticsTimeZone, groupComparableRecords, selectStatisticsRecords, statsDayKey, summarizeStatistics, type StatisticsFilters, type StatisticsGroup, type StatisticsRange } from '../lib/long-term-stats';
import { stableRecordId } from '../lib/records';
import { ActivityCalendar } from './ActivityCalendar';

export type StatisticsCoverage = 'loading' | 'complete' | 'partial' | 'local';
const difficultyNames: Record<Difficulty, string> = { beginner: '入门', intermediate: '进阶', advanced: '挑战' };
const unitFor = (language: Language, locale: UiLocale) => language === 'zh' ? (locale === 'en' ? 'chars/min' : '字/分') : 'WPM';
const difficultyEnglish: Record<Difficulty, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const valueLabel = (value: number | null, suffix: string) => value === null ? '—' : `${value} ${suffix}`;
function elapsedLabel(ms: number, locale: UiLocale) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return locale === 'en' ? (minutes ? `${minutes} min ${seconds % 60} sec` : `${seconds} sec`) : minutes ? `${minutes} 分 ${seconds % 60} 秒` : `${seconds} 秒`;
}
function groupTitle(group: StatisticsGroup, locale: UiLocale) {
  if (locale === 'en') return `${group.articleTitle || 'No article snapshot'}${group.version ? ` · Version ${group.version}` : ''} · ${difficultyEnglish[group.difficulty]} · ${group.mode === 'article' ? 'Full article' : `${group.duration / 60} min`} · ${group.strict ? 'Strict correction' : 'Normal correction'}${group.offset ? ` · Continued at ${group.offset}` : ''}`;
  return `${group.articleTitle || '无文章快照'}${group.version ? ` · 版本 ${group.version}` : ''} · ${difficultyNames[group.difficulty]} · ${group.mode === 'article' ? '整篇' : `${group.duration / 60} 分钟`} · ${group.strict ? '严格纠错' : '普通纠错'}${group.offset ? ` · 续练 ${group.offset}` : ''}`;
}

function TrendGroup({ group, timeZone, onOpenRecord, tableName }: { group: StatisticsGroup; timeZone: string; onOpenRecord?: (id: string) => void; tableName: string }) {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(() => Math.max(0, Math.ceil(group.records.length / 30) - 1));
  const [dailyLimit, setDailyLimit] = useState(30);
  const summary = summarizeStatistics(group.records);
  const unit = unitFor(group.language, locale);
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
  return <section className="stats-group" role="region" aria-label={`${t('同条件统计：', 'Matching sessions: ')}${groupTitle(group, locale)}`}>
    <h2>{groupTitle(group, locale)}</h2>
    <dl className="feature-metrics stats-group-metrics">
      <div><dt>{t("次数", "Sessions")}</dt><dd>{summary.sessions}</dd></div>
      <div><dt>{t("最高速度", "Best speed")}</dt><dd>{valueLabel(summary.bestSpeed, unit)}</dd></div>
      <div><dt>{t("平均速度", "Average speed")}</dt><dd>{valueLabel(summary.averageSpeed, unit)}</dd></div>
      <div><dt>{t("平均准确率", "Average accuracy")}</dt><dd>{valueLabel(summary.averageAccuracy, '%')}</dd></div>
    </dl>
    <p className="feature-muted stats-legend">{t("柱：速度 · 点：准确率", "Bars: speed · Dots: accuracy")}</p>
    <div className="stats-chart" role="group" aria-label={`${t('单次趋势：', 'Session trends: ')}${groupTitle(group, locale)}`}>
      {shown.map((record, index) => <button key={stableRecordId(record)} type="button" className="stats-point" disabled={!onOpenRecord}
        aria-label={locale === 'en' ? `View record: ${statsDayKey(record.finishedAt, timeZone)}, session ${currentPage * 30 + index + 1}, ${record.speed} ${unit}, accuracy ${record.accuracy}%` : `查看记录：${statsDayKey(record.finishedAt, timeZone)}，第 ${currentPage * 30 + index + 1} 次，${record.speed} ${unit}，准确率 ${record.accuracy}%`}
        onClick={() => onOpenRecord?.(stableRecordId(record))}>
        <span className="stats-plot"><span className="stats-speed-bar" style={{ height: `${Math.max(0, Math.min(100, record.speed / maxSpeed * 100))}%` }} />
          <span className="stats-accuracy-dot" style={{ bottom: `${Math.max(0, Math.min(100, record.accuracy))}%` }} /></span>
        <small>{statsDayKey(record.finishedAt, timeZone).slice(5)}</small>
      </button>)}
    </div>
    {pages > 1 && <div className="feature-actions stats-pages"><button type="button" className="outline-button feature-action-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t("上一页", "Previous")}</button>
      <span>{currentPage + 1} / {pages}</span><button type="button" className="outline-button feature-action-button" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>{t("下一页", "Next")}</button></div>}
    <div className="stats-trend" tabIndex={0} role="region" aria-label={`${t('每日统计列表：', 'Daily statistics list: ')}${groupTitle(group, locale)}`}>
      <table aria-label={tableName}>
        <thead><tr><th scope="col">{t("日期", "Date")}</th><th scope="col">{t("次数", "Sessions")}</th><th scope="col">{t("速度", "Speed")}</th><th scope="col">{t("准确率", "Accuracy")}</th><th scope="col">{t("有效用时", "Active time")}</th></tr></thead>
        <tbody>{[...daily.entries()].reverse().slice(0, dailyLimit).map(([day, entries]) => {
          const dailySummary = summarizeStatistics(entries);
          return <tr key={day}><th scope="row">{day}</th><td>{dailySummary.sessions}</td><td>{valueLabel(dailySummary.averageSpeed, unit)}</td>
            <td>{valueLabel(dailySummary.averageAccuracy, '%')}</td><td>{dailySummary.timedSessions ? elapsedLabel(dailySummary.elapsedMs, locale) : '—'}{dailySummary.missingElapsed > 0 && <small> · {dailySummary.missingElapsed}  {t("条未知", "unknown")}</small>}</td></tr>;
        })}</tbody>
      </table>
    </div>
    {daily.size > dailyLimit && <div className="feature-actions"><button type="button" className="outline-button feature-action-button" onClick={() => setDailyLimit((value) => value + 30)}>{t("加载更多日期", "Load more dates")}</button></div>}
  </section>;
}

export function StatsView({ records, coverage = 'local', onOpenRecord, timeZone = browserStatisticsTimeZone(), goalMinutes = 0, onSaveCalendar, timeZoneProvisional = false }: { records: PracticeRecord[]; coverage?: StatisticsCoverage; onOpenRecord?: (id: string) => void; timeZone?: string; goalMinutes?: number; timeZoneProvisional?: boolean; onSaveCalendar?: (settings: { statisticsTimezone: string; dailyGoalMinutes: number }) => Promise<void> }) {
  const { t, locale } = useI18n();
  const [filters, setFilters] = useState<StatisticsFilters>({ language: 'zh', article: '', mode: '', duration: '', difficulty: '', strict: '', range: '7', from: '', to: '' });
  const [groupLimit, setGroupLimit] = useState(10);
  const change = <K extends keyof StatisticsFilters>(key: K, value: StatisticsFilters[K]) => { setFilters((current) => ({ ...current, [key]: value })); setGroupLimit(10); };
  const invalidDates = filters.range === 'custom' && !!filters.from && !!filters.to && filters.from > filters.to;
  const selected = useMemo(() => invalidDates ? [] : selectStatisticsRecords(records, filters, timeZone), [records, filters, timeZone, invalidDates]);
  const groups = useMemo(() => groupComparableRecords(selected), [selected]);
  const summary = summarizeStatistics(selected);
  const options = new Map<string, string>();
  for (const record of records) if (record.language === filters.language) options.set(record.article ? `id:${record.article.id}` : 'missing', record.article?.title ?? t("无文章快照", "No article snapshot"));
  const durations = [...new Set(records.filter((record) => record.language === filters.language && (record.mode ?? 'timed') === 'timed').map((record) => record.duration))].sort((a, b) => a - b);
  return <section className="content-panel stats feature-panel">
    <div className="content-heading"><h1><ChartBar size={25} aria-hidden="true" />  {t("练习统计", "Practice statistics")}</h1></div>
    <div className="feature-toolbar"><div className="segmented feature-segments" role="group" aria-label={t("统计语言", "Statistics language")}>
      <button aria-pressed={filters.language === 'zh'} onClick={() => { setFilters((current) => ({ ...current, language: 'zh', article: '', duration: '' })); setGroupLimit(10); }}>{t("中文", "Chinese")}</button>
      <button aria-pressed={filters.language === 'en'} onClick={() => { setFilters((current) => ({ ...current, language: 'en', article: '', duration: '' })); setGroupLimit(10); }}>English</button>
    </div></div>
    <div className="feature-form stats-filters">
      <label>{t("时间范围", "Date range")}<select aria-label={t("统计时间范围", "Statistics date range")} value={filters.range} onChange={(event) => change('range', event.target.value as StatisticsRange)}><option value="7">{t("7 天", "7 days")}</option><option value="30">{t("30 天", "30 days")}</option><option value="90">{t("90 天", "90 days")}</option><option value="365">{t("一年", "1 year")}</option><option value="all">{t("全部", "All")}</option><option value="custom">{t("自定义", "Custom")}</option></select></label>
      {filters.range === 'custom' && <><label>{t("开始日期", "Start date")}<input type="date" value={filters.from} onChange={(event) => change('from', event.target.value)} /></label><label>{t("结束日期", "End date")}<input type="date" value={filters.to} onChange={(event) => change('to', event.target.value)} /></label></>}
      <label>{t("文章", "Article")}<select aria-label={t("统计文章", "Statistics article")} value={filters.article} onChange={(event) => change('article', event.target.value)}><option value="">{t("全部", "All")}</option>{[...options].map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
      <label>{t("模式", "Mode")}<select aria-label={t("统计模式", "Statistics mode")} value={filters.mode} onChange={(event) => { const mode = event.target.value as StatisticsFilters['mode']; setFilters((current) => ({ ...current, mode, ...(mode === 'article' && { duration: '' }) })); setGroupLimit(10); }}><option value="">{t("全部", "All")}</option><option value="timed">{t("限时", "Timed")}</option><option value="article">{t("整篇", "Full article")}</option></select></label>
      <label>{t("限时时长", "Time limit")}<select aria-label={t("统计时长", "Statistics duration")} disabled={filters.mode === 'article'} value={filters.duration} onChange={(event) => change('duration', event.target.value)}><option value="">{t("全部", "All")}</option>{durations.map((duration) => <option key={duration} value={duration}>{duration % 60 === 0 ? `${duration / 60} ${t('分钟', 'min')}` : `${duration} ${t('秒', 'sec')}`}</option>)}</select></label>
      <label>{t("难度", "Difficulty")}<select aria-label={t("统计难度", "Statistics difficulty")} value={filters.difficulty} onChange={(event) => change('difficulty', event.target.value as StatisticsFilters['difficulty'])}><option value="">{t("全部", "All")}</option>{Object.entries(difficultyNames).map(([value, label]) => <option key={value} value={value}>{locale === 'en' ? difficultyEnglish[value as Difficulty] : label}</option>)}</select></label>
      <label>{t("严格纠错", "Strict correction")}<select aria-label={t("统计严格纠错", "Statistics strict correction")} value={filters.strict} onChange={(event) => change('strict', event.target.value as StatisticsFilters['strict'])}><option value="">{t("全部", "All")}</option><option value="yes">{t("开启", "On")}</option><option value="no">{t("关闭", "Off")}</option></select></label>
    </div>
    {invalidDates && <p className="form-error" role="alert">{t("日期范围无效", "Invalid date range")}</p>}
    {coverage !== 'complete' && <p className="feature-muted" role="status">{coverage === 'loading' ? t("正在读取历史…", "Loading history…") : coverage === 'partial' ? t("统计基于已读取的记录", "Statistics use loaded records") : t("仅本机记录", "Local records only")}</p>}
    <dl className="feature-metrics"><div><dt>{t("练习次数", "Practice sessions")}</dt><dd>{summary.sessions}</dd></div><div><dt>{t("累计有效用时", "Total active time")}</dt><dd>{summary.timedSessions ? elapsedLabel(summary.elapsedMs, locale) : '—'}</dd></div></dl>
    {summary.missingElapsed > 0 && <p className="feature-muted">{summary.missingElapsed}  {t("条记录缺少有效用时", "records have no active duration")}</p>}
    <ActivityCalendar records={records} timeZone={timeZone} goalMinutes={goalMinutes} coverage={coverage} onOpenRecord={onOpenRecord} onSave={onSaveCalendar} provisional={timeZoneProvisional} />
    {!!groups.length && <p className="feature-muted">{t("速度和准确率按同条件每次练习等权平均", "Speed and accuracy are equally weighted across matching sessions")}</p>}
    {!groups.length ? <p className="empty-state">{t("暂无练习", "No practice yet")}</p> : <div className="stats-groups">{groups.slice(0, groupLimit).map((group) => <TrendGroup key={`${JSON.stringify(filters)}:${group.key}`} group={group} timeZone={timeZone} onOpenRecord={onOpenRecord} tableName={groups.length === 1 ? t("每日统计", "Daily statistics") : `${t('每日统计：', 'Daily statistics: ')}${groupTitle(group, locale)}`} />)}
      {groupLimit < groups.length && <div className="feature-actions"><button type="button" className="outline-button" onClick={() => setGroupLimit((value) => value + 10)}>{t("加载更多条件", "Load more conditions")}</button></div>}</div>}
  </section>;
}
