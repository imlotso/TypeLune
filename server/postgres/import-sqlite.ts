import Database from 'better-sqlite3';
import { createHash, type Hash } from 'node:crypto';
import type { Client } from 'pg';
import { assertPostgresTarget, type ExpectedTarget } from './migrate.js';
import { dataTables, schemaMatches } from './schema.js';
import { decodeEmail, encodeEmail } from '../database/email.js';

type Column = { name: string; type: string; pk: bigint };
type Row = Record<string, unknown>;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const integer = (column: Column) => /INT/i.test(column.type);
const optionalTables = new Set(['workspace_revisions', 'workspace_generations', 'workspace_deleted_drafts', 'workspace_deleted_records', 'workspace_legacy_record_aliases', 'workspace_local_conflict_bases',
  'account_email_codes', 'feedback', 'feedback_messages', 'feedback_attachments', 'feedback_upload_chunks', 'retired_attempts', 'history_deletion_receipts']);
const optionalColumns: Record<string, string[]> = { users: ['display_name', 'avatar'], sessions: ['id', 'created_at', 'last_active_at', 'device'],
  challenges: ['public_review_message'], workspace_items: ['revision'] };
const normalize = (row: Row, columns: Column[], table: string, postgres: boolean) => columns.map((column) => {
  const binaryTyped = table === 'challenges' && column.name === 'typed';
  const binaryAttachment = (table === 'feedback_attachments' || table === 'feedback_upload_chunks') && column.name === 'bytes';
  const encodedEmail = (table === 'users' || table === 'email_codes') && column.name === 'email';
  const raw = row[column.name];
  const value = binaryTyped && Buffer.isBuffer(raw) ? raw.toString('utf8')
    : binaryAttachment && Buffer.isBuffer(raw) ? { bytes: raw.toString('base64') }
      : table === 'workspace_legacy_record_aliases' && column.name === 'source_id' && raw === '\0local-conflict' ? ''
        : encodedEmail && postgres && typeof raw === 'string' ? decodeEmail(raw) : raw;
  if (value === null) return null;
  if (value === undefined || Buffer.isBuffer(value) || typeof value === 'number' && !Number.isFinite(value) ||
    typeof value === 'string' && value.includes('\0') && !binaryTyped && !encodedEmail) throw new Error(`Unsupported value in ${column.name}`);
  return integer(column) ? String(value) : value;
});
const updateHash = (hash: Hash, row: Row, columns: Column[], table: string, postgres = false) =>
  hash.update(JSON.stringify(normalize(row, columns, table, postgres)) + '\n');

