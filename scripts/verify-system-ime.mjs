import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const keyScript = fileURLToPath(new URL('./verify-system-ime-x11.py', import.meta.url));
const key = (...args) => execFileSync('python3', [keyScript, ...args], { encoding: 'utf8' });
const browser = await chromium.launch({ executablePath: process.env.TYPING_IME_BROWSER || '/usr/bin/google-chrome', headless: false, args: ['--no-sandbox', '--ozone-platform=x11', '--password-store=basic'] });
try {
  const page = await browser.newPage({ locale: 'zh-CN' });
  await page.goto(process.env.TYPING_IME_URL);
  await page.getByRole('button', { name: '自定义文字' }).click();
  await page.getByRole('textbox', { name: '自定义文章内容' }).fill('你好\n世界再见');
  await page.getByRole('button', { name: '使用这段文字' }).click();
  await page.evaluate(() => {
    window.__typingImeEvents = [];
    for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'beforeinput', 'input']) document.addEventListener(type, (event) => {
      window.__typingImeEvents.push({ type: event.type, trusted: event.isTrusted, composing: event.isComposing ?? null, data: event.data ?? null });
    }, true);
  });
  const input = page.getByRole('textbox', { name: '当前行输入' });
  await input.click();
  await page.evaluate(() => { document.title = 'TypeLune IME verification'; });
  let windowId;
  for (let attempt = 0; attempt < 20 && !windowId; attempt++) {
    const windows = execFileSync('xwininfo', ['-root', '-tree'], { encoding: 'utf8' });
    windowId = windows.match(/(0x[0-9a-f]+) "TypeLune IME verification[^"]*"/i)?.[1];
    if (!windowId) await page.waitForTimeout(100);
  }
  if (!windowId) throw new Error('Cannot find the browser window on the isolated X display');
  key('focus', windowId);
  await input.focus();
  execFileSync('fcitx5-remote', ['-s', 'pinyin']);
  await page.waitForTimeout(300);
  const engine = execFileSync('fcitx5-remote', ['-n'], { encoding: 'utf8' }).trim();
  assert.equal(engine, 'pinyin');
  key('n', 'i', 'h', 'a', 'o');
  await page.waitForTimeout(5300);
  const composing = await page.evaluate(() => ({ events: window.__typingImeEvents, typed: document.querySelector('[data-testid="typed-count"]').textContent, timer: document.querySelector('[data-testid="remaining-time"]').textContent }));
  assert.equal(composing.typed, '0');
  assert.notEqual(composing.timer, '05:00');
  assert.ok(composing.events.some((event) => event.type === 'compositionstart' && event.trusted));
  const draft = await page.evaluate(() => { const id = sessionStorage.getItem('cloudtyping.current-practice.v2'); return JSON.parse(localStorage.getItem('cloudtyping.practice.v2.' + id) || 'null'); });
  assert.ok(draft.processTrace.samples.some((sample) => sample.time >= 5000 && sample.progress === 0 && sample.correct === 0));
  key('combo', 'Alt_L', 'p');
  await page.waitForTimeout(200);
  assert.equal(await page.getByRole('button', { name: '暂停练习' }).count(), 1);
  if (process.env.TYPING_IME_SCREENSHOT) await page.screenshot({ path: process.env.TYPING_IME_SCREENSHOT });
  key('space');
  await page.waitForTimeout(400);
  assert.equal(await input.inputValue(), '你好');
  assert.equal(await page.getByTestId('typed-count').textContent(), '2');
  key('Return');
  await page.waitForTimeout(300);
  assert.equal(await page.getByTestId('typed-count').textContent(), '3');
  key('s', 'h', 'i', 'j', 'i', 'e', 'space');
  await page.waitForTimeout(400);
  assert.equal(await page.getByTestId('typed-count').textContent(), '5');
  key('BackSpace', 'BackSpace', 'BackSpace');
  await page.waitForTimeout(400);
  assert.equal(await page.getByTestId('typed-count').textContent(), '2');
  await page.getByRole('button', { name: '暂停练习' }).click();
  await page.reload();
  await page.getByRole('button', { name: '继续练习' }).waitFor({ state: 'visible' });
  assert.equal(await page.getByTestId('typed-count').textContent(), '2');
  await page.getByRole('button', { name: '继续练习' }).click();
  await input.and(page.locator(':enabled')).waitFor({ state: 'visible' });
  key('focus', windowId);
  await page.getByRole('textbox', { name: '当前行输入' }).focus();
  execFileSync('fcitx5-remote', ['-s', 'pinyin']);
  key('Return');
  await page.getByRole('button', { name: '暂停练习' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  assert.equal(await page.getByTestId('typed-count').textContent(), '3');
  key('s', 'h', 'i', 'j', 'i', 'e', 'space');
  await page.waitForTimeout(400);
  assert.equal(await page.getByTestId('typed-count').textContent(), '5');
  console.log(`Fcitx5 ${engine}: trusted composition, first-input timing, sampling, shortcut protection, cross-line backspace and pause/reload/resume passed.`);
} finally { await browser.close(); }
