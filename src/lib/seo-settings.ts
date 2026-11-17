import pages from '../data/seo.json' with { type: 'json' };
export type SeoLanguage = 'zh-CN' | 'en';
export type LocalizedText = Record<SeoLanguage, string>;
export type SeoImage = { dataUrl: string } | null;
export const seoLanguages: SeoLanguage[] = ['zh-CN', 'en'];
export const seoPaths = Object.keys(pages) as Array<keyof typeof pages>;
export type SeoPage = { title: LocalizedText; description: LocalizedText; indexable: boolean; sitemap: boolean; changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'; priority: number };
export type SeoSettings = {
  siteUrl: string; siteName: string; homeTitle: LocalizedText; description: LocalizedText; keywords: LocalizedText;
  indexingEnabled: boolean; defaultLanguage: SeoLanguage; logo: SeoImage; favicon: SeoImage; socialImage: SeoImage;
  twitterCard: 'summary' | 'summary_large_image'; googleVerification: string; bingVerification: string;
  sitemapEnabled: boolean; sitemapLanguages: SeoLanguage[]; sitemapArticles: boolean; excludedArticleIds: string[];
  robotsDisallow: string[]; pages: Record<string, SeoPage>;
};
export type SeoSnapshot = { settings: SeoSettings; revision: number; available?: boolean };
export type PublicSeoSettings = Omit<SeoSettings, 'logo' | 'favicon' | 'socialImage' | 'excludedArticleIds' | 'robotsDisallow'> & {
  logoUrl: string | null; faviconUrl: string | null; socialImageUrl: string | null;
};
export function defaultSeoSettings(origin = ''): SeoSettings {
  return {
    siteUrl: origin, siteName: 'TypeLune', homeTitle: { 'zh-CN': pages['/'][0], en: pages['/'][2] },
    description: { 'zh-CN': pages['/'][1], en: pages['/'][3] }, keywords: { 'zh-CN': '', en: '' },
    indexingEnabled: true, defaultLanguage: 'zh-CN', logo: null, favicon: null, socialImage: null,
    twitterCard: 'summary_large_image', googleVerification: '', bingVerification: '',
    sitemapEnabled: true, sitemapLanguages: ['zh-CN', 'en'], sitemapArticles: true, excludedArticleIds: [],
    robotsDisallow: ['/api/', '/admin', '/account', '/records', '/drafts', '/feedback', '/stats', '/mistakes'],
    pages: Object.fromEntries(Object.entries(pages).map(([path, [titleZh, descriptionZh, titleEn, descriptionEn]]) => [path, {
      title: { 'zh-CN': titleZh, en: titleEn }, description: { 'zh-CN': descriptionZh, en: descriptionEn },
      indexable: true, sitemap: true, changefreq: 'weekly', priority: path === '/' ? 1 : 0.7,
    }])),
  };
}
export function seoLanguage(value: unknown): SeoLanguage | undefined { return value === 'zh-CN' || value === 'zh' ? 'zh-CN' : value === 'en' ? 'en' : undefined; }
export function languageUrl(origin: string, path: string, language: SeoLanguage) {
  const url = new URL(path, origin); url.searchParams.set('tl', language); return url.href;
}
