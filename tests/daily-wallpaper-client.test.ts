// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { fetchDailyWallpaper } from '../src/lib/daily-wallpaper';
import { defaultBackground } from '../src/lib/background';
import { wallpaperRequestTimeoutMs, wallpaperWorkTimeoutMs } from '../src/lib/wallpaper-policy';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG3cAAAAASUVORK5CYII=';
const background = { ...defaultBackground('light', { image, width: 1, height: 1, name: 'Wallhaven test' }), daily: { id: 'ab12cd', day: '2026-11-17', kind: 'nature' as const } };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('allows a cold wallpaper request to complete after the ordinary 12-second API timeout', async () => {
  vi.useFakeTimers();
  let aborted = false;
  vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => resolve(new Response(JSON.stringify({ background }))), 13_000);
    options.signal!.addEventListener('abort', () => { aborted = true; clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  })));
  const result = fetchDailyWallpaper('nature', 'light');
  await vi.advanceTimersByTimeAsync(13_000);
  expect(await result).toEqual(background);
  expect(aborted).toBe(false);
  expect(wallpaperRequestTimeoutMs).toBeGreaterThan(wallpaperWorkTimeoutMs);
});

it('still cancels a wallpaper request immediately when its dialog or identity is disposed', async () => {
  const controller = new AbortController();
  vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  })));
  const result = fetchDailyWallpaper('nature', 'light', controller.signal);
  const rejected = expect(result).rejects.toThrow('Aborted'); controller.abort(); await rejected;
});
