import { infoLabels, helpSections, privacySections, siteInfo, termsSections, type InfoPage } from '../data/site-content';

export function SiteInfoView({ page, onFeedback }: { page: InfoPage; onFeedback: () => void }) {
  const sections = page === 'help' ? helpSections : page === 'privacy' ? privacySections : page === 'terms' ? termsSections : [];
  const version = page === 'privacy' ? siteInfo.privacyVersion : siteInfo.termsVersion;
  const effective = page === 'privacy' ? siteInfo.privacyEffectiveDate : siteInfo.termsEffectiveDate;
  return <section className="content-panel feature-panel site-info">
    <div className="content-heading"><h1>{infoLabels[page]}</h1></div>
    {(page === 'privacy' || page === 'terms') && <p className="feature-muted">版本：{version} · {effective ? `生效日期：${effective}` : '生效日期未设置'}</p>}
    {page === 'about' && <>
      <p>云打字练习提供中英文长文逐行练习。</p>
      <p>{siteInfo.operator ? `运营主体：${siteInfo.operator}` : '运营主体尚未配置'}</p>
      {siteInfo.contactEmail ? <p>联系邮箱：<a href={`mailto:${siteInfo.contactEmail}`}>{siteInfo.contactEmail}</a></p> : <p>联系信息尚未配置，可使用站内反馈。</p>}
      <button className="outline-button" onClick={onFeedback}>功能反馈</button>
    </>}
    {sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
  </section>;
}
