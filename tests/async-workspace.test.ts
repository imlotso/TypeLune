import { expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { AsyncSqlite } from '../server/database/sqlite';
import { createAsyncWorkspaceStore } from '../server/database/workspace';
import { createWorkspaceStore } from '../server/workspace';
import type { WorkspaceItem } from '../src/lib/models';

it('preserves the existing SQLite conflict and tombstone rules in the asynchronous workspace', async () => {
  const original = new Database(':memory:');
  const raw = new Database(':memory:');
  for (const db of [original, raw]) db.exec("CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users(id) VALUES ('u')");
  const old = createWorkspaceStore(original);
  const adapter = new AsyncSqlite(raw);
  const next = await createAsyncWorkspaceStore(adapter);
  const draft = (updatedAt: number, claimVersion: number, progressVersion: number, typed: string): WorkspaceItem => ({
    kind: 'draft', id: 'draft-1', updatedAt,
    value: { id: 'draft-1', article: { id: 'a', title: 'a', text: 'x', language: 'zh', difficulty: 'beginner', custom: true },
      typed, elapsedMs: 1, backspaces: 0, duration: 60, mode: 'timed', strict: false, offset: 0, recordId: 'r', offline: true,
      savedAt: 1, claimVersion, progressVersion },
  });
  const operations: WorkspaceItem[] = [
    { kind: 'favorite', id: 'one', updatedAt: 3, value: { articleId: 'one' } },
    { kind: 'favorite', id: 'one', updatedAt: 3, deleted: true },
    { kind: 'favorite', id: 'one', updatedAt: 4, deleted: true },
    { kind: 'favorite', id: 'one', updatedAt: 2, value: { articleId: 'one' } },
    draft(2, 2, 4, 'new'), draft(8, 1, 7, 'stale-claim'), draft(9, 2, 3, 'stale-progress'),
    { kind: 'draft', id: 'draft-1', updatedAt: 1, deleted: true }, draft(20, 4, 10, 'resurrection'),
  ];
  for (const item of operations) {
    const previous = old.get('u').find((entry) => entry.kind === item.kind && entry.id === item.id);
    const write = { ...item, baseRevision: previous?.serverRevision ?? 0 };
    let oldError: unknown; let nextError: unknown;
    try { old.merge('u', 1, [write]); } catch (error) { oldError = error; }
    try { await next.merge('u', 1, [write]); } catch (error) { nextError = error; }
    expect((nextError as Error | undefined)?.constructor).toBe((oldError as Error | undefined)?.constructor);
    expect(await next.get('u')).toEqual(old.get('u'));
  }
  original.close();
  await adapter.close();
});

it('preserves existing SQLite local-conflict markers while initializing the async store', async () => {
  const raw = new Database(':memory:');
  raw.exec("CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users(id) VALUES ('u')");
  createWorkspaceStore(raw);
  const id = `legacy-conflict-${'a'.repeat(64)}`;
  raw.prepare('INSERT INTO workspace_legacy_record_aliases(user_id,alias_id,source_id) VALUES (?,?,?)').run('u', id, '\0local-conflict');
  raw.prepare("INSERT INTO workspace_items(user_id,kind,item_id,updated_at,value) VALUES (?,'record',?,1,NULL)").run('u', id);
  const adapter = new AsyncSqlite(raw);
  try {
    const store = await createAsyncWorkspaceStore(adapter);
    expect(await store.get('u')).toEqual([expect.objectContaining({ id, deleted: true, localConflict: true })]);
    expect(raw.prepare('SELECT source_id FROM workspace_legacy_record_aliases WHERE user_id=?').get('u')).toEqual({ source_id: '\0local-conflict' });
  } finally { await adapter.close(); }
});
