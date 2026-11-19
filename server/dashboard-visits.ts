import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { trackedPages } from '../src/lib/admin-overview.js';
import type { AsyncDatabase } from './database/types.js';

export const dashboardVisitsTable = 'site_visit_daily';
export const dashboardVisitsSchema = `CREATE TABLE IF NOT EXISTS ${dashboardVisitsTable} (
  day BIGINT NOT NULL, page TEXT NOT NULL CHECK (page IN (${trackedPages.map((page) => `'${page}'`).join(', ')})),
  country TEXT NOT NULL CHECK (length(country) IN (0, 2)), region TEXT NOT NULL CHECK (length(region)<=3),
  views BIGINT NOT NULL CHECK (views>0), PRIMARY KEY(day,page,country,region)
);`;

export const dayMilliseconds = 86_400_000;
export const utcDay = (time: number) => Math.floor(time / dayMilliseconds) * dayMilliseconds;
const visitInput = z.strictObject({ page: z.enum(trackedPages) });
const countryNames = new Intl.DisplayNames('en', { type: 'region', fallback: 'none' });

export async function createDashboardVisits(db: AsyncDatabase) {
  if (db.dialect === 'sqlite') await db.exec(dashboardVisitsSchema);
  let installed = db.dialect === 'sqlite';
  let lastPrunedDay: number | undefined;
  const upsert = db.prepare(`INSERT INTO ${dashboardVisitsTable}(day,page,country,region,views) VALUES (?,?,?,?,1)
    ON CONFLICT(day,page,country,region) DO UPDATE SET views=${dashboardVisitsTable}.views+1`);
  const prune = db.prepare(`DELETE FROM ${dashboardVisitsTable} WHERE day<?`);

  async function available() {
    if (!installed) installed = !!(await db.prepare(`SELECT to_regclass('${dashboardVisitsTable}') AS name`).get())?.name;
    return installed;
  }

  const record = db.transaction(async (day: number, page: string, country: string, region: string) => {
    if (lastPrunedDay !== day) await prune.run(day - 89 * dayMilliseconds);
    await upsert.run(day, page, country, region);
  });

  return {
    available,
    async record(time: number, page: string, country: string, region: string) {
      const day = utcDay(time);
      await record(day, page, country, region);
      lastPrunedDay = day;
    },
  };
}

export type DashboardVisits = Awaited<ReturnType<typeof createDashboardVisits>>;

export function registerDashboardVisits(app: FastifyInstance, visits: DashboardVisits, now: () => number, geoSource?: 'vercel') {
  app.post('/api/site/visit', {
    bodyLimit: 256,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = visitInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: '无效的页面访问' });
    if (request.headers['sec-gpc'] === '1' || request.headers.dnt === '1' || request.headers.dnt === 'yes' || !await visits.available()) {
      return reply.code(204).send();
    }

    const countryHeader = geoSource === 'vercel' ? request.headers['x-vercel-ip-country'] : undefined;
    const regionHeader = geoSource === 'vercel' ? request.headers['x-vercel-ip-country-region'] : undefined;
    const country = typeof countryHeader === 'string' && /^[A-Z]{2}$/.test(countryHeader) && countryHeader !== 'ZZ' && countryNames.of(countryHeader) ? countryHeader : '';
    const region = country && typeof regionHeader === 'string' && /^[A-Z0-9]{1,3}$/.test(regionHeader) ? regionHeader : '';
    await visits.record(now(), parsed.data.page, country, region);
    return reply.code(204).send();
  });
}
