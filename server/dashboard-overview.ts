import type { CountryVisits, OverviewActivity, OverviewDay, OverviewRange, RegionVisits, TrackedPage } from '../src/lib/admin-overview.js';
import { dashboardVisitsTable, dayMilliseconds, utcDay, type DashboardVisits } from './dashboard-visits.js';
import type { AsyncDatabase } from './database/types.js';

const byUtcDay = (column: string) => `${column} - (${column} % ${dayMilliseconds})`;

export function createOverviewActivity(db: AsyncDatabase, visits: DashboardVisits) {
  const registrations = db.prepare(`SELECT ${byUtcDay('created_at')} AS day, COUNT(*) AS total FROM users
    WHERE created_at>=@start AND created_at<@end GROUP BY day`);
  const practices = db.prepare(`SELECT ${byUtcDay('finished_at')} AS day, COUNT(*) AS total FROM challenges
    WHERE finished_at>=@start AND finished_at<@end GROUP BY day`);
  const practiceBreakdown = db.prepare(`SELECT COUNT(CASE WHEN owner LIKE 'u:%' THEN 1 END) AS registeredPractices,
    COUNT(CASE WHEN owner LIKE 'g:%' THEN 1 END) AS guestPractices,
    COUNT(DISTINCT CASE WHEN owner LIKE 'u:%' THEN owner END) AS activeAccounts
    FROM challenges WHERE finished_at>=@start AND finished_at<@end`);
  const feedback = db.prepare("SELECT COUNT(*) AS openFeedback FROM feedback WHERE status IN ('pending','processing')");
  const fromVisits = `FROM ${dashboardVisitsTable} WHERE day>=@start AND day<@end`;
  const pageViews = db.prepare(`SELECT day, SUM(views) AS total,
    SUM(CASE WHEN country<>'' THEN views ELSE 0 END) AS located ${fromVisits} GROUP BY day`);
  const topCountries = db.prepare(`SELECT country,SUM(views) AS views ${fromVisits}
    AND country<>'' GROUP BY country ORDER BY views DESC,country LIMIT 8`);
  const topRegions = db.prepare(`SELECT country,region,SUM(views) AS views ${fromVisits}
    AND region<>'' GROUP BY country,region ORDER BY views DESC,country,region LIMIT 8`);
  const topPages = db.prepare(`SELECT page,SUM(views) AS views ${fromVisits} GROUP BY page ORDER BY views DESC,page LIMIT 8`);

  return async (time: number, range: OverviewRange): Promise<OverviewActivity> => {
    const end = utcDay(time) + dayMilliseconds;
    const start = end - range * dayMilliseconds;
    const bounds = { start, end };
    const available = await visits.available();
    const [registered, completed, breakdown, feedbackCount, traffic, countries, regions, pages] = await Promise.all([
      registrations.all(bounds), practices.all(bounds), practiceBreakdown.get(bounds), feedback.get(),
      available ? pageViews.all(bounds) : [], available ? topCountries.all(bounds) : [],
      available ? topRegions.all(bounds) : [], available ? topPages.all(bounds) : [],
    ]);
    // PostgreSQL SUM(bigint) is returned as numeric text by the driver.
    const totalsByDay = (rows: Array<{ day: number; total: number | string }>) => new Map(rows.map((row) => [row.day, Number(row.total)]));
    const registrationTotals = totalsByDay(registered);
    const practiceTotals = totalsByDay(completed);
    const viewTotals = totalsByDay(traffic);
    const days: OverviewDay[] = Array.from({ length: range }, (_, index) => {
      const day = start + index * dayMilliseconds;
      return {
        date: new Date(day).toISOString().slice(0, 10),
        registrations: registrationTotals.get(day) ?? 0,
        practices: practiceTotals.get(day) ?? 0,
        pageViews: viewTotals.get(day) ?? 0,
      };
    });
    return {
      days, ...breakdown, ...feedbackCount,
      traffic: {
        available,
        locatedViews: traffic.reduce((total, row) => total + Number(row.located), 0),
        countries: countries.map((row): CountryVisits => ({ country: row.country, views: Number(row.views) })),
        regions: regions.map((row): RegionVisits => ({ country: row.country, region: row.region, views: Number(row.views) })),
        pages: pages.map((row): { page: TrackedPage; views: number } => ({ page: row.page, views: Number(row.views) })),
      },
    };
  };
}