/** Copy an immutable SQLite snapshot into an empty, already migrated target. */
export async function importSqlite(client: Client, path: string, target: ExpectedTarget) {
  if (!path) throw new Error('An explicit SQLite source path is required');
  const sqlite = new Database(path, { readonly: true, fileMustExist: true });
  sqlite.defaultSafeIntegers(true);
  let transactionStarted = false;
  try {
    sqlite.exec('BEGIN');
    const integrity = sqlite.pragma('integrity_check') as Array<{ integrity_check: string }>;
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' || (sqlite.pragma('foreign_key_check') as unknown[]).length) {
      throw new Error('SQLite integrity or foreign-key validation failed');
    }
    const sourceTables = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>).map(({ name }) => name);
    const unknown = sourceTables.filter((name) => !dataTables.some((table) => table === name));
    if (unknown.length) throw new Error('SQLite source contains unsupported tables');
    for (const table of dataTables) {
      if (!sourceTables.includes(table) && !optionalTables.has(table)) throw new Error(`SQLite source is missing ${table}`);
    }
    await client.query('BEGIN');
    transactionStarted = true;
    await assertPostgresTarget(client, target);
    await client.query(`SET LOCAL search_path TO ${quote(target.schema)}, pg_catalog`);
    const migration = await client.query<{ version: number; checksum: string }>('SELECT version,checksum FROM dazi_schema_migrations ORDER BY version');
    if (!schemaMatches(migration.rows)) throw new Error('Unsupported PostgreSQL schema version');
    await client.query(`LOCK TABLE ${[...dataTables, 'rate_limit_entries'].map(quote).join(',')} IN ACCESS EXCLUSIVE MODE`);
    for (const table of dataTables) {
      const result = await client.query(`SELECT 1 FROM ${quote(table)} LIMIT 1`);
      if (result.rowCount) throw new Error('PostgreSQL target is not empty');
    }
    if ((await client.query('SELECT 1 FROM rate_limit_entries LIMIT 1')).rowCount) throw new Error('PostgreSQL target is not empty');
    const counts: Record<string, number> = {};
    for (const table of dataTables) {
      if (!sourceTables.includes(table)) { counts[table] = 0; continue; }
      const columns = sqlite.pragma(`table_info(${quote(table)})`) as Column[];
      const pgColumns = await client.query<{ column_name: string }>(
        'SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',
        [target.schema, table],
      );
      const sourceNames = new Set(columns.map(({ name }) => name));
      const targetNames = new Set(pgColumns.rows.map(({ column_name }) => column_name));
      if (columns.some(({ name }) => !targetNames.has(name)) || pgColumns.rows.some(({ column_name }) => !sourceNames.has(column_name) && !optionalColumns[table]?.includes(column_name))) {
        throw new Error(`SQLite and PostgreSQL columns differ for ${table}`);
      }
      const primary = columns.filter(({ pk }) => pk > 0n).sort((a, b) => Number(a.pk - b.pk));
      if (!primary.length) throw new Error(`SQLite table ${table} has no primary key`);
      const sqliteOrder = primary.map(({ name }) => quote(name)).join(',');
      const pgOrder = primary.map((column) => quote(column.name) + (/TEXT/i.test(column.type) ? ' COLLATE "C"' : '')).join(',');
      const names = columns.map(({ name }) => quote(name)).join(',');
      const source = sqlite.prepare(`SELECT ${names} FROM ${quote(table)} ORDER BY ${sqliteOrder}`).iterate() as Iterable<Row>;
      const sourceHash = createHash('sha256');
      const sourceEmailRows: string[] = [];
      let count = 0;
      let batch: unknown[][] = [];
      let batchBytes = 0;
      async function flush() {
        if (!batch.length) return;
        const values = batch.flat();
        const groups = batch.map((row, r) => '(' + row.map((_, c) => '$' + (r * columns.length + c + 1)).join(',') + ')');
        await client.query(`INSERT INTO ${quote(table)} (${names}) VALUES ${groups.join(',')}`, values);
        batch = []; batchBytes = 0;
      }
      for (const row of source) {
        if (table === 'email_codes') sourceEmailRows.push(createHash('sha256').update(JSON.stringify(normalize(row, columns, table, false))).digest('hex'));
        else updateHash(sourceHash, row, columns, table);
        const values = columns.map(({ name }) => table === 'challenges' && name === 'typed' && typeof row[name] === 'string'
          ? Buffer.from(row[name] as string, 'utf8')
          : table === 'workspace_legacy_record_aliases' && name === 'source_id' && row[name] === '\0local-conflict' ? ''
            : (table === 'users' || table === 'email_codes') && name === 'email' && typeof row[name] === 'string'
            ? encodeEmail(row[name] as string) : typeof row[name] === 'bigint' ? String(row[name]) : row[name]);
        const bytes = Buffer.byteLength(JSON.stringify(values));
        if (batch.length && (batch.length >= 100 || batchBytes + bytes > 1024 * 1024)) await flush();
        batch.push(values); batchBytes += bytes; count++;
      }
      await flush();
      const expected = table === 'email_codes' ? createHash('sha256').update(sourceEmailRows.sort().join('')).digest('hex') : sourceHash.digest('hex');
      const actual = createHash('sha256');
      const targetEmailRows: string[] = [];
      let received = 0;
      for (;;) {
        const page = await client.query<Row>(`SELECT ${names} FROM ${quote(table)} ORDER BY ${pgOrder} LIMIT 100 OFFSET $1`, [received]);
        for (const row of page.rows) {
          if (table === 'email_codes') targetEmailRows.push(createHash('sha256').update(JSON.stringify(normalize(row, columns, table, true))).digest('hex'));
          else updateHash(actual, row, columns, table, true);
        }
        received += page.rows.length;
        if (page.rows.length < 100) break;
      }
      const targetHash = table === 'email_codes' ? createHash('sha256').update(targetEmailRows.sort().join('')).digest('hex') : actual.digest('hex');
      if (received !== count || targetHash !== expected) throw new Error(`Imported data did not verify for ${table}`);
      counts[table] = count;
    }
    const inconsistent = await client.query(`SELECT 1 FROM workspace_items i WHERE i.value IS NOT NULL AND (
      (i.kind='record' AND EXISTS (SELECT 1 FROM workspace_deleted_records r WHERE r.user_id=i.user_id AND r.record_id=i.item_id)) OR
      (i.kind='draft' AND EXISTS (SELECT 1 FROM workspace_deleted_drafts d WHERE d.user_id=i.user_id AND d.draft_id=i.item_id))) LIMIT 1`);
    if (inconsistent.rowCount) throw new Error('SQLite source contains an active retired workspace item');
    await client.query('UPDATE users SET display_name=username WHERE display_name IS NULL');
    await client.query('UPDATE sessions SET id=gen_random_uuid()::text WHERE id IS NULL');
    for (const [table, column] of [['admin_audit', 'id'], ['feedback_messages', 'sequence']] as const) {
      const sequence = sqlite.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(table) as { seq: bigint } | undefined;
      const lastId = sequence?.seq ?? 0n;
      await client.query('SELECT setval(pg_get_serial_sequence($1,$2), $3::bigint, $4::boolean)', [table, column, String(lastId > 0n ? lastId : 1n), lastId > 0n]);
    }
    await client.query('COMMIT');
    transactionStarted = false;
    return { counts };
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    throw error;
  } finally {
    sqlite.exec('ROLLBACK');
    sqlite.close();
  }
}
