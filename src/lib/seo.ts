import defaultLogo from '../assets/typelune-wordmark.jpg';
import { defaultSeoSettings, languageUrl, seoLanguage, seoLanguages, type PublicSeoSettings, type SeoLanguage } from './seo-settings';

type Bootstrap = { settings: PublicSeoSettings; language: SeoLanguage; path: string; preview: boolean; title: string; description: string; indexable: boolean; contentLanguage?: SeoLanguage };
function bootstrap(): Bootstrap | undefined {
  try { const text = typeof document === 'undefined' ? null : document.getElementById('typelune-seo-bootstrap')?.textContent; return text ? JSON.parse(text) as Bootstrap : undefined; } catch { return undefined; }
}
const initial = bootstrap();
function defaults(): PublicSeoSettings {
  const { logo: _logo, favicon: _favicon, socialImage: _social, excludedArticleIds: _excluded, robotsDisallow: _robots, ...value } = defaultSeoSettings(import.meta.env.VITE_SITE_URL || '');
  return { ...value, logoUrl: null, faviconUrl: null, socialImageUrl: null };
}
let current = initial?.settings ?? defaults();
let loaded = !!initial;
let pending: Promise<PublicSeoSettings> | undefined;
let requestVersion = 0;
let active: { pathname: string; locale: string } | undefined;
const listeners = new Set<() => void>();
type RouteMetadata = { title: string; description: string; indexable: boolean; contentLanguage?: SeoLanguage };
const routeMetadata = new Map<string, RouteMetadata>();
export const siteSeoSettings = () => current;
export function subscribeSiteSeo(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function loadSiteSeo(force = false): Promise<PublicSeoSettings> {
  if (loaded && !force) return Promise.resolve(current);
  if (pending && !force) return pending;
  if (force) routeMetadata.clear();
  const version = ++requestVersion;
  pending = Promise.resolve().then(() => fetch('/api/site/seo', { credentials: 'same-origin', cache: 'no-store' })).then(async response => {
    if (!response.ok) throw new Error('SEO settings unavailable');
    const value = await response.json() as PublicSeoSettings;
    if (!value || typeof value.siteName !== 'string' || !value.pages || !value.homeTitle) throw new Error('Invalid SEO settings');
    if (version !== requestVersion) return current;
    current = value; loaded = true;
    for (const listener of listeners) listener();
    if (active) applyMetadata(active.pathname, active.locale);
    return current;
  }).catch(() => current).finally(() => { if (version === requestVersion) pending = undefined; });
  return pending;
}
const setMeta = (name: string, content: string, property = false) => {
  const attribute = property ? 'property' : 'name';
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!meta) { meta = document.createElement('meta'); meta.setAttribute(attribute, name); document.head.append(meta); }
  meta.content = content;
};
function applyMetadata(pathname: string, locale: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  const language: SeoLanguage = locale === 'en' ? 'en' : 'zh-CN';
  const page = current.pages[path];
  const serverPage = routeMetadata.get(`${path}:${language}`) ?? (initial?.path === path && initial.language === language ? initial : undefined);
  const title = path === '/' ? current.homeTitle[language] : page?.title[language] ?? serverPage?.title ?? current.siteName;
  const description = path === '/' ? current.description[language] : page?.description[language] ?? serverPage?.description ?? current.description[language];
  const preview = import.meta.env.VITE_VERCEL_ENV === 'preview' || !!initial?.preview;
  const indexable = current.indexingEnabled && !preview && (page?.indexable ?? serverPage?.indexable ?? false);
  document.title = title;
  setMeta('description', description); setMeta('robots', indexable ? 'index, follow' : 'noindex, follow');
  setMeta('keywords', current.keywords[language]);
  setMeta('og:title', title, true); setMeta('og:description', description, true); setMeta('og:site_name', current.siteName, true);
  setMeta('og:locale', language === 'en' ? 'en_US' : 'zh_CN', true);
  setMeta('og:type', /^\/articles\//u.test(path) && serverPage ? 'article' : 'website', true);
  setMeta('twitter:card', current.twitterCard); setMeta('twitter:title', title); setMeta('twitter:description', description);
  setMeta('google-site-verification', current.googleVerification); setMeta('msvalidate.01', current.bingVerification);
  document.head.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang]').forEach(link => link.remove());
  document.head.querySelector('meta[property="og:url"]')?.remove();
  if ((page || serverPage) && current.siteUrl) {
    try {
      const addLink = (rel: string, href: string, hreflang?: string) => { const link = document.createElement('link'); link.rel = rel; link.href = href; if (hreflang) link.hreflang = hreflang; document.head.append(link); };
      const canonical = languageUrl(current.siteUrl, path, language);
      addLink('canonical', canonical); setMeta('og:url', canonical, true);
      for (const alternate of seoLanguages) addLink('alternate', languageUrl(current.siteUrl, path, alternate), alternate);
      addLink('alternate', languageUrl(current.siteUrl, path, current.defaultLanguage), 'x-default');
    } catch { /* Server validates the configured public origin. */ }
  }
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach(script => script.remove());
  if ((page || serverPage) && current.siteUrl) {
    try {
      const schema = document.createElement('script'); schema.type = 'application/ld+json';
      schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': /^\/articles\//u.test(path) ? 'Article' : path === '/' ? 'WebSite' : 'WebPage',
        name: title, description, url: languageUrl(current.siteUrl, path, language), inLanguage: /^\/articles\//u.test(path) ? serverPage?.contentLanguage ?? language : language,
        ...(/^\/articles\//u.test(path) && { headline: title }),
      });
      document.head.append(schema);
    } catch { /* No structured URL is emitted for an invalid public origin. */ }
  }
  let icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.append(icon); }
  icon.href = current.faviconUrl || defaultLogo; icon.type = current.faviconUrl ? 'image/webp' : 'image/jpeg';
  if (current.socialImageUrl && current.siteUrl) {
    const image = new URL(current.socialImageUrl, current.siteUrl).href; setMeta('og:image', image, true); setMeta('twitter:image', image);
  } else { document.head.querySelector('meta[property="og:image"]')?.remove(); document.head.querySelector('meta[name="twitter:image"]')?.remove(); }
}
export function updatePageMetadata(pathname: string, locale: string) {
  active = { pathname, locale }; applyMetadata(pathname, locale); void loadSiteSeo();
  const language = locale === 'en' ? 'en' : 'zh-CN';
  if (/^\/articles\/[^/]+\/?$/u.test(pathname) && !routeMetadata.has(`${pathname}:${language}`) && !(initial?.path === pathname && initial.language === language)) {
    const version = requestVersion;
    void Promise.resolve().then(() => fetch(`/api/site/seo/page?path=${encodeURIComponent(pathname)}&tl=${language}`, { credentials: 'same-origin', cache: 'no-store' })).then(async response => {
      if (!response.ok) return;
      const value = await response.json() as RouteMetadata;
      if (typeof value.title !== 'string' || typeof value.description !== 'string' || typeof value.indexable !== 'boolean') return;
      if (version !== requestVersion) return;
      routeMetadata.set(`${pathname}:${language}`, value);
      if (active?.pathname === pathname && active.locale === locale) applyMetadata(pathname, locale);
    }).catch(() => {});
  }
}
export function explicitUrlLocale(search = typeof window === 'undefined' ? '' : window.location.search): SeoLanguage | undefined { return seoLanguage(new URLSearchParams(search).get('tl')); }
export function preserveLanguageAddress(address: string) {
  if (typeof window === 'undefined') return address;
  const language = explicitUrlLocale();
  if (!language || address.startsWith('/admin')) return address;
  const url = new URL(address, window.location.origin); if (url.origin !== window.location.origin) return address;
  url.searchParams.set('tl', language); return url.pathname + url.search + url.hash;
}
