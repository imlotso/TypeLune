import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react/ArrowSquareOut';
import { Globe } from '@phosphor-icons/react/Globe';
import { ImageSquare } from '@phosphor-icons/react/ImageSquare';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { ShareNetwork } from '@phosphor-icons/react/ShareNetwork';
import { TreeStructure } from '@phosphor-icons/react/TreeStructure';
import { UploadSimple } from '@phosphor-icons/react/UploadSimple';
import { useI18n } from '../../lib/i18n';
import defaultWordmark from '../../assets/typelune-wordmark.jpg';
import { useAdminEdits } from '../AdminNavigationGuard';
import { ApiError } from '../../lib/api';
import { loadSiteSeo } from '../../lib/seo';
import { seoLanguages, seoPaths, type SeoSnapshot, type SeoSettings, type SeoImage, type SeoLanguage } from '../../lib/seo-settings';
import { adminWrite, LoadState, useAdminResource, type AdminProps } from './common';
import '../../admin-seo.css';

type ImageRole = 'logo' | 'favicon' | 'socialImage';
type Section = { id: string; title: string; icon: ReactNode };

function SeoSection({ section, disabled, children }: { section: Section; disabled: boolean; children: ReactNode }) {
  return <section className="seo-card" id={section.id} aria-labelledby={`${section.id}-title`}>
    <h3 id={`${section.id}-title`} tabIndex={-1}><span className="seo-section-icon">{section.icon}</span>{section.title}</h3>
    <fieldset disabled={disabled} aria-labelledby={`${section.id}-title`}>{children}</fieldset>
  </section>;
}

function SeoToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="seo-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /></label>;
}

function SeoImageField({ role, label, image, onUpload, onReset }: { role: ImageRole; label: string; image: SeoImage; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onReset: () => void }) {
  const { t } = useI18n();
  const previewUrl = image?.dataUrl ?? (role === 'socialImage' ? undefined : defaultWordmark);
  return <div className="seo-image-field">
    <div className="seo-image-preview">{previewUrl ? <img src={previewUrl} alt="" /> : <ImageSquare size={23} aria-hidden="true" />}</div>
    <strong>{label}</strong>
    <div className="seo-image-actions">
      <label className="seo-image-picker"><UploadSimple size={15} aria-hidden="true" />{image ? t('替换图片', 'Replace image') : t('上传图片', 'Upload image')}
        <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={label} onChange={onUpload} />
      </label>
      {image && <button type="button" className="text-button" onClick={onReset}>{t('恢复默认', 'Restore default')}</button>}
    </div>
  </div>;
}

