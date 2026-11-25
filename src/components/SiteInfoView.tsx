import { useMemo } from 'react';
import { useI18n } from '../lib/i18n';
import { infoLabels, infoLabelsEn, helpSections, helpSectionsEn, privacySections, privacySectionsEn, siteInfo, termsSections, termsSectionsEn, type InfoPage } from '../data/site-content';
import { useSiteFooter } from '../hooks/useSiteFooter';
import { renderMarkdownToHtml } from '../lib/markdown';

export function SiteInfoView({ page, onFeedback }: { page: InfoPage; onFeedback: () => void }) {
  const { t, locale } = useI18n();
  const footer = useSiteFooter();
  const buttonConfig = footer.buttons.find((item) => item.id === page);
  const title = buttonConfig
    ? (locale === 'en' ? (buttonConfig.labelEn || infoLabelsEn[page]) : (buttonConfig.labelZh || infoLabels[page]))
    : t(infoLabels[page], infoLabelsEn[page]);
  const customMarkdown = (locale === 'en' ? (footer.pages[page]?.en || footer.pages[page]?.zh) : (footer.pages[page]?.zh || footer.pages[page]?.en))?.trim() ?? '';
  const customHtml = useMemo(() => (customMarkdown ? renderMarkdownToHtml(customMarkdown) : ''), [customMarkdown]);

  if (customHtml) {
    return <section className="content-panel feature-panel site-info">
      <div className="content-heading"><h1>{title}</h1></div>
      <div className="markdown-body" dangerouslySetInnerHTML={{ __html: customHtml }} />
      {page === 'about' && <div className="site-info-actions"><button className="outline-button" onClick={onFeedback}>{t("功能反馈", "Feedback")}</button></div>}
    </section>;
  }

  const sections = page === 'help' ? (locale === 'en' ? helpSectionsEn : helpSections) : page === 'privacy' ? (locale === 'en' ? privacySectionsEn : privacySections) : page === 'terms' ? (locale === 'en' ? termsSectionsEn : termsSections) : [];
  const version = page === 'privacy' ? siteInfo.privacyVersion : siteInfo.termsVersion;
  const effective = page === 'privacy' ? siteInfo.privacyEffectiveDate : siteInfo.termsEffectiveDate;
  return <section className="content-panel feature-panel site-info">
    <div className="content-heading"><h1>{title}</h1></div>
    {(page === 'privacy' || page === 'terms') && <p className="feature-muted">{t("版本：", "Version:")}{version} · {effective ? t(`生效日期：${effective}`,`Effective: ${effective}`) : t("生效日期未设置", "Effective date not set")}</p>}
    {page === 'about' && <>
      <p>{t("TypeLune 提供中英文长文逐行练习。", "TypeLune offers line-by-line typing practice with long Chinese and English articles.")}</p>
      <p>{siteInfo.operator ? t(`运营主体：${siteInfo.operator}`,`Operator: ${siteInfo.operator}`) : t("运营主体尚未配置", "Operator not configured")}</p>
      {siteInfo.contactEmail ? <p>{t("联系邮箱：", "Contact email:")}<a href={`mailto:${siteInfo.contactEmail}`}>{siteInfo.contactEmail}</a></p> : <p>{t("联系信息尚未配置，可使用站内反馈。", "Contact details are not configured. Use site feedback.")}</p>}
      <button className="outline-button" onClick={onFeedback}>{t("功能反馈", "Feedback")}</button>
    </>}
    {sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
  </section>;
}
