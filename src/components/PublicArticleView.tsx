import { useState } from 'react';
import { articleLength } from '../lib/analysis';
import type { ArticleSnapshot } from '../lib/models';
import { pathForArticle } from '../lib/routes';

export function PublicArticleView({ article, offline, onPractice, onBack }: { article: ArticleSnapshot; offline: boolean; onPractice: () => void; onBack: () => void }) {
  const [notice, setNotice] = useState('');
  const link = window.location.origin + pathForArticle(article.id);
  const source = article.source && /^https?:\/\//iu.test(article.source.url) ? article.source : undefined;
  async function copy() {
    try { await navigator.clipboard.writeText(link); setNotice('链接已复制'); }
    catch { setNotice('无法复制，请手动选择链接'); }
  }
  return <section className="content-panel feature-panel public-article">
    <div className="content-heading"><h1>{article.title}</h1><button type="button" className="primary-button" onClick={onPractice}>练习</button></div>
    <div className="feature-meta">
      {article.author && <span>{article.author}</span>}
      {article.theme && <span>{article.theme}</span>}
      <span>{articleLength(article).toLocaleString()} {article.language === 'zh' ? '字' : '词'}</span>
      {source && <><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a><span>{source.license === 'public-domain' ? '公共领域' : '可再使用'}</span></>}
    </div>
    {offline && <p className="feature-muted" role="status">离线文章快照</p>}
    <div className="feature-form public-article-share">
      <label>文章链接<input readOnly value={link} onFocus={(event) => event.currentTarget.select()} /></label>
      <div className="feature-actions"><button type="button" className="outline-button" onClick={onBack}>返回文章库</button><button type="button" className="outline-button" onClick={() => void copy()}>复制链接</button></div>
      {notice && <p className="feature-muted" role="status">{notice}</p>}
    </div>
    <p className="public-article-text">{article.text}</p>
  </section>;
}
