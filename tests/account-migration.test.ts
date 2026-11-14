import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
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

it('keeps legacy sessions valid and assigns stable public session IDs without inventing creation times', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'typing-session-migration-'));
  const databasePath = join(directory, 'old.sqlite');
  const old = new Database(databasePath);
  old.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL)`);
  old.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run('legacy-id', 'legacy_user', 'legacy@example.test', await argon2.hash('old-password-123', { type: argon2.argon2id }), Date.now());
  const token = 'legacy-session-token';
  old.prepare('INSERT INTO sessions VALUES (?,?,?)').run(createHash('sha256').update(token).digest('hex'), 'legacy-id', Date.now() + 3600_000);
  old.close();
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    app = await createApp({ databasePath, secureCookies: false });
    const read = () => app!.inject({ method: 'GET', url: '/api/account/sessions', headers: { cookie: `session=${token}` } });
    const first = (await read()).json().sessions[0];
    expect(first).toMatchObject({ current: true, device: '未知设备', createdAt: null });
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    await app.close(); app = await createApp({ databasePath, secureCookies: false });
    expect((await read()).json().sessions[0].id).toBe(first.id);
  } finally { await app?.close(); rmSync(directory, { recursive: true, force: true }); }
});
