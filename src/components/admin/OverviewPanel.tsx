import { useState, type CSSProperties, type ReactNode } from 'react';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { ClipboardText } from '@phosphor-icons/react/ClipboardText';
import { GlobeHemisphereWest } from '@phosphor-icons/react/GlobeHemisphereWest';
import { Keyboard } from '@phosphor-icons/react/Keyboard';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { useI18n } from '../../lib/i18n';
import type { OverviewActivity, OverviewDay, OverviewRange, TrackedPage } from '../../lib/admin-overview';
import { AuditRows, LoadState, Metrics, useAdminResource, type AdminProps, type Audit } from './common';
import { useAdminText } from './i18n';
import './overview.css';

const labels = {
  users: '注册账号', disabledUsers: '已停用账号', admins: '在任管理员', activeUsers7d: '近 7 天练习账号',
  finishedPractices7d: '近 7 天在线练习', pendingScores: '待审核成绩', publishedScores: '已发布成绩', publishedArticles: '已发布文章',
};
const pageLabels: Record<TrackedPage, [string, string]> = {
  practice: ['打字练习', 'Typing practice'], lessons: ['课程', 'Lessons'], library: ['文章库', 'Article library'], article: ['文章详情', 'Article details'],
  rankings: ['排行榜', 'Rankings'], profile: ['公开主页', 'Public profiles'], help: ['帮助', 'Help'], about: ['关于', 'About'], privacy: ['隐私政策', 'Privacy'], terms: ['服务条款', 'Terms'],
};
type Overview = { metrics: Record<keyof typeof labels, number>; recentActions: Audit[]; activity?: OverviewActivity };
type Series = Exclude<keyof OverviewDay, 'date'>;
type RankedRow = { id: string; label: string; count: number };
const locales = { zh: 'zh-CN', en: 'en-US' };

function KeyMetric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <div>
    <dt><span className="overview-metric-icon" aria-hidden="true">{icon}</span>{label}</dt>
    <dd><strong>{value}</strong><small>{detail}</small></dd>
  </div>;
}

