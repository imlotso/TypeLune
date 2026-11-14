import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { createWorkspaceStore } from '../server/workspace';
import { stableRecordId } from '../src/lib/records';

it('migrates an existing workspace repeatedly without losing data or resetting a generation', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY);
    INSERT INTO users VALUES ('reader');
    CREATE TABLE workspace_items (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, item_id TEXT NOT NULL, updated_at INTEGER NOT NULL, value TEXT, PRIMARY KEY(user_id,kind,item_id));
    INSERT INTO workspace_items VALUES ('reader','favorite','a',1,'{"articleId":"a"}');
    INSERT INTO workspace_items VALUES ('reader','favorite','b',2,NULL);`);
  try {
    const first = createWorkspaceStore(db);
    expect(first.snapshot('reader')).toMatchObject({ generation: 1, items: [
      { id: 'a', serverRevision: 1, value: { articleId: 'a' } }, { id: 'b', serverRevision: 1, deleted: true },
    ] });
    expect(first.compact('reader', 1)).toEqual({ generation: 2, removed: 1 });
    const second = createWorkspaceStore(db);
    expect(second.snapshot('reader')).toMatchObject({ generation: 2, items: [{ id: 'a', serverRevision: 1, value: { articleId: 'a' } }] });
  } finally { db.close(); }
});

it('preserves verified legacy alias markers through repeated initialization and compaction', () => {
  const db = new Database(':memory:'); db.pragma('foreign_keys = ON');
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('reader')");
  try {
    const first = createWorkspaceStore(db);
    const legacy = { ownerId: 'reader', language: 'zh' as const, difficulty: 'beginner' as const, duration: 300, speed: 12, accuracy: 100, finishedAt: 1 };
    const alias = stableRecordId(legacy);
    db.prepare("INSERT INTO workspace_items(user_id,kind,item_id,updated_at,value) VALUES ('reader','record','old',1,?)").run(JSON.stringify(legacy));
    db.transaction(() => first.deleteRecords('reader', ['old', alias], 2, [{ id: 'old', alias }])).immediate();
    expect(first.usage('reader')).toMatchObject({ count: 1, tombstones: 1, aliasTombstones: 1 });
    const second = createWorkspaceStore(db);
    expect(second.usage('reader')).toMatchObject({ count: 1, tombstones: 1, aliasTombstones: 1 });
    expect(second.compact('reader', 1)).toEqual({ generation: 2, removed: 2 });
    expect(second.usage('reader')).toMatchObject({ count: 0, tombstones: 0, aliasTombstones: 0 });
    expect((db.prepare('SELECT COUNT(*) AS count FROM workspace_legacy_record_aliases').get() as { count: number }).count).toBe(1);
    db.prepare("DELETE FROM users WHERE id='reader'").run();
    expect((db.prepare('SELECT COUNT(*) AS count FROM workspace_legacy_record_aliases').get() as { count: number }).count).toBe(0);
  } finally { db.close(); }
});
