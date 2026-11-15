import { useI18n, type UiLocale } from '../lib/i18n';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { activityByDay, activityStreaks, calendarMonthDays, shiftCalendarMonth } from '../lib/activity-calendar';
import { isStatisticsTimeZone, statsDayKey } from '../lib/long-term-stats';
import type { PracticeRecord } from '../lib/models';
import { stableRecordId } from '../lib/records';
import type { StatisticsCoverage } from './StatsView';

type CalendarSettings = { statisticsTimezone: string; dailyGoalMinutes: number };
function elapsedLabel(ms: number, locale: UiLocale) {
  const seconds = Math.floor(ms / 1000); const minutes = Math.floor(seconds / 60);
  return locale === 'en' ? (minutes ? `${minutes} min ${seconds % 60} sec` : `${seconds} sec`) : minutes ? `${minutes} 分 ${seconds % 60} 秒` : `${seconds} 秒`;
}
const zones = () => {
  try { return (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? []; }
  catch { return []; }
};
export function ActivityCalendar({ records, timeZone, goalMinutes, coverage, onOpenRecord, onSave, provisional = false, now }: {
  records: PracticeRecord[]; timeZone: string; goalMinutes: number; coverage: StatisticsCoverage; onOpenRecord?: (id: string) => void;
  onSave?: (settings: CalendarSettings) => Promise<void>; provisional?: boolean; now?: number;
}) {
  const { t, locale } = useI18n();
  const [clock, setClock] = useState(Date.now);
  const effectiveNow = now ?? clock;
  const today = statsDayKey(effectiveNow, timeZone);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [zoneDraft, setZoneDraft] = useState(timeZone);
  const [goalDraft, setGoalDraft] = useState(String(goalMinutes));
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const baseline = useRef({ timeZone, goalMinutes });
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const days = useMemo(() => activityByDay(records, timeZone, effectiveNow), [records, timeZone, effectiveNow]);
  const streaks = useMemo(() => activityStreaks(days, today), [days, today]);
  const selectedDay = days.get(selected);
  const monthDays = calendarMonthDays(month);
  const known = selectedDay?.timedSessions ? elapsedLabel(selectedDay.elapsedMs, locale) : selectedDay?.sessions ? t("用时未知", "Unknown duration") : t("0 秒", "0 sec");
  const longestLabel = coverage === 'complete' ? t("最长连续", "Longest streak") : coverage === 'local' ? t("本机最长", "Local longest streak") : t("已读取范围最长", "Longest loaded streak");
  const currentLabel = coverage === 'complete' ? t("当前连续", "Current streak") : coverage === 'local' ? t("本机当前连续", "Local current streak") : t("已读取范围当前连续", "Current loaded streak");
  useEffect(() => {
    if (now !== undefined) return;
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [now]);
  const previousToday = useRef(today);
  useEffect(() => {
    const before = previousToday.current; previousToday.current = today;
    setMonth((current) => current === before.slice(0, 7) ? today.slice(0, 7) : current);
    setSelected((current) => current === before ? today : current);
  }, [today]);
  useEffect(() => { setMonth(today.slice(0, 7)); setSelected(today); }, [timeZone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dirtyRef.current) { setZoneDraft(timeZone); setGoalDraft(String(goalMinutes)); baseline.current = { timeZone, goalMinutes }; setChangedElsewhere(false); }
    else if (timeZone !== baseline.current.timeZone || goalMinutes !== baseline.current.goalMinutes) setChangedElsewhere(true);
  }, [timeZone, goalMinutes]);
  const markDirty = () => { dirtyRef.current = true; setDirty(true); setNotice(''); };
  async function save(event: FormEvent) {
    event.preventDefault(); if (!onSave || busy) return;
    const zone = zoneDraft.trim();
    if (!isStatisticsTimeZone(zone)) { setError(t("请输入有效的统计时区", "Enter a valid statistics timezone")); return; }
    if (!/^\d+$/u.test(goalDraft) || !Number.isInteger(Number(goalDraft)) || Number(goalDraft) < 0 || Number(goalDraft) > 1440) { setError(t("每日目标须为 0–1440 的整数", "Daily goal must be a whole number from 0 to 1440")); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await onSave({ statisticsTimezone: zone, dailyGoalMinutes: Number(goalDraft) });
      dirtyRef.current = false; setDirty(false); baseline.current = { timeZone: zone, goalMinutes: Number(goalDraft) }; setChangedElsewhere(false); setNotice(t("已保存在本机", "Saved locally"));
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("保存失败", "Save failed")); }
    finally { setBusy(false); }
  }
  return <section className="activity-calendar" aria-labelledby="activity-title">
    <div className="activity-header"><h2 id="activity-title">{t("活动日历", "Activity calendar")}</h2><span className="feature-muted">{t("全部练习 ·", "All practice ·")} {provisional ? t("本机临时时区", "Temporary local timezone") : t("统计时区", "Statistics timezone")}：{timeZone}</span></div>
    <dl className="feature-metrics activity-streaks"><div><dt>{currentLabel}</dt><dd>{streaks.current}  {t("天", "days")}</dd></div><div><dt>{longestLabel}</dt><dd>{streaks.longest}  {t("天", "days")}</dd></div></dl>
    <div className="activity-month"><button type="button" className="outline-button feature-action-button" aria-label={t("上个月", "Previous month")} onClick={() => { const next = shiftCalendarMonth(month, -1); setMonth(next); setSelected(`${next}-01`); }}>‹</button>
      <strong>{month}</strong><button type="button" className="outline-button feature-action-button" aria-label={t("下个月", "Next month")} disabled={month >= today.slice(0, 7)} onClick={() => { const next = shiftCalendarMonth(month, 1); setMonth(next); setSelected(next === today.slice(0, 7) ? today : `${next}-01`); }}>›</button></div>
    <table className="activity-grid" aria-label={t("活动日历", "Activity calendar")}><thead><tr>{[t("一", "Mon"), t("二", "Tue"), t("三", "Wed"), t("四", "Thu"), t("五", "Fri"), t("六", "Sat"), t("日", "Sun")].map((day) => <th key={day} scope="col">{day}</th>)}</tr></thead>
      <tbody>{Array.from({ length: 6 }, (_, week) => <tr key={week}>{monthDays.slice(week * 7, week * 7 + 7).map((day, index) => {
        const activity = day ? days.get(day) : undefined;
        return <td key={day ?? `empty-${index}`}>{day && <button type="button" className={`activity-day${activity ? ' has-activity' : ''}`} aria-pressed={selected === day}
          aria-label={`${day}${t('，', ', ')}${activity?.sessions ?? 0} ${t('次', 'sessions')}`} onClick={() => setSelected(day)}><span>{Number(day.slice(-2))}</span>{activity && <small>{activity.sessions}</small>}</button>}</td>;
      })}</tr>)}</tbody></table>
    <div className="activity-selected"><h3>{selected}</h3><p>{selectedDay?.sessions ?? 0}  {t("次 ·", "sessions ·")} {known}{selectedDay?.missingElapsed ? ` · ${selectedDay.missingElapsed} ${t('条用时未知', 'unknown durations')}` : ''}</p>
      {goalMinutes > 0 && <p>{t("每日目标：", "Daily goal:")}{known} / {goalMinutes}  {t("分钟", "min")}{selectedDay && selectedDay.elapsedMs >= goalMinutes * 60_000 ? t("· 已达成", "· Reached") : ''}{selectedDay?.missingElapsed ? t("· 部分用时未知", "· Some durations unknown") : ''}</p>}
      {!!selectedDay?.records.length && <ul className="activity-records" aria-label={t("当日记录", "Daily records")}>{[...selectedDay.records].sort((a, b) => b.finishedAt - a.finishedAt).map((record) => <li key={stableRecordId(record)}>
        <button type="button" className="text-button" title={record.article?.title ?? t("练习", "Practice")} disabled={!onOpenRecord} aria-label={`${t("查看记录：", "View record: ")}${record.article?.title ?? t("练习", "Practice")}, ${record.speed} ${record.language === 'zh' ? t("字/分", "chars/min") : 'WPM'}`} onClick={() => onOpenRecord?.(stableRecordId(record))}>{record.article?.title ?? t("练习", "Practice")} · {record.speed} {record.language === 'zh' ? t("字/分", "chars/min") : 'WPM'}</button>
      </li>)}</ul>}
    </div>
    {onSave && <details className="account-section activity-settings"><summary>{t("日历设置", "Calendar settings")}</summary><form className="feature-form" onSubmit={(event) => void save(event)}>
      <label>{t("统计时区", "Statistics timezone")}<input list="statistics-time-zones" value={zoneDraft} disabled={busy} onChange={(event) => { setZoneDraft(event.target.value); markDirty(); }} /></label>
      <datalist id="statistics-time-zones">{zones().map((zone) => <option key={zone} value={zone} />)}</datalist>
      <label>{t("每日目标（分钟，0 为关闭）", "Daily goal (minutes, 0 to disable)")}<input type="number" min="0" max="1440" step="1" value={goalDraft} disabled={busy} onChange={(event) => { setGoalDraft(event.target.value); markDirty(); }} /></label>
      {changedElsewhere && <p className="form-error" role="status">{t("设置已在其他设备更新，请确认后保存", "Settings changed on another device. Review before saving.")}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}
      <div className="feature-actions"><button type="submit" className="outline-button" disabled={busy || !dirty}>{t("保存日历设置", "Save calendar settings")}</button></div>
    </form></details>}
  </section>;
}