function ActivityChart({ days, trafficAvailable, selected, onSelect, format }: {
  days: OverviewDay[]; trafficAvailable: boolean; selected: Series; onSelect: (value: Series) => void; format: (value: number) => string;
}) {
  const { t, locale } = useI18n();
  const series = selected === 'pageViews' && !trafficAvailable ? 'practices' : selected;
  const names = { pageViews: t('页面浏览', 'Page views'), practices: t('在线练习', 'Practices'), registrations: t('新增注册', 'Sign-ups') };
  const date = new Intl.DateTimeFormat(locales[locale], { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
  const peak = Math.max(1, ...days.map((day) => day[series]));
  const power = 10 ** Math.floor(Math.log10(Math.max(1, peak / 4)));
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((unit) => unit * 4 >= peak) ?? 10 * power;
  const ticks = [4, 3, 2, 1, 0].map((position) => position * step);
  const labelEvery = days.length > 7 ? 7 : 1;
  return <section className="overview-card overview-activity" aria-labelledby="overview-activity-title">
    <div className="overview-card-heading">
      <div><h3 id="overview-activity-title">{t('活跃趋势', 'Activity over time')}</h3><p>{t('按日统计 · UTC', 'Daily totals · UTC')}</p></div>
      <div className="overview-segments" role="group" aria-label={t('趋势指标', 'Chart metric')}>
        {(Object.keys(names) as Series[]).map((key) => <button type="button" key={key} aria-pressed={series === key} disabled={key === 'pageViews' && !trafficAvailable} onClick={() => onSelect(key)}>{names[key]}</button>)}
      </div>
    </div>
    <div className="overview-chart" data-series={series} aria-hidden="true">
      <div className="overview-chart-axis">{ticks.map((tick) => <span key={tick}>{format(tick)}</span>)}</div>
      <ol className="overview-chart-bars" style={{ '--overview-day-count': days.length } as CSSProperties}>
        {days.map((day, index) => <li key={day.date}>
          <div title={`${day.date} · ${format(day[series])}`}><i style={{ height: `${day[series] / (step * 4) * 100}%` }} /></div>
          {(index % labelEvery === 0 || index === days.length - 1 && index % labelEvery > 2) && <span>{date.format(new Date(day.date))}</span>}
        </li>)}
      </ol>
    </div>
    <details className="overview-chart-data">
      <summary>{t('查看每日数据', 'Show daily totals')}</summary>
      <table aria-label={names[series]}>
        <thead><tr><th scope="col">{t('日期', 'Date')}</th><th scope="col">{names[series]}</th></tr></thead>
        <tbody>{days.map((day) => <tr key={day.date}><th scope="row"><time dateTime={day.date}>{day.date}</time></th><td>{format(day[series])}</td></tr>)}</tbody>
      </table>
    </details>
  </section>;
}

function RankedVisits({ rows, total, format }: { rows: RankedRow[]; total: number; format: (value: number) => string }) {
  return <ol className="overview-ranking">{rows.map(({ id, label, count }) => <li key={id}>
    <div><span>{label}</span><strong>{format(count)}</strong></div>
    <div className="overview-rank-track" aria-hidden="true"><span style={{ width: `${count / Math.max(1, total) * 100}%` }} /></div>
  </li>)}</ol>;
}

function Audience({ traffic, total, regions, setRegions, format }: {
  traffic: OverviewActivity['traffic']; total: number; regions: boolean; setRegions: (show: boolean) => void; format: (value: number) => string;
}) {
  const { t, locale } = useI18n();
  const names = new Intl.DisplayNames(locales[locale], { type: 'region' });
  const rows = regions
    ? traffic.regions.map(({ country, region, views }) => ({ id: `${country}-${region}`, label: `${names.of(country)} · ${country}-${region}`, count: views }))
    : traffic.countries.map(({ country, views }) => ({ id: country, label: names.of(country) ?? country, count: views }));
  const unknownViews = Math.max(0, total - traffic.locatedViews);
  return <section className="overview-card" aria-labelledby="overview-audience-title">
    <div className="overview-card-heading">
      <div><h3 id="overview-audience-title">{t('访问地区', 'Visitor geography')}</h3><p>{t('按浏览量排名', 'Ranked by page views')}</p></div>
      <div className="overview-segments" role="group" aria-label={t('地理层级', 'Geographic level')}>
        <button type="button" aria-pressed={!regions} onClick={() => setRegions(false)}>{t('国家／地区', 'Country')}</button>
        <button type="button" aria-pressed={regions} onClick={() => setRegions(true)}>{t('省／州', 'Region')}</button>
      </div>
    </div>
    {rows.length > 0 ? <RankedVisits rows={rows} total={total} format={format} /> : <p className="overview-empty">
      {!traffic.available ? t('访问统计存储未启用。', 'Traffic storage is unavailable.') : regions ? t('暂无省州数据', 'No regional data yet') : t('暂无地区数据', 'No location data yet')}
    </p>}
    {!!unknownViews && <p className="overview-geography-note">{t('未知地区', 'Unknown location')} <strong>{format(unknownViews)}</strong></p>}
  </section>;
}

export function OverviewPanel({ ownerId }: AdminProps) {
  const { at } = useAdminText();
  const { t, locale } = useI18n();
  const [range, setRange] = useState<OverviewRange>(7);
  const [series, setSeries] = useState<Series>('pageViews');
  const [regions, setRegions] = useState(false);
  const { data, error, retry } = useAdminResource<Overview>(ownerId, range === 7 ? '/overview' : '/overview?days=30');
  const format = new Intl.NumberFormat(locales[locale]).format;
  const activity = data?.activity;
  const totals = activity?.days.reduce((sum, day) => ({ views: sum.views + day.pageViews, practices: sum.practices + day.practices, registrations: sum.registrations + day.registrations }), { views: 0, practices: 0, registrations: 0 });
  const hasActivity = activity && totals && data;
  return <div className="admin-overview">
    <div className="overview-header">
      <div><h2>{t('运营概览', 'Site overview')}</h2>{hasActivity && <p><time dateTime={activity.days[0].date}>{activity.days[0].date}</time><span> – </span><time dateTime={activity.days.at(-1)!.date}>{activity.days.at(-1)!.date}</time></p>}</div>
      <div className="overview-segments overview-range" role="group" aria-label={t('统计周期', 'Reporting period')}>
        <button type="button" aria-pressed={range === 7} onClick={() => setRange(7)}>{t('最近 7 天', 'Last 7 days')}</button>
        <button type="button" aria-pressed={range === 30} onClick={() => setRange(30)}>{t('最近 30 天', 'Last 30 days')}</button>
      </div>
    </div>
    {!data ? <LoadState error={error} retry={retry} /> : !hasActivity ? <Metrics entries={(Object.keys(labels) as (keyof typeof labels)[]).map((key) => [at(labels[key]), data.metrics[key]])} /> : <>
      <dl className="overview-key-metrics">
        <KeyMetric icon={<GlobeHemisphereWest size={20} weight="duotone" />} label={t('页面浏览量', 'Page views')}
          value={activity.traffic.available ? format(totals.views) : '—'} detail={t('公开页面', 'Public pages')} />
        <KeyMetric icon={<Keyboard size={20} weight="duotone" />} label={t('完成在线练习', 'Online practices completed')} value={format(totals.practices)}
          detail={t(`用户 ${format(activity.registeredPractices)} · 游客 ${format(activity.guestPractices)}`, `${format(activity.registeredPractices)} signed-in · ${format(activity.guestPractices)} guest`)} />
        <KeyMetric icon={<UserPlus size={20} weight="duotone" />} label={t('新增注册账号', 'New accounts')} value={format(totals.registrations)}
          detail={t(`累计 ${format(data.metrics.users)} 个账号`, `${format(data.metrics.users)} accounts total`)} />
        <KeyMetric icon={<ClipboardText size={20} weight="duotone" />} label={at('待审核成绩')} value={format(data.metrics.pendingScores)}
          detail={t(`另有 ${format(activity.openFeedback)} 条待处理反馈`, `${format(activity.openFeedback)} open feedback reports`)} />
      </dl>
      <div className="overview-split">
        <ActivityChart days={activity.days} trafficAvailable={activity.traffic.available} selected={series} onSelect={setSeries} format={format} />
        <Audience traffic={activity.traffic} total={totals.views} regions={regions} setRegions={setRegions} format={format} />
      </div>
      <div className="overview-split">
        <section className="overview-card" aria-labelledby="overview-pages-title">
          <div className="overview-card-heading"><div><h3 id="overview-pages-title">{t('热门页面', 'Top pages')}</h3><p>{t('按浏览量排名', 'Ranked by page views')}</p></div><ChartLineUp size={22} aria-hidden="true" /></div>
          {activity.traffic.pages.length ? <RankedVisits rows={activity.traffic.pages.map(({ page, views }) => ({ id: page, label: t(...pageLabels[page]), count: views }))} total={totals.views} format={format} />
            : <p className="overview-empty">{t('暂无浏览数据', 'No page views yet')}</p>}
        </section>
        <section className="overview-card" aria-labelledby="overview-status-title">
          <div className="overview-card-heading"><div><h3 id="overview-status-title">{t('站点状态', 'Site status')}</h3></div></div>
          <dl className="overview-status">
            <div><dt>{at('注册账号')}</dt><dd>{format(data.metrics.users)}</dd></div>
            <div><dt>{t('活跃练习账号', 'Accounts that practiced')}</dt><dd>{format(activity.activeAccounts)}</dd></div>
            <div><dt>{at('已停用账号')}</dt><dd>{format(data.metrics.disabledUsers)}</dd></div>
            <div><dt>{at('在任管理员')}</dt><dd>{format(data.metrics.admins)}</dd></div>
            <div><dt>{at('已发布成绩')}</dt><dd>{format(data.metrics.publishedScores)}</dd></div>
            <div><dt>{at('已发布文章')}</dt><dd>{format(data.metrics.publishedArticles)}</dd></div>
          </dl>
        </section>
      </div>
    </>}
    {data && <section className="overview-card overview-audit" aria-labelledby="overview-audit-title">
      <div className="overview-card-heading"><div><h3 id="overview-audit-title">{at('最近操作')}</h3></div></div>
      <AuditRows entries={data.recentActions} label={at('最近操作列表')} />
    </section>}
  </div>;
}
