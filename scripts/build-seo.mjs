import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { loadEnv } from 'vite';

const pages = JSON.parse(await readFile('src/data/seo.json', 'utf8'));
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
let origin;
if (env.VITE_SITE_URL) {
  const url = new URL(env.VITE_SITE_URL);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('VITE_SITE_URL must be a public HTTP(S) origin without a path, credentials, query or hash');
  origin = url.origin;
}
const indexable = false; // Fallback files are never canonical crawl targets; live routes control indexing.
const languages = ['zh-CN', 'en'];
const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const localizedUrl = (path, language) => `${origin}${path}?tl=${language}`;
const template = await readFile('dist/client/index.html', 'utf8');
await mkdir('dist/client/seo', { recursive: true });
for (const [path, values] of Object.entries(pages)) for (const language of languages) {
  const offset = language === 'en' ? 2 : 0;
  const [title, description] = values.slice(offset, offset + 2);
  const navigation = Object.entries(pages).map(([target, labels]) => `<a href="${target}?tl=${language}">${escape(labels[offset])}</a>`).join(' · ');
  const canonical = origin ? `<link rel="canonical" href="${escape(localizedUrl(path, language))}" /><meta property="og:url" content="${escape(localizedUrl(path, language))}" />${languages.map(alternate => `<link rel="alternate" hreflang="${alternate}" href="${escape(localizedUrl(path, alternate))}" />`).join('')}<link rel="alternate" hreflang="x-default" href="${escape(localizedUrl(path, 'zh-CN'))}" />` : '';
  const html = template.replace(/<html\b[^>]*>/iu, `<html lang="${language}">`).replace(/<title>.*?<\/title>/s, `<title>${escape(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escape(description)}" />`)
    .replace('</head>', `<meta name="robots" content="${indexable ? 'index, follow' : 'noindex, nofollow'}" /><meta property="og:type" content="website" /><meta property="og:site_name" content="TypeLune" /><meta property="og:title" content="${escape(title)}" /><meta property="og:description" content="${escape(description)}" />${canonical}</head>`)
    .replace('<div id="root"></div>', `<div id="root"><main><h1>${escape(title)}</h1><p>${escape(description)}</p><nav aria-label="${language === 'en' ? 'Navigation' : '导航'}">${navigation}</nav></main></div>`);
  const name = path === '/' ? 'home' : path.slice(1);
  await writeFile(`dist/client/seo/${name}.${language}.html`, html);
  if (language === 'zh-CN') await writeFile(path === '/' ? 'dist/client/index.html' : `dist/client/seo/${name}.html`, html);
}
await writeFile('dist/client/app.html', template.replace('</head>', '<meta name="robots" content="noindex, follow" /></head>'));
if (!env.VERCEL) {
  // Compatibility fallback for static Sites packaging. Node and Vercel use live,
  // administrator-controlled endpoints instead of these build-time documents.
  await writeFile('dist/client/robots.txt', !indexable ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /account\nDisallow: /records\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`);
  if (origin) await writeFile('dist/client/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${Object.keys(pages).flatMap(path => languages.map(language => `<url><loc>${escape(localizedUrl(path, language))}</loc>${languages.map(alternate => `<xhtml:link rel="alternate" hreflang="${alternate}" href="${escape(localizedUrl(path, alternate))}"/>`).join('')}</url>`)).join('')}</urlset>`);
} else {
  // Prevent filesystem precedence from bypassing runtime sitemap/robots controls.
  await Promise.all(['robots.txt', 'sitemap.xml'].map(name => rm(`dist/client/${name}`, { force: true })));
}
console.log(`Generated ${Object.keys(pages).length * languages.length} bilingual fallback SEO pages; live Node/Vercel SEO uses persisted administrator settings.`);
