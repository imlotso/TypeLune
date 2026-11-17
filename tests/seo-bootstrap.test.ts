// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { defaultSeoSettings } from '../src/lib/seo-settings';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); document.head.innerHTML = ''; });

it('refreshes a server-rendered article description when its UI locale changes and clears article schema on private navigation', async () => {
  const { logo: _logo, favicon: _favicon, socialImage: _social, excludedArticleIds: _excluded, robotsDisallow: _robots, ...value } = defaultSeoSettings('https://typing.example');
  const settings = { ...value, logoUrl: null, faviconUrl: null, socialImageUrl: null };
  const script = document.createElement('script'); script.id = 'typelune-seo-bootstrap'; script.type = 'application/json';
  script.textContent = JSON.stringify({ settings, path: '/articles/zh-beginner-1', language: 'zh-CN', preview: false, title: '背影 · TypeLune', description: '中文文章说明', indexable: true, contentLanguage: 'zh-CN' });
  document.head.append(script);
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ title: '背影 · TypeLune', description: 'English article description', indexable: true, contentLanguage: 'zh-CN' })));
  vi.stubGlobal('fetch', fetcher);
  const { updatePageMetadata } = await import('../src/lib/seo');
  updatePageMetadata('/articles/zh-beginner-1', 'zh');
  expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('中文文章说明');
  updatePageMetadata('/articles/zh-beginner-1', 'en');
  await vi.waitFor(() => expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('English article description'));
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('tl=en'), expect.any(Object));
  expect(JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!)).toMatchObject({ '@type': 'Article', inLanguage: 'zh-CN' });
  updatePageMetadata('/account', 'en');
  expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
  updatePageMetadata('/rankings', 'en');
  expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('website');
  expect(JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!)).toMatchObject({ '@type': 'WebPage', url: 'https://typing.example/rankings?tl=en' });
});

it('does not let an older public-settings request overwrite a forced refresh after an administrator saves', async () => {
  const { logo: _logo, favicon: _favicon, socialImage: _social, excludedArticleIds: _excluded, robotsDisallow: _robots, ...value } = defaultSeoSettings('https://typing.example');
  const base = { ...value, logoUrl: null, faviconUrl: null, socialImageUrl: null };
  let finishOld!: (value: Response) => void, finishNew!: (value: Response) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finishOld = resolve; }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finishNew = resolve; }));
  vi.stubGlobal('fetch', fetcher);
  const { loadSiteSeo, siteSeoSettings } = await import('../src/lib/seo');
  const old = loadSiteSeo();
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  const updated = loadSiteSeo(true);
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  finishNew(new Response(JSON.stringify({ ...base, siteName: 'Current name' })));
  await updated;
  finishOld(new Response(JSON.stringify({ ...base, siteName: 'Stale name' })));
  await old;
  expect(siteSeoSettings().siteName).toBe('Current name');
});