function SeoForm({ ownerId, initial, reload }: AdminProps & { initial: SeoSnapshot; reload: () => void }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(initial);
  const [settings, setSettings] = useState<SeoSettings>(initial.settings);
  const [language, setLanguage] = useState<SeoLanguage>('zh-CN');
  const [pagePath, setPagePath] = useState<(typeof seoPaths)[number]>('/');
  const [excludedArticles, setExcludedArticles] = useState(initial.settings.excludedArticleIds.join('\n'));
  const [disallowedPaths, setDisallowedPaths] = useState(initial.settings.robotsDisallow.join('\n'));
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved.settings);
  const disabled = busy || conflict || imageBusy || initial.available === false;
  useAdminEdits(dirty, busy || imageBusy);

  function update<K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) {
    setSettings(previous => ({ ...previous, [key]: value }));
    setNotice('');
  }
  function updatePage(value: Partial<SeoSettings['pages'][string]>) {
    update('pages', { ...settings.pages, [pagePath]: { ...settings.pages[pagePath], ...value } });
  }
  async function upload(event: ChangeEvent<HTMLInputElement>, role: ImageRole) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError(t('请选择不超过 1 MB 的 PNG、JPEG 或 WebP', 'Choose a PNG, JPEG or WebP under 1 MB'));
      return;
    }
    setImageBusy(true);
    setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(t('读取图片失败', 'Could not read image')));
        reader.readAsDataURL(file);
      });
      update(role, { dataUrl });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t('读取图片失败', 'Could not read image'));
    } finally {
      setImageBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (disabled || !dirty || settings.sitemapLanguages.length === 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const value = await adminWrite<SeoSnapshot>(ownerId, '/settings/seo', { settings, revision: saved.revision });
      setSaved(value);
      setSettings(value.settings);
      setExcludedArticles(value.settings.excludedArticleIds.join('\n'));
      setDisallowedPaths(value.settings.robotsDisallow.join('\n'));
      setNotice(t('已保存', 'Saved'));
      await loadSiteSeo(true);
    } catch (problem) {
      setConflict(problem instanceof ApiError && problem.status === 409);
      setError(problem instanceof Error ? problem.message : t('保存失败', 'Save failed'));
    } finally {
      setBusy(false);
    }
  }

  const identity = { id: 'seo-identity', title: t('网站标识', 'Site identity'), icon: <Globe size={20} /> };
  const metadata = { id: 'seo-metadata', title: t('页面元数据', 'Page metadata'), icon: <MagnifyingGlass size={20} /> };
  const sharing = { id: 'seo-sharing', title: t('分享与站长验证', 'Sharing and verification'), icon: <ShareNetwork size={20} /> };
  const crawling = { id: 'seo-crawling', title: t('抓取与站点地图', 'Crawling and sitemap'), icon: <TreeStructure size={20} /> };
  const names = {
    '/': t('首页', 'Home'), '/lessons': t('指法课程', 'Typing lessons'), '/library': t('文章库', 'Article library'),
    '/rankings': t('排行榜', 'Rankings'), '/help': t('使用帮助', 'Help'), '/about': t('关于', 'About'),
    '/privacy': t('隐私政策', 'Privacy'), '/terms': t('服务条款', 'Terms'),
  };
  const imageFields: [ImageRole, string][] = [
    ['logo', t('网站 Logo', 'Site logo')], ['favicon', t('浏览器图标', 'Favicon')], ['socialImage', t('分享图片', 'Social image')],
  ];
  const links = [
    [t('查看 Sitemap', 'View sitemap'), '/sitemap.xml'], ['robots.txt', '/robots.txt'],
    ['中文 HTML', '/?tl=zh-CN'], ['English HTML', '/?tl=en'],
  ];
  const page = settings.pages[pagePath];
  const home = pagePath === '/';
  const title = (home ? settings.homeTitle : page.title)[language];
  const description = (home ? settings.description : page.description)[language];
  const updateLines = (key: 'excludedArticleIds' | 'robotsDisallow', text: string) => update(key, text.split('\n').map(line => line.trim()).filter(Boolean));

  return <form className="feature-form admin-seo" onSubmit={save}>
    <header className="seo-toolbar">
      <h2>{t('搜索引擎优化', 'Search engine optimization')}</h2>
      <div className="seo-save-actions">
        {notice && <span className="seo-saved" role="status">{notice}</span>}
        {dirty && !notice && <span className="seo-unsaved">{t('有未保存的更改', 'Unsaved changes')}</span>}
        {(conflict || initial.available === false) && <button type="button" className="outline-button" onClick={reload}>{t('重新加载', 'Reload')}</button>}
        <button className="primary-button" disabled={disabled || !dirty || settings.sitemapLanguages.length === 0}>{busy ? t('保存中…', 'Saving…') : t('保存', 'Save')}</button>
      </div>
    </header>
    {initial.available === false && <p className="form-error" role="alert">{t('SEO 配置存储尚未安装', 'SEO configuration storage is not installed')}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="seo-layout">
      <div className="seo-sections">
        <SeoSection section={identity} disabled={disabled}>
          <div className="feature-form-pair">
            <label>{t('网站名称', 'Site name')}<input required maxLength={100} value={settings.siteName} onChange={event => update('siteName', event.target.value)} /></label>
            <label>{t('正式网站地址', 'Canonical site URL')}<input type="url" placeholder="https://" value={settings.siteUrl} onChange={event => update('siteUrl', event.target.value)} /></label>
            <label>{t('默认语言', 'Default language')}<select value={settings.defaultLanguage} onChange={event => update('defaultLanguage', event.target.value as SeoLanguage)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
            <SeoToggle label={t('允许搜索引擎索引', 'Search indexing')} checked={settings.indexingEnabled} onChange={value => update('indexingEnabled', value)} />
          </div>
          {!settings.siteUrl && <p className="seo-note">{t('填写正式网站地址后生成 canonical、hreflang 和 Sitemap。', 'Set the canonical site URL to generate canonical, hreflang and sitemap URLs.')}</p>}
          <div className="seo-image-grid">
            {imageFields.map(([role, label]) => <SeoImageField key={role} role={role} label={label} image={settings[role]} onUpload={event => void upload(event, role)} onReset={() => update(role, null)} />)}
          </div>
          <p className="seo-note">PNG / JPEG / WebP · 1 MB</p>
        </SeoSection>
        <SeoSection section={metadata} disabled={disabled}>
          <div className="feature-form-pair">
            <label>{t('页面', 'Page')}<select value={pagePath} onChange={event => setPagePath(event.target.value as typeof pagePath)}>
              {seoPaths.map(path => <option key={path} value={path}>{names[path]} · {path}</option>)}
            </select></label>
            <label>{t('编辑语言', 'Editing language')}<select value={language} onChange={event => setLanguage(event.target.value as SeoLanguage)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
          </div>
          <label>{home ? t('首页标题', 'Home title') : t('页面标题', 'Page title')}<input required maxLength={200} value={title} onChange={event => {
            if (home) update('homeTitle', { ...settings.homeTitle, [language]: event.target.value });
            else updatePage({ title: { ...page.title, [language]: event.target.value } });
          }} /></label>
          <label>{home ? t('网站描述', 'Site description') : t('页面描述', 'Page description')}<textarea required rows={2} maxLength={500} value={description} onChange={event => {
            if (home) update('description', { ...settings.description, [language]: event.target.value });
            else updatePage({ description: { ...page.description, [language]: event.target.value } });
          }} /></label>
          {home && <label>{t('关键词（可选）', 'Keywords (optional)')}<input maxLength={500} value={settings.keywords[language]} onChange={event => update('keywords', { ...settings.keywords, [language]: event.target.value })} /></label>}
          <div className="feature-form-pair seo-subgroup">
            <SeoToggle label={t('页面允许索引', 'Index this page')} checked={page.indexable} onChange={value => updatePage({ indexable: value })} />
            <SeoToggle label={t('收录到 Sitemap', 'Include in sitemap')} checked={page.sitemap} onChange={value => updatePage({ sitemap: value })} />
            <label>{t('更新频率', 'Change frequency')}<select value={page.changefreq} onChange={event => updatePage({ changefreq: event.target.value as typeof page.changefreq })}><option value="daily">{t('每天', 'Daily')}</option><option value="weekly">{t('每周', 'Weekly')}</option><option value="monthly">{t('每月', 'Monthly')}</option><option value="yearly">{t('每年', 'Yearly')}</option></select></label>
            <label>{t('优先级', 'Priority')}<input type="number" min={0} max={1} step={0.1} value={page.priority} onChange={event => updatePage({ priority: Number(event.target.value) })} /></label>
          </div>
        </SeoSection>
        <SeoSection section={sharing} disabled={disabled}>
          <label>{t('分享卡片', 'Social card')}<select value={settings.twitterCard} onChange={event => update('twitterCard', event.target.value as SeoSettings['twitterCard'])}><option value="summary_large_image">{t('大图', 'Large image')}</option><option value="summary">{t('摘要', 'Summary')}</option></select></label>
          <div className="feature-form-pair">
            <label>Google Search Console<input maxLength={200} value={settings.googleVerification} onChange={event => update('googleVerification', event.target.value)} /></label>
            <label>Bing Webmaster Tools<input maxLength={200} value={settings.bingVerification} onChange={event => update('bingVerification', event.target.value)} /></label>
          </div>
        </SeoSection>
        <SeoSection section={crawling} disabled={disabled}>
          <div className="feature-form-pair">
            <SeoToggle label={t('启用 Sitemap', 'Enable sitemap')} checked={settings.sitemapEnabled} onChange={value => update('sitemapEnabled', value)} />
            <SeoToggle label={t('包含已发布公共文章', 'Include published public articles')} checked={settings.sitemapArticles} onChange={value => update('sitemapArticles', value)} />
          </div>
          <fieldset className="seo-languages"><legend>{t('Sitemap 语言', 'Sitemap languages')}</legend>
            {seoLanguages.map(value => <label key={value}><input type="checkbox" checked={settings.sitemapLanguages.includes(value)} onChange={event => update('sitemapLanguages', event.target.checked ? [...settings.sitemapLanguages, value] : settings.sitemapLanguages.filter(item => item !== value))} />{value === 'zh-CN' ? '中文' : 'English'}</label>)}
          </fieldset>
          {settings.sitemapLanguages.length === 0 && <p className="form-error" role="alert">{t('至少选择一种 Sitemap 语言。', 'Select at least one sitemap language.')}</p>}
          <div className="feature-form-pair">
            <label>{t('排除的文章 ID（每行一个）', 'Excluded article IDs (one per line)')}<textarea rows={5} value={excludedArticles} onChange={event => { setExcludedArticles(event.target.value); updateLines('excludedArticleIds', event.target.value); }} /></label>
            <label>{t('禁止抓取的路径（每行一个）', 'Disallowed crawl paths (one per line)')}<textarea rows={5} value={disallowedPaths} onChange={event => { setDisallowedPaths(event.target.value); updateLines('robotsDisallow', event.target.value); }} /></label>
          </div>
        </SeoSection>
      </div>
      <aside className="seo-rail">
        <nav className="seo-shortcuts" aria-label={t('SEO 设置分区', 'SEO settings sections')}>
          {[identity, metadata, sharing, crawling].map(section => <a key={section.id} href={`#${section.id}`} onClick={event => {
            event.preventDefault();
            document.getElementById(section.id)?.scrollIntoView();
            document.getElementById(`${section.id}-title`)?.focus({ preventScroll: true });
          }}>{section.icon}{section.title}</a>)}
        </nav>
        <section className="seo-search-preview" aria-label={t('搜索结果预览', 'Search result preview')}>
          <h3>{t('搜索结果预览', 'Search result preview')}</h3>
          <div className="seo-preview-site">
            <span className="seo-preview-favicon"><img src={settings.favicon?.dataUrl ?? defaultWordmark} alt="" /></span>
            <span><strong>{settings.siteName || 'TypeLune'}</strong><span>{settings.siteUrl.replace(/\/$/, '')}{pagePath}</span></span>
          </div>
          <strong className="seo-preview-title">{title}</strong>
          <p>{description}</p>
        </section>
        <nav className="seo-public-links" aria-label={t('SEO 公开页面', 'Public SEO pages')}>
          {links.map(([label, url]) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{label}<ArrowSquareOut size={14} aria-hidden="true" /></a>)}
        </nav>
      </aside>
    </div>
  </form>;
}

export function SeoSettingsPanel({ ownerId }: AdminProps) {
  const { data, error, retry } = useAdminResource<SeoSnapshot>(ownerId, '/settings/seo');
  return data ? <SeoForm key={data.revision} ownerId={ownerId} initial={data} reload={retry} /> : <LoadState error={error} retry={retry} />;
}
