import { spawn } from 'node:child_process';
import { once } from 'node:events';

const port = String(Number(process.env.E2E_PORT || 4178));
const env = { ...process.env, E2E_PORT: port, TYPING_IME_DISCOVER_PORT: '1' };
const server = spawn(process.execPath, ['--import', 'tsx', 'e2e/server.ts'], {
  cwd: process.cwd(), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
});
let log = '';
server.stdout.on('data', (data) => { log += data; });
server.stderr.on('data', (data) => { log += data; });
try {
  let ready = false;
  for (let count = 0; count < 120; count++) {
    if (server.exitCode !== null) throw new Error(`Disposable test server stopped:\n${log}`);
    if (log.includes(`TYPING_TEST_URL=http://127.0.0.1:${port}`)) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Disposable test server did not become ready:\n${log}`);
  const runner = spawn(process.execPath, ['node_modules/playwright/cli.js', 'test', '--config=playwright.local.config.ts', ...process.argv.slice(2)], {
    cwd: process.cwd(), env, windowsHide: true, stdio: 'inherit',
  });
  const [code] = await once(runner, 'exit');
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally {
  if (server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.send({ type: 'typing-e2e-shutdown' });
    let timer;
    const clean = await Promise.race([stopped.then(([code]) => code === 0), new Promise((resolve) => { timer = setTimeout(() => resolve(false), 10_000); })]);
    clearTimeout(timer);
    if (!clean) { if (server.exitCode === null) server.kill('SIGKILL'); process.exitCode = 1; console.error('Disposable test server did not cleanly shut down.'); }
  }
  server.stdout.destroy(); server.stderr.destroy(); server.unref();
}
