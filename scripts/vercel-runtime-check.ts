import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { PostgresDatabase } from '../server/postgres/database.js';
import { createApp } from '../server/app.js';

// Deployment build check only. Normal application startup never performs DDL.
async function main() {
  if (process.env.VERCEL !== '1') return;
  const env = process.env;
  if (!env.DATABASE_URL || !env.CODE_SECRET || env.CODE_SECRET.length < 32) throw new Error('Database and stable CODE_SECRET are required');
  const schema = env.DAZI_DATABASE_SCHEMA || 'public';
  const target = new URL(env.DATABASE_URL);
  const name = decodeURIComponent(target.pathname.slice(1));
  const runOperator = (action: string) => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/postgres-database.ts', action], {
      stdio: 'inherit', env: { ...env, DAZI_DATABASE_HOST: target.hostname, DAZI_DATABASE_NAME: name, DAZI_DATABASE_SCHEMA: schema, DAZI_CONFIRM_TARGET: `${target.hostname}/${name}/${schema}` },
    });
    if (result.status !== 0) throw new Error('Explicit SEO configuration installation failed');
  };
  if (env.TYPELUNE_INIT_PREVIEW) {
    if (env.VERCEL_ENV !== 'preview' || env.TYPELUNE_INIT_PREVIEW !== schema || !/^typelune_preview_[a-z0-9_]+$/.test(schema)) throw new Error('Preview initialization requires an explicitly selected isolated preview schema');
    const client = new pg.Client({ connectionString: env.DATABASE_URL });
    try { await client.connect(); await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`); } finally { await client.end(); }
    for (const action of ['migrate', 'support', 'seo', 'wallpaper', 'nickname-policy', 'seed']) runOperator(action);
  }
  const database = new PostgresDatabase(env.DATABASE_URL, schema);
  try { await database.verifySchema(); } finally { await database.close(); }
  if (env.TYPELUNE_INSTALL_SEO) {
    if (!['preview', 'production'].includes(env.TYPELUNE_INSTALL_SEO) || env.TYPELUNE_INSTALL_SEO !== env.VERCEL_ENV) throw new Error('SEO installation environment does not match the deployment');
    runOperator('seo');
  }
  if (env.TYPELUNE_INSTALL_WALLPAPER) {
    if (!['preview', 'production'].includes(env.TYPELUNE_INSTALL_WALLPAPER) || env.TYPELUNE_INSTALL_WALLPAPER !== env.VERCEL_ENV) throw new Error('Wallpaper installation environment does not match the deployment');
    runOperator('wallpaper');
  }
  if (env.TYPELUNE_INSTALL_NICKNAME_POLICY) {
    if (!['preview', 'production'].includes(env.TYPELUNE_INSTALL_NICKNAME_POLICY) || env.TYPELUNE_INSTALL_NICKNAME_POLICY !== env.VERCEL_ENV) throw new Error('Nickname policy installation environment does not match the deployment');
    runOperator('nickname-policy');
  }
  const app = await createApp({ databaseUrl: env.DATABASE_URL, postgresSchema: schema, codeSecret: env.CODE_SECRET, secureCookies: true });
  try { await app.ready(); } finally { await app.close(); }
  console.log('Deployment runtime and database compatibility verified.');
}
main().catch((error: unknown) => {
  // Whitelist fixed diagnostics; driver errors can contain credentials or SQL values.
  const allowed = new Set(['Database and stable CODE_SECRET are required', 'PostgreSQL database URL is required', 'Invalid PostgreSQL connection configuration', 'Invalid PostgreSQL schema name',
    'PostgreSQL schema is missing, unavailable, or incompatible; run the explicit migration', 'SEO installation environment does not match the deployment', 'Nickname policy installation environment does not match the deployment', 'Wallpaper installation environment does not match the deployment', 'Preview initialization requires an explicitly selected isolated preview schema', 'Explicit SEO configuration installation failed']);
  console.error(error instanceof Error && allowed.has(error.message) ? error.message : 'Deployment runtime verification failed; inspect the selected project configuration.');
  process.exitCode = 1;
});
