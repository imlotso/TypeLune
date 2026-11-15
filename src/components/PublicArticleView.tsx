import { useI18n } from '../lib/i18n';
import { useState } from 'react';
import { articleLength } from '../lib/analysis';
import type { ArticleSnapshot } from '../lib/models';
import { pathForArticle } from '../lib/routes';

export function PublicArticleView({ article, offline, onPractice, onBack }: { article: ArticleSnapshot; offline: boolean; onPractice: () => void; onBack: () => void }) {
  const { t, locale } = useI18n();
  const [notice, setNotice] = useState('');
  const link = window.location.origin + pathForArticle(article.id);
  const source = article.source && /^https?:\/\//iu.test(article.source.url) ? article.source : undefined;
  async function copy() {
    try { await navigator.clipboard.writeText(link); setNotice(t("链接已复制", "Link copied")); }
    catch { setNotice(t("无法复制，请手动选择链接", "Could not copy. Select the link manually.")); }
  }
  return <section className="content-panel feature-panel public-article">
    <div className="content-heading"><h1>{article.title}</h1><button type="button" className="primary-button" onClick={onPractice}>{t("练习", "Practice")}</button></div>
    <div className="feature-meta">
      {article.author && <span>{article.author}</span>}
      {article.theme && <span>{article.theme}</span>}
      <span>{articleLength(article).toLocaleString()} {article.language === 'zh' ? t("字", "characters") : t("词", "words")}</span>
      {source && <><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a><span>{source.license === 'public-domain' ? t("公共领域", "Public domain") : t("可再使用", "Reusable")}</span></>}
    </div>
    {offline && <p className="feature-muted" role="status">{t("离线文章快照", "Offline article snapshot")}</p>}
    <div className="feature-form public-article-share">
      <label>{t("文章链接", "Article link")}<input readOnly value={link} onFocus={(event) => event.currentTarget.select()} /></label>
      <div className="feature-actions"><button type="button" className="outline-button" onClick={onBack}>{t("返回文章库", "Back to library")}</button><button type="button" className="outline-button" onClick={() => void copy()}>{t("复制链接", "Copy link")}</button></div>
      {notice && <p className="feature-muted" role="status">{notice}</p>}
    </div>
    <p className="public-article-text">{article.text}</p>
  </section>;
}
