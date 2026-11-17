import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAdminEdits } from '../AdminNavigationGuard';
import { ApiError } from '../../lib/api';
import { loadSiteSeo } from '../../lib/seo';
import { seoLanguages, seoPaths, type SeoSnapshot, type SeoSettings, type SeoImage, type SeoLanguage } from '../../lib/seo-settings';
import { adminWrite, LoadState, useAdminResource, type AdminProps } from './common';

function SeoForm({ ownerId, initial, reload }: AdminProps & { initial: SeoSnapshot; reload: () => void }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(initial);
  const [settings, setSettings] = useState<SeoSettings>(initial.settings);
  const [language, setLanguage] = useState<SeoLanguage>('zh-CN');
  const [pagePath, setPagePath] = useState<string>('/');
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved.settings);
  useAdminEdits(dirty, busy || imageBusy);
  const update = <K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) => { setSettings(previous => ({ ...previous, [key]: value })); setNotice(''); };
  const updatePage = (value: Partial<SeoSettings['pages'][string]>) => { update('pages', { ...settings.pages, [pagePath]: { ...settings.pages[pagePath], ...value } }); };
  async function upload(event: ChangeEvent<HTMLInputElement>, role: 'logo' | 'favicon' | 'socialImage') {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError(t('请选择不超过 1 MB 的 PNG、JPEG 或 WebP', 'Choose a PNG, JPEG or WebP under 1 MB')); return; }
    setImageBusy(true); setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error(t('读取图片失败', 'Could not read image'))); reader.readAsDataURL(file); });
      update(role, { dataUrl });
    } catch (problem) { setError(problem instanceof Error ? problem.message : t('读取图片失败', 'Could not read image')); }
    finally { setImageBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy || imageBusy || !dirty || conflict) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const value = await adminWrite<SeoSnapshot>(ownerId, '/settings/seo', { settings, revision: saved.revision });
      setSaved(value); setSettings(value.settings); setNotice(t('已保存', 'Saved')); await loadSiteSeo(true);
    } catch (problem) { setConflict(problem instanceof ApiError && problem.status === 409); setError(problem instanceof Error ? problem.message : t('保存失败', 'Save failed')); }
    finally { setBusy(false); }
  }
  const imageField = (role: 'logo' | 'favicon' | 'socialImage', label: string, image: SeoImage) => <div key={role} className="seo-image-field"><span>{label}</span>{image && <img src={image.dataUrl} alt={label} style={{ display: 'block', maxWidth: 240, maxHeight: 120, objectFit: 'contain', marginBlock: 8 }} />}<label className="feature-file">{image ? t('替换图片', 'Replace image') : t('上传图片', 'Upload image')}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label={label} onChange={event => void upload(event, role)} /></label>{image && <button type="button" className="text-button" onClick={() => update(role, null)}>{t('恢复默认', 'Restore default')}</button>}</div>;
  return <form className="feature-form" onSubmit={save}>
    {initial.available === false && <p className="form-error" role="alert">{t("SEO 配置存储尚未安装", "SEO configuration storage is not installed")}</p>}
    <fieldset className="settings-group" disabled={busy || conflict || imageBusy || initial.available === false}><legend>{t('网站标识', 'Site identity')}</legend><div className="feature-form-pair">
      <label>{t('网站名称', 'Site name')}<input required maxLength={100} value={settings.siteName} onChange={event => update('siteName', event.target.value)} /></label>
      <label>{t('正式网站地址', 'Canonical site URL')}<input type="url" placeholder="https://" value={settings.siteUrl} onChange={event => update('siteUrl', event.target.value)} /></label>
      <label>{t('默认语言', 'Default language')}<select value={settings.defaultLanguage} onChange={event => update('defaultLanguage', event.target.value as SeoLanguage)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
      <label>{t('允许搜索引擎索引', 'Search indexing')}<input type="checkbox" checked={settings.indexingEnabled} onChange={event => update('indexingEnabled', event.target.checked)} /></label>
    </div><div className="feature-form-pair">{imageField('logo', t('网站 Logo', 'Site logo'), settings.logo)}{imageField('favicon', t('浏览器图标', 'Favicon'), settings.favicon)}{imageField('socialImage', t('分享图片', 'Social image'), settings.socialImage)}</div></fieldset>
    <fieldset className="settings-group" disabled={busy || conflict || imageBusy || initial.available === false}><legend>{t('双语元数据', 'Bilingual metadata')}</legend>
      <label>{t('编辑语言', 'Editing language')}<select value={language} onChange={event => setLanguage(event.target.value as SeoLanguage)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
      <label>{t('首页标题', 'Home title')}<input required maxLength={200} value={settings.homeTitle[language]} onChange={event => update('homeTitle', { ...settings.homeTitle, [language]: event.target.value })} /></label>
      <label>{t('网站描述', 'Site description')}<textarea required maxLength={500} value={settings.description[language]} onChange={event => update('description', { ...settings.description, [language]: event.target.value })} /></label>
      <label>{t('关键词（可选）', 'Keywords (optional)')}<input maxLength={500} value={settings.keywords[language]} onChange={event => update('keywords', { ...settings.keywords, [language]: event.target.value })} /></label>
      <label>{t('页面', 'Page')}<select value={pagePath} onChange={event => setPagePath(event.target.value)}>{seoPaths.filter(path => path !== '/').map(path => <option key={path} value={path}>{path}</option>)}<option value="/">/</option></select></label>
      {pagePath !== '/' && <><label>{t('页面标题', 'Page title')}<input required maxLength={200} value={settings.pages[pagePath].title[language]} onChange={event => updatePage({ title: { ...settings.pages[pagePath].title, [language]: event.target.value } })} /></label><label>{t('页面描述', 'Page description')}<textarea required maxLength={500} value={settings.pages[pagePath].description[language]} onChange={event => updatePage({ description: { ...settings.pages[pagePath].description, [language]: event.target.value } })} /></label></>}
      <div className="feature-form-pair"><label>{t('页面允许索引', 'Index this page')}<input type="checkbox" checked={settings.pages[pagePath].indexable} onChange={event => updatePage({ indexable: event.target.checked })} /></label><label>{t('收录到 Sitemap', 'Include in sitemap')}<input type="checkbox" checked={settings.pages[pagePath].sitemap} onChange={event => updatePage({ sitemap: event.target.checked })} /></label></div>
      <div className="feature-form-pair"><label>{t('更新频率', 'Change frequency')}<select value={settings.pages[pagePath].changefreq} onChange={event => updatePage({ changefreq: event.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly' })}><option value="daily">{t('每天', 'Daily')}</option><option value="weekly">{t('每周', 'Weekly')}</option><option value="monthly">{t('每月', 'Monthly')}</option><option value="yearly">{t('每年', 'Yearly')}</option></select></label><label>{t('优先级', 'Priority')}<input type="number" min={0} max={1} step={0.1} value={settings.pages[pagePath].priority} onChange={event => updatePage({ priority: Number(event.target.value) })} /></label></div>
    </fieldset>
    <fieldset className="settings-group" disabled={busy || conflict || imageBusy || initial.available === false}><legend>{t('分享与站长验证', 'Sharing and verification')}</legend><div className="feature-form-pair">
      <label>{t('分享卡片', 'Social card')}<select value={settings.twitterCard} onChange={event => update('twitterCard', event.target.value as 'summary' | 'summary_large_image')}><option value="summary_large_image">{t('大图', 'Large image')}</option><option value="summary">{t('摘要', 'Summary')}</option></select></label>
      <label>Google Search Console<input maxLength={200} value={settings.googleVerification} onChange={event => update('googleVerification', event.target.value)} /></label>
      <label>Bing Webmaster Tools<input maxLength={200} value={settings.bingVerification} onChange={event => update('bingVerification', event.target.value)} /></label>
    </div></fieldset>
    <fieldset className="settings-group" disabled={busy || conflict || imageBusy || initial.available === false}><legend>Sitemap / robots.txt</legend><div className="feature-form-pair">
      <label>{t('启用 Sitemap', 'Enable sitemap')}<input type="checkbox" checked={settings.sitemapEnabled} onChange={event => update('sitemapEnabled', event.target.checked)} /></label>
      <label>{t('包含已发布公共文章', 'Include published public articles')}<input type="checkbox" checked={settings.sitemapArticles} onChange={event => update('sitemapArticles', event.target.checked)} /></label>
      {seoLanguages.map(value => <label key={value}>{value}<input type="checkbox" checked={settings.sitemapLanguages.includes(value)} onChange={event => update('sitemapLanguages', event.target.checked ? [...settings.sitemapLanguages, value] : settings.sitemapLanguages.filter(item => item !== value))} /></label>)}
    </div><label>{t('排除的文章 ID（每行一个）', 'Excluded article IDs (one per line)')}<textarea value={settings.excludedArticleIds.join('\n')} onChange={event => update('excludedArticleIds', event.target.value.split('\n').map(item => item.trim()).filter(Boolean))} /></label><label>{t('禁止抓取的路径（每行一个）', 'Disallowed crawl paths (one per line)')}<textarea value={settings.robotsDisallow.join('\n')} onChange={event => update('robotsDisallow', event.target.value.split('\n').map(item => item.trim()).filter(Boolean))} /></label><div className="feature-actions"><a href="/sitemap.xml" target="_blank" rel="noopener noreferrer">{t('查看 Sitemap', 'View sitemap')}</a><a href="/robots.txt" target="_blank" rel="noopener noreferrer">robots.txt</a><a href="/?tl=zh-CN" target="_blank" rel="noopener noreferrer">中文 HTML</a><a href="/?tl=en" target="_blank" rel="noopener noreferrer">English HTML</a></div></fieldset>
    {!settings.siteUrl && <p className="form-error" role="status">{t('填写正式网站地址后生成 canonical、hreflang 和 Sitemap。', 'Set the canonical site URL to generate canonical, hreflang and sitemap URLs.')}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="feature-actions">{(conflict || initial.available === false) && <button type="button" className="outline-button" onClick={reload}>{t('重新加载', 'Reload')}</button>}<button className="primary-button" disabled={busy || imageBusy || !dirty || conflict || initial.available === false || settings.sitemapLanguages.length === 0}>{busy ? t('保存中…', 'Saving…') : t('保存', 'Save')}</button></div>
  </form>;
}
export function SeoSettingsPanel({ ownerId }: AdminProps) {
  const { data, error, retry } = useAdminResource<SeoSnapshot>(ownerId, '/settings/seo');
  return data ? <SeoForm key={data.revision} ownerId={ownerId} initial={data} reload={retry} /> : <LoadState error={error} retry={retry} />;
}
