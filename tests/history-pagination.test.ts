import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { createApp } from '../server/app';

it('paginates all owned history using a stable cursor even when records share a timestamp', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'typing-history-pages-'));
  const databasePath = join(directory, 'test.sqlite');
  let code = '';
  const app = await createApp({ databasePath, secureCookies: false, mailer: { async sendCode(_email, value) { code = value; } } });
  try {
    await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'reader@example.test', purpose: 'register' } });
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'reader', email: 'reader@example.test', password: 'a-long-password', code } });
    const userId = registration.json().user.id as string;
    const headers = { cookie: `session=${registration.cookies.find((item) => item.name === 'session')!.value}` };
    const database = new Database(databasePath);
    const insert = database.prepare(`INSERT INTO challenges(id,owner,language,difficulty,duration,target,started_at,finished_at,status,correct,total,accuracy,speed)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (let index = 0; index < 205; index++) insert.run(`record-${String(index).padStart(3, '0')}`, `u:${userId}`, 'zh', 'beginner', 300, '甲', 1000, 2000, 'finished', 1, 1, 100, 1);
    insert.run('other-account-record', 'u:another-user', 'zh', 'beginner', 300, '甲', 1000, 2000, 'finished', 1, 1, 100, 1);
    database.close();
    const seen = new Set<string>(); let cursor: string | undefined;
    do {
      const query = new URLSearchParams({ limit: '50', ...(cursor && { cursor }) });
      const response = await app.inject({ method: 'GET', url: `/api/history?${query}`, headers });
      expect(response.statusCode).toBe(200);
      for (const entry of response.json().entries) { expect(seen.has(entry.recordId)).toBe(false); seen.add(entry.recordId); }
      cursor = response.json().nextCursor ?? undefined;
    } while (cursor);
    expect(seen.size).toBe(205);
    expect(seen.has('other-account-record')).toBe(false);
    expect((await app.inject({ method: 'GET', url: '/api/history?limit=50&cursor=invalid', headers })).statusCode).toBe(400);
  } finally { await app.close(); rmSync(directory, { recursive: true, force: true }); }
});
