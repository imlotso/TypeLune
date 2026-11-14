import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';

const suffix = randomUUID();
const container = `dazi-ci-${suffix}`;
const restoredContainer = `dazi-ci-restore-${suffix}`;
const volume = `dazi-ci-data-${suffix}`;
const restoredVolume = `dazi-ci-restored-data-${suffix}`;
const image = process.env.DAZI_TEST_IMAGE || 'dazi-ci:local';
const directory = mkdtempSync(join(tmpdir(), 'dazi-docker-ci-'));
const containers = new Set();
const volumes = new Set();

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function createVolume(name) { docker('volume', 'create', name); volumes.add(name); }
function startContainer(name, dataVolume) {
  docker('run', '-d', '--name', name, '-p', '127.0.0.1::3001', '-v', `${dataVolume}:/app/data`, '-e', 'CODE_SECRET=ci-only-secret-not-used-outside-tests', image);
  containers.add(name);
  return `http://${docker('port', name, '3001/tcp').split('\n')[0]}`;
}
function removeContainer(name) {
  if (!containers.has(name)) return;
  try { docker('stop', '-t', '2', name); } catch { /* It may already be stopped. */ }
  docker('rm', name);
  containers.delete(name);
}
async function ready(baseURL) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).ok === true) return;
      lastError = new Error(`Health check returned HTTP ${response.status}`);
    } catch (error) { lastError = error; }
    await delay(300);
  }
  throw new Error(`Production container did not become healthy: ${lastError}`);
}
async function post(baseURL, path, body, cookie, extraHeaders = {}) {
  return fetch(`${baseURL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseURL, ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
}
async function get(baseURL, path, cookie, extraHeaders = {}) {
  return fetch(`${baseURL}${path}`, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders }, signal: AbortSignal.timeout(5000) });
}

try {
  createVolume(volume);
  let baseURL = startContainer(container, volume);
  await ready(baseURL);

  const home = await get(baseURL, '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /云打字练习/);

  const invalid = await post(baseURL, '/api/tests/start', { articleId: 'zh-beginner-1', duration: 30 });
  assert.equal(invalid.status, 400, 'Out-of-range test duration must be rejected');
  const start = await post(baseURL, '/api/tests/start', { articleId: 'zh-beginner-1', duration: 300 });
  assert.equal(start.status, 200);
  const cookie = start.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'The guest needs an ownership cookie');
  const challenge = await start.json();
  assert.equal(challenge.duration, 300);
  assert.ok(typeof challenge.id === 'string' && challenge.target.length >= 120);
  assert.equal((await get(baseURL, `/api/tests/${challenge.id}`)).status, 404, 'Another visitor must not read the challenge');

  const pause = await post(baseURL, `/api/tests/${challenge.id}/pause`, {}, cookie);
  assert.equal(pause.status, 200);
  const paused = await pause.json();
  assert.ok(paused.remainingMs > 0);

  // A disposable administrator is created only in this test volume. The
  // feedback image is stored in SQLite and must survive both restore paths.
  execFileSync('docker', ['exec', '-i', '-e', 'ADMIN_USERNAME=ci_feedback_admin', '-e', 'ADMIN_EMAIL=ci-feedback@example.test',
    container, 'node', 'scripts/bootstrap-admin.mjs'], { input: 'test-password-123\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const login = await post(baseURL, '/api/auth/login', { identifier: 'ci_feedback_admin', password: 'test-password-123' });
  assert.equal(login.status, 200);
  const accountCookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(accountCookie);
  const accountId = (await login.json()).user.id;
  const workspaceHeaders = { 'X-Workspace-Owner': accountId, 'X-Workspace-Protocol': '2' };
  const initialWorkspace = await get(baseURL, '/api/workspace', accountCookie, workspaceHeaders);
  assert.equal(initialWorkspace.status, 200);
  const generation = (await initialWorkspace.json()).generation;
  const settings = { minutes: 5, mode: 'timed', strict: false, autoPause: true, fontSize: 18, lineHeight: 1.6, visibleLines: 4, theme: 'light', statisticsTimezone: 'Asia/Tokyo', dailyGoalMinutes: 25 };
  const syncedSettings = await post(baseURL, '/api/workspace/sync', { generation, items: [{ kind: 'settings', id: 'preferences', updatedAt: Date.now(), baseRevision: 0, value: settings }] }, accountCookie, workspaceHeaders);
  assert.equal(syncedSettings.status, 200);
  assert.deepEqual((await syncedSettings.json()).items.find((item) => item.kind === 'settings').value, settings);
  const legacy = { ownerId: accountId, language: 'zh', difficulty: 'beginner', duration: 300, speed: 12, accuracy: 100, finishedAt: Date.now() };
  const alias = execFileSync('node', ['--import', 'tsx', '--input-type=module', '-e', "import { stableRecordId } from './src/lib/records.ts'; process.stdout.write(stableRecordId(JSON.parse(process.argv[1])));", JSON.stringify(legacy)], { encoding: 'utf8' });
  const legacySync = await post(baseURL, '/api/workspace/sync', { generation, items: [{ kind: 'record', id: 'docker-legacy', updatedAt: Date.now(), baseRevision: 0, value: legacy }] }, accountCookie, workspaceHeaders);
  assert.equal(legacySync.status, 200);
  const legacyDelete = await post(baseURL, '/api/history/delete', { ids: ['docker-legacy', alias], legacyPairs: [{ id: 'docker-legacy', alias }] }, accountCookie, workspaceHeaders);
  assert.equal(legacyDelete.status, 200);
  const legacyUsage = await get(baseURL, '/api/workspace/usage', accountCookie, workspaceHeaders);
  assert.equal((await legacyUsage.json()).aliasTombstones, 1);
  const screenshot = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#aabbcc' } }).png().toBuffer();
  const feedback = await post(baseURL, '/api/feedback', { category: 'issue', title: '持久化测试', description: '测试附件',
    attachments: [{ name: 'test.png', data: `data:image/png;base64,${screenshot.toString('base64')}` }] }, accountCookie);
  assert.equal(feedback.status, 201);
  const attachmentUrl = (await feedback.json()).feedback.attachments[0].url;
  const attachment = await get(baseURL, attachmentUrl, accountCookie);
  assert.equal(attachment.status, 200);
  assert.match(attachment.headers.get('content-type') ?? '', /^image\/webp/);
  const attachmentBytes = Buffer.from(await attachment.arrayBuffer());
  docker('exec', container, 'node', 'scripts/backup.mjs', '/app/data/ci-backup.sqlite');
  docker('cp', `${container}:/app/data/ci-backup.sqlite`, join(directory, 'backup.sqlite'));

  removeContainer(container);
  baseURL = startContainer(container, volume);
  await ready(baseURL);
  const persisted = await get(baseURL, `/api/tests/${challenge.id}`, cookie);
  assert.equal(persisted.status, 200);
  assert.deepEqual(await persisted.json(), { status: 'paused', elapsedMs: paused.elapsedMs, remainingMs: paused.remainingMs, duration: 300 }, 'The named volume must survive container replacement');
  assert.equal((await post(baseURL, `/api/tests/${challenge.id}/resume`, {}, cookie)).status, 200);
  const persistedAttachment = await get(baseURL, attachmentUrl, accountCookie);
  assert.equal(persistedAttachment.status, 200);
  assert.deepEqual(Buffer.from(await persistedAttachment.arrayBuffer()), attachmentBytes, 'Feedback attachment must survive container replacement');
  const persistedWorkspace = await get(baseURL, '/api/workspace', accountCookie, workspaceHeaders);
  assert.deepEqual((await persistedWorkspace.json()).items.find((item) => item.kind === 'settings').value, settings, 'Statistics settings must survive container replacement');
  assert.equal((await (await get(baseURL, '/api/workspace/usage', accountCookie, workspaceHeaders)).json()).aliasTombstones, 1, 'Legacy deletion markers must survive container replacement');

  createVolume(restoredVolume);
  docker('run', '--rm', '--user', '0', '--entrypoint', 'sh', '-v', `${restoredVolume}:/app/data`, '-v', `${directory}:/backup:ro`, image, '-c', 'cp /backup/backup.sqlite /app/data/dazi.sqlite && chown node:node /app/data/dazi.sqlite');
  const backupURL = startContainer(restoredContainer, restoredVolume);
  await ready(backupURL);
  const restored = await get(backupURL, `/api/tests/${challenge.id}`, cookie);
  assert.equal(restored.status, 200);
  assert.deepEqual(await restored.json(), { status: 'paused', elapsedMs: paused.elapsedMs, remainingMs: paused.remainingMs, duration: 300 }, 'A fresh service must read the SQLite backup');
  const restoredAttachment = await get(backupURL, attachmentUrl, accountCookie);
  assert.equal(restoredAttachment.status, 200);
  assert.deepEqual(Buffer.from(await restoredAttachment.arrayBuffer()), attachmentBytes, 'Feedback attachment must be included in the SQLite backup');
  const restoredWorkspace = await get(backupURL, '/api/workspace', accountCookie, workspaceHeaders);
  assert.deepEqual((await restoredWorkspace.json()).items.find((item) => item.kind === 'settings').value, settings, 'Statistics settings must be included in the SQLite backup');
  assert.equal((await (await get(backupURL, '/api/workspace/usage', accountCookie, workspaceHeaders)).json()).aliasTombstones, 1, 'Legacy deletion markers must be included in the SQLite backup');
  console.log('Production image: homepage, API, ownership, pause/resume, feedback attachments, statistics settings, legacy deletion markers, volume replacement and backup restore passed.');
} catch (error) {
  for (const name of containers) {
    const logs = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
    console.error(`Container ${name} logs:\n${logs.stdout || ''}${logs.stderr || ''}`);
  }
  throw error;
} finally {
  for (const name of [...containers]) { try { removeContainer(name); } catch { /* Preserve the original test error. */ } }
  for (const name of volumes) { try { docker('volume', 'rm', name); } catch { /* Preserve the original test error. */ } }
  rmSync(directory, { recursive: true, force: true });
}
