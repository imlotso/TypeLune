import { helpSections, helpSectionsEn, infoLabels, infoLabelsEn, privacySections, privacySectionsEn, siteInfo, termsSections, termsSectionsEn } from '../data/site-content.js';

export const footerButtonIds = ['help', 'feedback', 'privacy', 'terms', 'about'] as const;
export type FooterButtonId = typeof footerButtonIds[number];

export type FooterButtonConfig = {
  id: FooterButtonId;
  labelZh: string;
  labelEn: string;
  enabled: boolean;
  mode: 'page' | 'link';
  url: string;
  openInNewTab: boolean;
};

export type FooterPageContent = {
  zh: string;
  en: string;
};

export type FooterAttribution = {
  enabled: boolean;
  prefix: string;
  label: string;
  url: string;
};

export type FooterExtraLink = {
  id: string;
  labelZh: string;
  labelEn: string;
  url: string;
  enabled: boolean;
  openInNewTab: boolean;
};

export type FooterSettings = {
  buttons: FooterButtonConfig[];
  pages: Record<FooterButtonId, FooterPageContent>;
  attribution: FooterAttribution;
  extraLinks: FooterExtraLink[];
};

export type FooterSnapshot = {
  settings: FooterSettings;
  revision: number;
};

export function defaultPageMarkdown(id: FooterButtonId, locale: 'zh' | 'en'): string {
  if (id === 'help') {
    const sections = locale === 'en' ? helpSectionsEn : helpSections;
    return sections.map(([heading, body]) => `## ${heading}\n\n${body}`).join('\n\n');
  }
  if (id === 'privacy') {
    const sections = locale === 'en' ? privacySectionsEn : privacySections;
    const meta = locale === 'en'
      ? `> Version: ${siteInfo.privacyVersion} · Effective: ${siteInfo.privacyEffectiveDate || 'Not set'}`
      : `> 版本：${siteInfo.privacyVersion} · 生效日期：${siteInfo.privacyEffectiveDate || '未设置'}`;
    return `${meta}\n\n${sections.map(([heading, body]) => `## ${heading}\n\n${body}`).join('\n\n')}`;
  }
  if (id === 'terms') {
    const sections = locale === 'en' ? termsSectionsEn : termsSections;
    const meta = locale === 'en'
      ? `> Version: ${siteInfo.termsVersion} · Effective: ${siteInfo.termsEffectiveDate || 'Not set'}`
      : `> 版本：${siteInfo.termsVersion} · 生效日期：${siteInfo.termsEffectiveDate || '未设置'}`;
    return `${meta}\n\n${sections.map(([heading, body]) => `## ${heading}\n\n${body}`).join('\n\n')}`;
  }
  if (id === 'about') {
    if (locale === 'en') {
      const lines = [
        '## About TypeLune',
        '',
        'TypeLune offers line-by-line typing practice with long Chinese and English articles.',
        '',
        siteInfo.operator ? `- **Operator**: ${siteInfo.operator}` : '- **Operator**: Not configured',
        siteInfo.contactEmail
          ? `- **Contact email**: [${siteInfo.contactEmail}](mailto:${siteInfo.contactEmail})`
          : '- **Contact**: Use site feedback.',
      ];
      return lines.join('\n');
    }
    const lines = [
      '## 关于 TypeLune',
      '',
      'TypeLune 提供中英文长文逐行练习。',
      '',
      siteInfo.operator ? `- **运营主体**：${siteInfo.operator}` : '- **运营主体**：尚未配置',
      siteInfo.contactEmail
        ? `- **联系邮箱**：[${siteInfo.contactEmail}](mailto:${siteInfo.contactEmail})`
        : '- **联系方式**：可通过站内反馈联系。',
    ];
    return lines.join('\n');
  }
  return '';
}

export function defaultFooterSettings(): FooterSettings {
  return {
    buttons: [
      { id: 'help', labelZh: infoLabels.help, labelEn: infoLabelsEn.help, enabled: true, mode: 'page', url: '', openInNewTab: false },
      { id: 'feedback', labelZh: '功能反馈', labelEn: 'Feedback', enabled: true, mode: 'page', url: '', openInNewTab: false },
      { id: 'privacy', labelZh: infoLabels.privacy, labelEn: infoLabelsEn.privacy, enabled: true, mode: 'page', url: '', openInNewTab: false },
      { id: 'terms', labelZh: infoLabels.terms, labelEn: infoLabelsEn.terms, enabled: true, mode: 'page', url: '', openInNewTab: false },
      { id: 'about', labelZh: infoLabels.about, labelEn: infoLabelsEn.about, enabled: true, mode: 'page', url: '', openInNewTab: false },
    ],
    pages: {
      help: { zh: '', en: '' },
      feedback: { zh: '', en: '' },
      privacy: { zh: '', en: '' },
      terms: { zh: '', en: '' },
      about: { zh: '', en: '' },
    },
    attribution: {
      enabled: true,
      prefix: 'Powered by',
      label: 'SiteTalk',
      url: 'https://www.sitetalk.net',
    },
    extraLinks: [],
  };
}

export function isSafeFooterUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return !trimmed.startsWith('//');
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}
