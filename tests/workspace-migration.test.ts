import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { createWorkspaceStore } from '../server/workspace';

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
