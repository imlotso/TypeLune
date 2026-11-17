import { readFile } from 'node:fs/promises';
import { sitemapChunks } from './sitemap-chunks.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AsyncDatabase } from './database/types.js';
import type { createCatalogStore } from './catalog.js';
import type { SeoStore } from './seo-settings.js';
import { seoLanguage, seoLanguages, seoPaths, languageUrl, type SeoLanguage, type SeoSettings } from '../src/lib/seo-settings.js';
import { helpSections, helpSectionsEn, privacySections, privacySectionsEn, termsSections, termsSectionsEn } from '../src/data/site-content.js';
import { articleIdFromPath } from '../src/lib/routes.js';

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const fallbackTemplate = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TypeLune</title></head><body><div id="root"></div></body></html>';
type ArticleSummary = { id: string; title: string; author: string; language: string; updatedAt: number };
type Options = { store: SeoStore; db: AsyncDatabase; catalog: Awaited<ReturnType<typeof createCatalogStore>>; templatePath?: string; preview: boolean };
export async function createSeoRenderer({ store, db, catalog, templatePath, preview }: Options) {
  let template = fallbackTemplate;
  if (templatePath) { try { template = await readFile(templatePath, 'utf8'); } catch { /* API-only tests still render useful public HTML. */ } }
  const summaries = () => db.prepare("SELECT id,title,author,language,updated_at AS updatedAt FROM public_articles WHERE status='published' ORDER BY display_order IS NULL,display_order,id").all() as Promise<ArticleSummary[]>;
  const imageUrl = (settings: SeoSettings, role: 'logo' | 'favicon' | 'socialImage') => settings[role] ? `/api/site/seo/images/${role === 'socialImage' ? 'social' : role}` : null;
  const meta = (key: string, value: string, property = false) => `<meta ${property ? 'property' : 'name'}="${key}" content="${escapeHtml(value)}">`;
  const alternateLinks = (origin: string, path: string, defaultLanguage: SeoLanguage) => origin ? seoLanguages.map(language => `<link rel="alternate" hreflang="${language}" href="${escapeHtml(languageUrl(origin, path, language))}">`).join('') + `<link rel="alternate" hreflang="x-default" href="${escapeHtml(languageUrl(origin, path, defaultLanguage))}">` : '';
  async function html(request: FastifyRequest, reply: FastifyReply, path: string) {
    const url = new URL(request.url, 'http://localhost');
    const rawLanguage = url.searchParams.get('tl');
    const snapshot = await store.read();
    const { settings } = snapshot;
    const language = rawLanguage === null ? settings.defaultLanguage : seoLanguage(rawLanguage);
    if (!language) return reply.code(400).header('X-Robots-Tag', 'noindex, nofollow').type('text/html').send('<!doctype html><html><head><meta name="robots" content="noindex"></head><body>Unsupported language</body></html>');
    const en = language === 'en';
    const page = settings.pages[path];
    const articleId = articleIdFromPath(path);
    const article = articleId ? await catalog.findPublished(articleId) : undefined;
    const found = !!page || !!article;
    const indexing = found && settings.indexingEnabled && !preview && (page?.indexable ?? true);
    const title = article ? `${article.title} · ${settings.siteName}` : path === '/' ? settings.homeTitle[language] : page?.title[language] ?? (en ? 'Page not found' : '页面未找到');
    const description = article ? `${article.title}${article.author ? ` · ${article.author}` : ''} — ${en ? 'Chinese and English typing practice' : '中英文长文打字练习'} · ${settings.siteName}` : path === '/' ? settings.description[language] : page?.description[language] ?? settings.description[language];
    const canonical = settings.siteUrl && found ? languageUrl(settings.siteUrl, path, language) : '';
    const socialImage = imageUrl(settings, 'socialImage');
    const social = socialImage && settings.siteUrl ? new URL(socialImage, settings.siteUrl).href : '';
    let head = `<title>${escapeHtml(title)}</title>${meta('description', description)}${meta('robots', indexing ? 'index, follow' : 'noindex, follow')}${meta('og:title', title, true)}${meta('og:description', description, true)}${meta('og:type', article ? 'article' : 'website', true)}${meta('og:site_name', settings.siteName, true)}${meta('og:locale', en ? 'en_US' : 'zh_CN', true)}${meta('twitter:card', settings.twitterCard)}${meta('twitter:title', title)}${meta('twitter:description', description)}`;
    if (settings.keywords[language]) head += meta('keywords', settings.keywords[language]);
    if (settings.googleVerification) head += meta('google-site-verification', settings.googleVerification);
    if (settings.bingVerification) head += meta('msvalidate.01', settings.bingVerification);
    if (canonical) head += `<link rel="canonical" href="${escapeHtml(canonical)}">${meta('og:url', canonical, true)}${alternateLinks(settings.siteUrl, path, settings.defaultLanguage)}`;
    if (social) head += meta('og:image', social, true) + meta('twitter:image', social);
    const favicon = imageUrl(settings, 'favicon');
    if (favicon) head += `<link rel="icon" type="image/webp" href="${favicon}">`;
    if (settings.siteUrl && found) head += `<script type="application/ld+json">${json({ '@context': 'https://schema.org', '@type': article ? 'Article' : path === '/' ? 'WebSite' : 'WebPage', name: title, description, url: canonical, inLanguage: article ? (article.language === 'en' ? 'en' : 'zh-CN') : language, ...(article ? { headline: article.title, author: { '@type': 'Person', name: article.author }, articleSection: article.language === 'en' ? 'English typing practice' : '中文打字练习' } : {}) })}</script>`;
    const navigation = seoPaths.map(target => `<a href="${escapeHtml(target)}?tl=${language}">${escapeHtml(target === '/' ? settings.siteName : settings.pages[target].title[language])}</a>`).join(' · ');
    let body = `<header><nav aria-label="${en ? 'Main navigation' : '主要导航'}">${navigation}</nav></header><main><h1>${escapeHtml(article ? article.title : title)}</h1><p>${escapeHtml(description)}</p>`;
    if (article) body += `<p>${escapeHtml(article.author)}</p><article lang="${article.language === 'en' ? 'en' : 'zh-CN'}">${article.content.split(/\n+/u).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')}</article><p>${en ? 'Source' : '来源'}: <a href="${escapeHtml(article.source.url)}" rel="noopener noreferrer">${escapeHtml(article.source.name)}</a> · ${escapeHtml(article.source.license)}</p>`;
    if (path === '/library') body += `<ul>${(await summaries()).map(item => `<li><a href="${escapeHtml(languageUrl(settings.siteUrl || 'https://localhost', `/articles/${encodeURIComponent(item.id)}`, language).replace(settings.siteUrl || 'https://localhost', ''))}">${escapeHtml(item.title)}</a> — ${escapeHtml(item.author)} <span lang="en">${item.language === 'en' ? 'English' : '中文'}</span></li>`).join('')}</ul>`;
    const sections = path === '/help' ? (en ? helpSectionsEn : helpSections) : path === '/privacy' ? (en ? privacySectionsEn : privacySections) : path === '/terms' ? (en ? termsSectionsEn : termsSections) : [];
    body += sections.map(([heading, text]) => `<section><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(text)}</p></section>`).join('');
    body += '</main>';
    const publicSettings = await store.publicSettings(snapshot);
    const bootstrap = `<script id="typelune-seo-bootstrap" type="application/json">${json({ settings: publicSettings, language, path, preview, title, description, indexable: indexing, ...(article && { contentLanguage: article.language === 'en' ? 'en' : 'zh-CN' }) })}</script>`;
    let result = template.replace(/<html\b[^>]*>/iu, `<html lang="${language}">`).replace(/<title>.*?<\/title>/isu, '')
      .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|keywords|robots|google-site-verification|msvalidate\.01|og:[^"']+|twitter:[^"']+)["'][^>]*>/giu, '')
      .replace(/<link\b[^>]*rel=["'](?:canonical|alternate)["'][^>]*>/giu, '');
    if (favicon) result = result.replace(/<link\b[^>]*rel=["']icon["'][^>]*>/giu, '');
    result = result.replace('</head>', head + '</head>').replace(/<div id="root"><\/div>/u, `<div id="root">${body}</div>`).replace('</body>', bootstrap + '</body>');
    if (!found) reply.code(404);
    reply.header('Cache-Control', 'no-store').header('Content-Language', language).header('X-Robots-Tag', indexing ? 'index, follow' : 'noindex, follow');
    return reply.type('text/html; charset=utf-8').send(result);
  }
  async function sitemap(reply: FastifyReply, part?: number) {
    const { settings } = await store.read();
    reply.header('Cache-Control', 'no-store').header('X-Robots-Tag', 'noindex, follow');
    if (!settings.sitemapEnabled || !settings.indexingEnabled || preview) return reply.code(404).send({ error: 'Sitemap disabled' });
    if (!settings.siteUrl) return reply.code(503).send({ error: 'Configure the canonical site URL in SEO settings' });
    const paths = seoPaths.filter(path => settings.pages[path].indexable && settings.pages[path].sitemap).map(path => ({ path: path as string, updatedAt: undefined as number | undefined, ...settings.pages[path] }));
    if (settings.sitemapArticles) for (const article of await summaries()) {
      if (!settings.excludedArticleIds.includes(article.id)) paths.push({ path: `/articles/${encodeURIComponent(article.id)}`, updatedAt: article.updatedAt, title: { 'zh-CN': article.title, en: article.title }, description: settings.description, indexable: true, sitemap: true, changefreq: 'monthly', priority: 0.6 });
    }
    const items = paths.flatMap(item => settings.sitemapLanguages.map(language => `<url><loc>${escapeHtml(languageUrl(settings.siteUrl, item.path, language))}</loc>${item.updatedAt ? `<lastmod>${new Date(item.updatedAt).toISOString()}</lastmod>` : ''}<changefreq>${item.changefreq}</changefreq><priority>${item.priority.toFixed(1)}</priority>${settings.sitemapLanguages.map(alternate => `<xhtml:link rel="alternate" hreflang="${alternate}" href="${escapeHtml(languageUrl(settings.siteUrl, item.path, alternate))}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(languageUrl(settings.siteUrl, item.path, settings.defaultLanguage))}"/></url>`));
    const chunks = sitemapChunks(items);
    const shards = chunks.length;
    if (part !== undefined && (!Number.isSafeInteger(part) || part < 1 || part > Math.max(1, shards))) return reply.code(404).send({ error: 'Sitemap not found' });
    if (part === undefined && shards > 1) return reply.type('application/xml; charset=utf-8').send(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: shards }, (_, index) => `<sitemap><loc>${escapeHtml(settings.siteUrl)}/sitemap-${index + 1}.xml</loc></sitemap>`).join('')}</sitemapindex>`);
    const entries = chunks[(part ?? 1) - 1];
    return reply.type('application/xml; charset=utf-8').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.join('')}</urlset>`);
  }
  async function robots(reply: FastifyReply) {
    const { settings } = await store.read();
    const disallow = !settings.indexingEnabled || preview ? ['/'] : settings.robotsDisallow;
    const body = `User-agent: *\n${disallow.map(path => `Disallow: ${path.trim()}\n`).join('')}${settings.indexingEnabled && !preview ? 'Allow: /api/site/seo/images/\n' : ''}${settings.sitemapEnabled && settings.indexingEnabled && !preview && settings.siteUrl ? `Sitemap: ${settings.siteUrl}/sitemap.xml\n` : ''}`;
    return reply.header('Cache-Control', 'no-store').type('text/plain; charset=utf-8').send(body);
  }
  async function metadata(path: string, language: SeoLanguage) {
    const { settings } = await store.read();
    const page = settings.pages[path];
    const id = articleIdFromPath(path);
    const article = id ? await catalog.findPublished(id) : undefined;
    if (!page && !article) return undefined;
    return { title: article ? `${article.title} · ${settings.siteName}` : path === '/' ? settings.homeTitle[language] : page.title[language],
      description: article ? `${article.title}${article.author ? ` · ${article.author}` : ''} — ${language === 'en' ? 'Chinese and English typing practice' : '中英文长文打字练习'} · ${settings.siteName}` : path === '/' ? settings.description[language] : page.description[language],
      indexable: settings.indexingEnabled && !preview && (page?.indexable ?? true), ...(article && { contentLanguage: article.language === 'en' ? 'en' : 'zh-CN' }) };
  }
  return { html, sitemap, robots, metadata };
}
export type SeoRenderer = Awaited<ReturnType<typeof createSeoRenderer>>;
export function registerSeoPageRoutes(app: FastifyInstance, renderer: SeoRenderer) {
  for (const path of seoPaths) {
    app.get(path, async (request, reply) => renderer.html(request, reply, path));
    if (path !== '/') app.get(path + '/', async (request, reply) => renderer.html(request, reply, path));
  }
  app.get('/api/site/seo/page', async (request, reply) => {
    const { path, tl } = request.query as Record<string, unknown>;
    const language = seoLanguage(tl);
    if (typeof path !== 'string' || path.length > 500 || !language || (!seoPaths.includes(path as typeof seoPaths[number]) && !articleIdFromPath(path))) return reply.code(400).send({ error: 'Invalid public page' });
    const value = await renderer.metadata(path, language);
    return value ?? reply.code(404).send({ error: 'Page not found' });
  });
  app.get('/index.html', async (request, reply) => renderer.html(request, reply, '/'));
  app.get('/seo/:file', async (request, reply) => {
    const { file } = request.params as { file: string };
    const match = /^(home|lessons|library|rankings|help|about|privacy|terms)(?:\.(zh-CN|en))?\.html$/u.exec(file);
    reply.header('X-Robots-Tag', 'noindex, follow');
    if (!match) return reply.code(404).send({ error: 'Page not found' });
    return reply.redirect((match[1] === 'home' ? '/' : '/' + match[1]) + '?tl=' + (match[2] || 'zh-CN'), 308);
  });
  app.get('/articles/:id', async (request, reply) => renderer.html(request, reply, new URL(request.url, 'http://localhost').pathname));
  app.get('/sitemap.xml', async (_request, reply) => renderer.sitemap(reply));
  app.get('/sitemap-:part.xml', async (request, reply) => { const { part } = request.params as { part: string }; return renderer.sitemap(reply, /^\d+$/u.test(part) ? Number(part) : 0); });
  app.get('/robots.txt', async (_request, reply) => renderer.robots(reply));
}
