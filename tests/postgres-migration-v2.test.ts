import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { migratePostgres } from '../server/postgres/migrate';
import { schemaChecksum, schemaSql, schemaV2Checksum } from '../server/postgres/schema';
import { PostgresDatabase } from '../server/postgres/database';

const url = process.env.DAZI_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('PostgreSQL upgrade from the deployed schema', () => {
  let client: pg.Client; let schema: string; let database: string;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) throw new Error('This test requires disposable loopback PostgreSQL');
    database = parsed.pathname.slice(1); schema = 'dazi_upgrade_' + randomBytes(8).toString('hex');
    client = new pg.Client({ connectionString: url }); await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`); await client.query(`SET search_path TO "${schema}"`);
    await client.query('CREATE TABLE dazi_schema_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    await client.query(schemaSql);
    await client.query('INSERT INTO dazi_schema_migrations(version,checksum) VALUES (1,$1)', [schemaChecksum]);
    await client.query("INSERT INTO users(id,username,email,password_hash,created_at) VALUES ('reader','Reader','reader@example.test','test-hash',1)");
    await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ('token-hash','reader',9999999999999)");
    await client.query("INSERT INTO workspace_items(user_id,kind,item_id,updated_at,value) VALUES ('reader','favorite','fav',1,'{\"articleId\":\"fav\"}')");
    await client.query("INSERT INTO smtp_settings(id,revision,config,updated_at) VALUES (1,1,'test-ciphertext',1)");
  });
  afterAll(async () => {
    if (client) { await client.query('SET search_path TO public'); if (schema) await client.query(`DROP SCHEMA "${schema}" CASCADE`); await client.end(); }
  });
  it('preserves existing accounts, sessions, workspaces and SMTP ciphertext and is repeatable', async () => {
    const store = new PostgresDatabase(url!, schema);
    try {
      await expect(store.verifySchema()).rejects.toThrow(/schema/i);
      await migratePostgres(client, { database, schema });
      await migratePostgres(client, { database, schema });
      await expect(store.verifySchema()).resolves.toBeUndefined();
      const versions = (await client.query('SELECT version,checksum FROM dazi_schema_migrations ORDER BY version')).rows;
      expect(versions).toEqual([{ version: 1, checksum: schemaChecksum }, { version: 2, checksum: schemaV2Checksum }]);
      expect((await client.query('SELECT username,display_name,avatar FROM users WHERE id=$1', ['reader'])).rows[0]).toEqual({ username: 'Reader', display_name: 'Reader', avatar: null });
      expect((await client.query('SELECT id,user_id FROM sessions WHERE token_hash=$1', ['token-hash'])).rows[0]).toMatchObject({ id: expect.any(String), user_id: 'reader' });
      expect((await client.query('SELECT value,revision FROM workspace_items WHERE item_id=$1', ['fav'])).rows[0]).toEqual({ value: '{"articleId":"fav"}', revision: '1' });
      expect((await client.query('SELECT config FROM smtp_settings WHERE id=1')).rows[0].config).toBe('test-ciphertext');
      expect((await client.query("SELECT to_regclass('feedback') AS feedback, to_regclass('workspace_deleted_records') AS deleted_records")).rows[0]).toEqual({ feedback: 'feedback', deleted_records: 'workspace_deleted_records' });
      await client.query("UPDATE workspace_items SET updated_at=2,value='{\"articleId\":\"updated\"}' WHERE user_id='reader' AND item_id='fav'");
      expect((await client.query("SELECT revision FROM workspace_items WHERE user_id='reader' AND item_id='fav'")).rows[0].revision).toBe('2');
      await client.query("INSERT INTO workspace_deleted_records(user_id,record_id) VALUES ('reader','retired')");
      await expect(client.query("INSERT INTO workspace_items(user_id,kind,item_id,updated_at,value) VALUES ('reader','record','retired',3,'{}')")).rejects.toThrow();
      await client.query("INSERT INTO workspace_deleted_drafts(user_id,draft_id) VALUES ('reader','draft-retired')");
      await expect(client.query("INSERT INTO workspace_items(user_id,kind,item_id,updated_at,value) VALUES ('reader','draft','draft-retired',3,'{}')")).rejects.toThrow();
    } finally { await store.close(); }
  });
});
