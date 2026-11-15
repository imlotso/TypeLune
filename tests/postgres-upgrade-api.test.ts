import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { createApp } from '../server/app';
import { migratePostgres } from '../server/postgres/migrate';
import { PostgresDatabase } from '../server/postgres/database';
import { AsyncPostgres } from '../server/database/postgres';
import { seedPostgresCatalog } from '../server/postgres/seed';

const url = process.env.DAZI_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('upgrade APIs on isolated PostgreSQL instances', () => {
  let setup: pg.Client; let db: PostgresDatabase; let schema: string;
  let apps: Awaited<ReturnType<typeof createApp>>[] = []; let admin: Record<string, string>;
  const codes = new Map<string, string>(); const password = 'original-password-123'; let clientNumber = 0;
  const post = (instance: number, path: string, payload: Record<string, unknown>, headers?: Record<string, string>) => apps[instance].inject({ method: 'POST', url: path, payload, headers });
  async function register(username: string) {
    const email = `${username}@example.test`;
    const forwarded = { 'x-forwarded-for': `10.0.0.${++clientNumber}` };
    expect((await post(0, '/api/auth/code', { email, purpose: 'register' }, forwarded)).statusCode).toBe(200);
    const response = await post(0, '/api/auth/register', { username, email, password, code: codes.get(`${email}:register`) }, forwarded);
    expect(response.statusCode).toBe(200);
    const user = response.json().user as { id: string };
    return { ...forwarded, cookie: `session=${response.cookies.find((cookie) => cookie.name === 'session')!.value}`, 'x-workspace-owner': user.id,
      'x-workspace-protocol': '2', 'x-workspace-capabilities': 'local-conflict-v1' };
  }
  async function revokeWhileWaiting<T>(owner: string, operation: () => PromiseLike<T>) {
    const lock = await db.pool.connect();
    try {
      await lock.query('BEGIN'); await lock.query(`SET LOCAL search_path TO "${schema}",pg_catalog`);
      await lock.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', ['dazi.application.writer', schema]);
      const pending = Promise.resolve(operation()); let waiting = false;
      for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
        const state = await setup.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'");
        waiting = state.rows[0].count > 0;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      await lock.query('DELETE FROM sessions WHERE user_id=$1', [owner]); await lock.query('COMMIT');
      return await pending;
    } finally { try { await lock.query('ROLLBACK'); } catch { /* already committed */ } lock.release(); }
  }
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) throw new Error('This test requires disposable loopback PostgreSQL');
    setup = new pg.Client({ connectionString: url }); await setup.connect();
    schema = 'dazi_upgrade_api_' + randomBytes(8).toString('hex');
    await setup.query(`CREATE SCHEMA "${schema}"`); await setup.query(`SET search_path TO "${schema}"`);
    await migratePostgres(setup, { database: parsed.pathname.slice(1), schema });
    db = new PostgresDatabase(url!, schema); await seedPostgresCatalog(new AsyncPostgres(db));
    apps = await Promise.all([0, 1].map(() => createApp({ databaseUrl: url, postgresSchema: schema, codeSecret: 'x'.repeat(32), secureCookies: false, trustProxy: true,
      adminEmail: 'admin@example.test', mailer: { async sendCode(email, code, purpose) { codes.set(`${email}:${purpose}`, code); } } })));
    admin = await register('admin');
  });
  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close())); await db?.close();
    if (setup) { await setup.query('SET search_path TO public'); if (schema) await setup.query(`DROP SCHEMA "${schema}" CASCADE`); await setup.end(); }
  });
  it('updates profile, username and verified email without rebuilding the account', async () => {
    const alice = await register('reader');
    expect((await post(0, '/api/account/profile', { displayName: '云朵', avatar: 'cloud' }, alice)).json().user).toMatchObject({ id: alice['x-workspace-owner'], displayName: '云朵' });
    expect((await post(1, '/api/account/username', { username: 'renamed', currentPassword: password }, alice)).statusCode).toBe(200);
    expect((await post(0, '/api/account/email/code', { email: 'new@example.test', currentPassword: password }, alice)).statusCode).toBe(200);
    const confirmed = await post(1, '/api/account/email/confirm', { email: 'new@example.test', code: codes.get('new@example.test:change-email') }, alice);
    expect(confirmed.statusCode).toBe(200);
    expect((await apps[0].inject({ url: '/api/me', headers: alice })).json().user).toBeNull();
    expect((await post(0, '/api/auth/login', { identifier: 'reader@example.test', password })).statusCode).toBe(401);
    const login = await post(1, '/api/auth/login', { identifier: 'new@example.test', password });
    expect(login.statusCode).toBe(200); expect(login.json().user).toMatchObject({ id: alice['x-workspace-owner'], username: 'renamed', displayName: '云朵' });
  });
  it('protects feedback attachments and internal notes across instances', async () => {
    const alice = await register('feedbacker'); const bob = await register('other');
    const bytes = await sharp({ create: { width: 12, height: 10, channels: 3, background: '#abc' } }).png().toBuffer();
    const created = await post(0, '/api/feedback', { requestId: randomUUID(), category: 'issue', title: '截图', description: '问题', attachments: [{ name: 'test.png', data: `data:image/png;base64,${bytes.toString('base64')}` }] }, alice);
    expect(created.statusCode).toBe(201);
    const { id, attachments } = created.json().feedback as { id: string; attachments: Array<{ url: string }> };
    expect((await apps[1].inject({ url: attachments[0].url, headers: bob })).statusCode).toBe(404);
    expect((await apps[1].inject({ url: attachments[0].url, headers: alice })).headers['content-type']).toMatch(/^image\/webp/);
    const update = { revision: 1, status: 'resolved', reply: '已处理', note: '内部备注' };
    const results = await Promise.all(apps.map((_, index) => post(index, `/api/admin/feedback/${id}/handle`, update, admin)));
    expect(results.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const visible = await apps[0].inject({ url: `/api/feedback/${id}`, headers: alice });
    expect(visible.body).toContain('已处理'); expect(visible.body).not.toContain('内部备注');
  });
  it('assembles staged image chunks across instances without exposing another account’s upload', async () => {
    const alice = await register('chunk_owner'); const bob = await register('chunk_other');
    const image = await sharp(randomBytes(800 * 600 * 3), { raw: { width: 800, height: 600, channels: 3 } }).png().toBuffer();
    const requestId = randomUUID(); const digest = createHash('sha256').update(image).digest('hex'); const size = 768 * 1024;
    const chunkCount = Math.ceil(image.length / size);
    const reference = { staged: true, fileIndex: 0, name: 'large.png', mime: 'image/png', totalBytes: image.length, digest, chunkCount };
    const chunks = Array.from({ length: chunkCount }, (_, chunkIndex) => ({ requestId, fileIndex: 0, chunkIndex, chunkCount,
      name: reference.name, mime: reference.mime, totalBytes: image.length, digest, data: image.subarray(chunkIndex * size, (chunkIndex + 1) * size).toString('base64') }));
    const first = await Promise.all(apps.map((_, index) => post(index, '/api/feedback/uploads', chunks[0], alice)));
    expect(first.map((response) => response.statusCode)).toEqual([200, 200]);
    for (const chunk of chunks.slice(1)) expect((await post(1, '/api/feedback/uploads', chunk, alice)).statusCode).toBe(200);
    const payload = { requestId, category: 'issue', title: '大图', description: '截图', attachments: [reference] };
    expect((await post(0, '/api/feedback', payload, bob)).statusCode).toBe(400);
    const created = await post(1, '/api/feedback', payload, alice);
    expect(created.statusCode, created.body).toBe(201);
    expect((await apps[0].inject({ url: created.json().feedback.attachments[0].url, headers: alice })).statusCode).toBe(200);
    expect((await setup.query('SELECT COUNT(*)::int AS count FROM feedback_upload_chunks WHERE user_id=$1', [alice['x-workspace-owner']])).rows[0].count).toBe(0);
  });
  it('rejects stale workspace writes after cross-device deletion and compaction', async () => {
    const alice = await register('syncer');
    const item = { kind: 'record', id: 'record-1', updatedAt: Date.now(), baseRevision: 0, value: { recordId: 'record-1', language: 'zh', difficulty: 'beginner', duration: 60, speed: 10, accuracy: 100, finishedAt: Date.now() } };
    expect((await post(0, '/api/workspace/sync', { generation: 1, items: [item] }, alice)).statusCode).toBe(200);
    expect((await post(1, '/api/history/delete', { ids: ['record-1'] }, alice)).statusCode).toBe(200);
    expect((await post(0, '/api/workspace/sync', { generation: 1, items: [{ ...item, baseRevision: 1 }] }, alice)).statusCode).toBe(409);
    expect((await post(1, '/api/workspace/compact', { generation: 1 }, alice)).json()).toMatchObject({ generation: 2, removed: 1 });
    expect((await post(0, '/api/workspace/sync', { generation: 2, items: [item] }, alice)).statusCode).toBe(409);
  });
  it('retains an alternate legacy deletion marker and blocks an older client after compaction', async () => {
    const alice = await register('alternate_marker'); const base = `legacy-conflict-${'a'.repeat(64)}`; const marker = `legacy-conflict-${'b'.repeat(64)}`;
    const current = { ...alice, 'x-workspace-capabilities': 'local-conflict-v2' };
    const request = { ids: [marker], localConflicts: [marker], localConflictBases: [{ id: marker, base }], expectedRevisions: [{ id: marker, revision: 0 }] };
    const removed = await post(0, '/api/history/delete', request, current);
    expect(removed.statusCode).toBe(200);
    expect(removed.json().items).toEqual([expect.objectContaining({ id: marker, localConflict: true, localConflictBase: base })]);
    expect((await apps[1].inject({ url: '/api/workspace', headers: alice })).statusCode).toBe(426);
    expect((await apps[1].inject({ url: '/api/workspace?paged=1', headers: alice })).statusCode).toBe(426);
    expect((await apps[1].inject({ url: '/api/workspace?paged=1', headers: current })).statusCode).toBe(200);
    expect((await post(1, '/api/workspace/sync', { generation: 1, items: [] }, alice)).statusCode).toBe(426);
    expect((await post(1, '/api/workspace/compact', { generation: 1 }, current)).json()).toMatchObject({ generation: 2, removed: 1 });
    expect((await apps[0].inject({ url: '/api/workspace', headers: alice })).statusCode).toBe(426);
    expect((await post(0, '/api/workspace/sync', { generation: 2, items: [] }, alice)).statusCode).toBe(426);
  });
  it('removes staged uploads and legacy mappings on account deletion without affecting another user', async () => {
    const alice = await register('delete_v2_owner'); const other = await register('delete_v2_other');
    const marker = `legacy-conflict-${'b'.repeat(64)}`; const base = `legacy-conflict-${'a'.repeat(64)}`;
    const request = { ids: [marker], localConflicts: [marker], localConflictBases: [{ id: marker, base }], expectedRevisions: [{ id: marker, revision: 0 }] };
    const chunk = { requestId: randomUUID(), fileIndex: 0, chunkIndex: 0, chunkCount: 1, name: 'pending.png', mime: 'image/png', totalBytes: 1, digest: 'a'.repeat(64), data: 'AQ==' };
    for (const account of [alice, other]) {
      const headers = { ...account, 'x-workspace-capabilities': 'local-conflict-v2' };
      expect((await post(0, '/api/history/delete', request, headers)).statusCode).toBe(200);
      expect((await post(0, '/api/feedback/uploads', chunk, headers)).statusCode).toBe(200);
    }
    expect((await post(1, '/api/account/delete', { currentPassword: password }, alice)).statusCode).toBe(200);
    for (const table of ['workspace_legacy_record_aliases', 'workspace_local_conflict_bases', 'feedback_upload_chunks']) {
      expect((await setup.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE user_id=$1`, [alice['x-workspace-owner']])).rows[0].count).toBe(0);
      expect((await setup.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE user_id=$1`, [other['x-workspace-owner']])).rows[0].count).toBe(1);
    }
  });
  it('previews and clears only the confirmed date-filtered leaderboard on another instance', async () => {
    const owner = await register('rank_cleanup_owner');
    const from = Date.now() - 10_000; const to = from + 20_000;
    const insert = async (id: string, scoreOwner: string) => setup.query(`INSERT INTO challenges(id,owner,language,difficulty,duration,target,started_at,finished_at,status,correct,total,accuracy,speed,published,nickname)
      VALUES ($1,$2,'zh','beginner',60,'a',$3,$4,'finished',1,1,100,1,1,'visitor-test')`, [id, scoreOwner, from, from + 1000]);
    await insert('cleanup-a', 'g:cleanup-a'); await insert('cleanup-user', `u:${owner['x-workspace-owner']}`);
    const filter = { from, to, board: 'guest' };
    const preview = (await post(0, '/api/admin/scores/cleanup/preview', filter, admin)).json();
    expect(preview.count).toBe(1);
    await insert('cleanup-b', 'g:cleanup-b');
    expect((await post(1, '/api/admin/scores/cleanup', { ...filter, ...preview, reason: '测试整理' }, admin)).statusCode).toBe(409);
    const current = (await post(1, '/api/admin/scores/cleanup/preview', filter, admin)).json();
    expect(current.count).toBe(2);
    expect((await post(0, '/api/admin/scores/cleanup', { ...filter, ...current, reason: '测试整理' }, admin)).json()).toMatchObject({ ok: true, count: 2 });
    const rows = (await setup.query("SELECT id,ranking_removed FROM challenges WHERE id LIKE 'cleanup-%' ORDER BY id")).rows;
    expect(rows).toEqual([{ id: 'cleanup-a', ranking_removed: '1' }, { id: 'cleanup-b', ranking_removed: '1' }, { id: 'cleanup-user', ranking_removed: '0' }]);
  });
  it('does not modify feedback after the account session is revoked while a write waits', async () => {
    const alice = await register('feedback_race');
    const created = await post(0, '/api/feedback', { category: 'issue', title: '反馈', description: '说明', attachments: [] }, alice);
    const id = created.json().feedback.id as string;
    const result = await revokeWhileWaiting(alice['x-workspace-owner'], () => post(1, `/api/feedback/${id}/messages`, { text: '不应保存' }, alice));
    expect(result.statusCode).toBe(401);
    expect((await setup.query('SELECT COUNT(*)::int AS count FROM feedback_messages WHERE feedback_id=$1', [id])).rows[0].count).toBe(0);
  });
  it('does not delete or compact workspace data after a waiting session is revoked', async () => {
    const first = await register('delete_race');
    const item = { kind: 'record', id: 'record-race', updatedAt: Date.now(), baseRevision: 0, value: { recordId: 'record-race', language: 'zh', difficulty: 'beginner', duration: 60, speed: 10, accuracy: 100, finishedAt: Date.now() } };
    expect((await post(0, '/api/workspace/sync', { generation: 1, items: [item] }, first)).statusCode).toBe(200);
    const deleted = await revokeWhileWaiting(first['x-workspace-owner'], () => post(1, '/api/history/delete', { ids: ['record-race'] }, first));
    expect(deleted.statusCode).toBe(401);
    expect((await setup.query("SELECT value IS NOT NULL AS active FROM workspace_items WHERE user_id=$1 AND item_id='record-race'", [first['x-workspace-owner']])).rows[0].active).toBe(true);
    const second = await register('compact_race');
    expect((await post(0, '/api/workspace/sync', { generation: 1, items: [{ kind: 'favorite', id: 'old', updatedAt: Date.now(), baseRevision: 0, deleted: true }] }, second)).statusCode).toBe(200);
    const compacted = await revokeWhileWaiting(second['x-workspace-owner'], () => post(1, '/api/workspace/compact', { generation: 1 }, second));
    expect(compacted.statusCode).toBe(401);
    expect((await setup.query("SELECT COUNT(*)::int AS count FROM workspace_items WHERE user_id=$1 AND item_id='old'", [second['x-workspace-owner']])).rows[0].count).toBe(1);
  });
});
