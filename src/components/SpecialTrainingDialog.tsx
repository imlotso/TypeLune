import { useI18n } from '../lib/i18n';
import { useState } from 'react';
import type { Language } from '../data/articles';
import type { ArticleSnapshot } from '../lib/models';
import { createSpecialDrill, specialDrillNames, type SpecialDrillKind } from '../lib/special-training';
import { Dialog } from './Dialog';

export function SpecialTrainingDialog({ language: initialLanguage, onSelect, onClose }: { language: Language; onSelect: (article: ArticleSnapshot) => void; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [kind, setKind] = useState<SpecialDrillKind>('numbers');
  const article = createSpecialDrill(language, kind);
  return <Dialog title={t("专项练习", "Focused drills")} onClose={onClose}>
    <div className="feature-form">
      <div className="feature-form-pair">
        <label>{t("语言", "Language")}<select aria-label={t("专项语言", "Drill language")} value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="zh">{t("中文", "Chinese")}</option><option value="en">English</option></select></label>
        <label>{t("类型", "Type")}<select aria-label={t("专项类型", "Drill type")} value={kind} onChange={(event) => setKind(event.target.value as SpecialDrillKind)}>{Object.entries(specialDrillNames).map(([value, label]) => <option key={value} value={value}>{t(label, ({numbers:"Numbers",punctuation:"Punctuation",phrases:"Phrases"})[value as SpecialDrillKind])}</option>)}</select></label>
      </div>
      <p className="feature-muted">{t("素材：自编固定练习", "Original fixed drills")}</p>
      <pre className="special-training-preview" aria-label={t("专项素材", "Drill material")}>{article.text}</pre>
      <p className="feature-muted">{t("个人练习，不参与排行", "Private practice. Not ranked.")}</p>
      <div className="feature-actions"><button type="button" className="primary-button" onClick={() => onSelect(article)}>{t("使用专项", "Use drill")}</button></div>
    </div>
  </Dialog>;
}
