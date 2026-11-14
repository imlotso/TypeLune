import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { createApp } from '../server/app';

it('migrates an old account once and preserves its public nickname after rename and restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'typing-account-migration-'));
  const databasePath = join(directory, 'old.sqlite');
  const old = new Database(databasePath);
  old.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL)`);
  old.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run('legacy-id', 'legacy_user', 'legacy@example.test', await argon2.hash('old-password-123', { type: argon2.argon2id }), Date.now());
  old.close();
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    app = await createApp({ databasePath, secureCookies: false });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { identifier: 'legacy_user', password: 'old-password-123' } });
    expect(login.json().user).toMatchObject({ id: 'legacy-id', displayName: 'legacy_user', avatar: null });
    const cookie = `session=${login.cookies.find((item) => item.name === 'session')!.value}`;
    const changed = await app.inject({ method: 'POST', url: '/api/account/username', headers: { cookie }, payload: { username: 'renamed_user', currentPassword: 'old-password-123' } });
    expect(changed.json().user).toMatchObject({ username: 'renamed_user', displayName: 'legacy_user' });
    await app.close(); app = await createApp({ databasePath, secureCookies: false });
    const restored = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { identifier: 'legacy@example.test', password: 'old-password-123' } });
    expect(restored.json().user).toMatchObject({ id: 'legacy-id', username: 'renamed_user', displayName: 'legacy_user', avatar: null });
  } finally { await app?.close(); rmSync(directory, { recursive: true, force: true }); }
});
