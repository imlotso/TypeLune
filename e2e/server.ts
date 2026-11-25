import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../server/app';
import { PostgresDatabase } from '../server/postgres/database';
import { AsyncPostgres } from '../server/database/postgres';
import { migratePostgres } from '../server/postgres/migrate';
import { seedPostgresCatalog } from '../server/postgres/seed';
import {nicknamePolicySchema} from '../server/nickname-policy';
import { wallpaperSchema } from '../server/wallpaper-schema';
import { registrationPolicySchema } from '../server/registration-policy';

// Test-only server: real app and an isolated database, with an in-memory mailbox.
const directory = mkdtempSync(join(tmpdir(), 'dazi-e2e-'));
const mailbox = new Map<string, string>();
const postgresUrl = process.env.DAZI_E2E_POSTGRES_URL;
let setup: pg.Client | undefined;
let schema: string | undefined;
if (postgresUrl) {
  const parsed = new URL(postgresUrl);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) || !/test/i.test(parsed.pathname)) {
    throw new Error('Browser integration tests require a disposable loopback PostgreSQL test database');
  }
  setup = new pg.Client({ connectionString: postgresUrl });
  await setup.connect();
  schema = 'dazi_e2e_' + randomBytes(8).toString('hex');
  await setup.query(`CREATE SCHEMA "${schema}"`);
  await setup.query(`SET search_path TO "${schema}"`);
  await migratePostgres(setup, { database: parsed.pathname.slice(1), schema });
  // Optional production extensions are installed explicitly, including in this
  // uniquely named, loopback-only disposable browser-test schema.
  await setup.query(readFileSync(new URL('../server/postgres/support-settings.sql', import.meta.url), 'utf8'));
  await setup.query(readFileSync(new URL('../server/postgres/footer-settings.sql', import.meta.url), 'utf8'));
  await setup.query(readFileSync(new URL('../server/postgres/appearance-settings.sql', import.meta.url), 'utf8'));
  await setup.query(readFileSync(new URL('../server/postgres/seo-settings.sql', import.meta.url), 'utf8'));
  await setup.query(wallpaperSchema);
  await setup.query(nicknamePolicySchema);
  await setup.query(registrationPolicySchema);
  const database = new PostgresDatabase(postgresUrl, schema);
  try { await seedPostgresCatalog(new AsyncPostgres(database)); } finally { await database.close(); }
}
const app = await createApp({
  ...(postgresUrl ? { databaseUrl: postgresUrl, postgresSchema: schema } : { databasePath: join(directory, 'test.sqlite') }),
  staticRoot: resolve(process.env.DAZI_E2E_STATIC_ROOT || 'dist/client'),
  secureCookies: true,
  // Each isolated browser test supplies a distinct forwarded address so the
  // real per-address rate limits do not accumulate across unrelated tests.
  trustProxy: true,
  codeSecret: 'ci-only-secret-not-used-outside-tests',
  adminEmail: 'admin@example.test',
  mailer: { async sendCode(email, code, purpose) { mailbox.set(`${email}:${purpose}`, code); } },
});

app.get('/__e2e__/email-code', async (request, reply) => {
  const { email, purpose } = request.query as { email?: string; purpose?: string };
  const code = mailbox.get(`${email}:${purpose}`);
  return code ? { code } : reply.code(404).send({ error: 'No test email received' });
});

let closing = false;
const cleanup = async () => {
  if (closing) return;
  closing = true;
  await app.close();
  if (setup && schema) {
    await setup.query('SET search_path TO public');
    await setup.query(`DROP SCHEMA "${schema}" CASCADE`);
    await setup.end();
  }
  rmSync(directory, { recursive: true, force: true });
  process.exit(0);
};
process.once('SIGTERM', () => { void cleanup(); });
process.once('SIGINT', () => { void cleanup(); });
process.on('message', (message) => {
  if (message && typeof message === 'object' && 'type' in message && message.type === 'typing-e2e-shutdown') void cleanup();
});
const address = await app.listen({ host: '127.0.0.1', port: Number(process.env.E2E_PORT || 4178) });
if (process.env.TYPING_IME_DISCOVER_PORT === '1') console.log(`TYPING_TEST_URL=${address}`);
