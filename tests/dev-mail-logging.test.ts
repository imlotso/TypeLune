import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('does not print verification codes or claim delivery in the old console-mail mode', async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'typing-dev-mail-'));
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '0',
    DATABASE_PATH: join(temporary, 'test.sqlite'), CODE_SECRET: 'test-only-code-secret', MAIL_DEV_MODE: 'console', SMTP_HOST: '', SMTP_FROM: '', ADMIN_EMAIL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  try {
    let address: string | undefined;
    for (let attempt = 0; attempt < 100 && !address; attempt++) {
      address = output.match(/Typing service listening at (http:\/\/127\.0\.0\.1:\d+)/u)?.[1];
      if (!address) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(!!address).toBe(true);
    const response = await fetch(`${address}/api/auth/code`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: address! }, body: JSON.stringify({ email: 'no-log@example.test', purpose: 'register' }) });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain('邮件服务尚未配置');
    expect(/\b\d{6}\b/u.test(output)).toBe(false);
  } finally {
    child.kill('SIGTERM');
    await new Promise<void>((resolve) => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once('exit', () => resolve()); });
    rmSync(temporary, { recursive: true, force: true });
  }
}, 15_000);
