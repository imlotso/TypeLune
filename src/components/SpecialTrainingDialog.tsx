import { useState } from 'react';
import type { Language } from '../data/articles';
import type { ArticleSnapshot } from '../lib/models';
import { createSpecialDrill, specialDrillNames, type SpecialDrillKind } from '../lib/special-training';
import { Dialog } from './Dialog';

export function SpecialTrainingDialog({ language: initialLanguage, onSelect, onClose }: { language: Language; onSelect: (article: ArticleSnapshot) => void; onClose: () => void }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [kind, setKind] = useState<SpecialDrillKind>('numbers');
  const article = createSpecialDrill(language, kind);
  return <Dialog title="专项练习" onClose={onClose}>
    <div className="feature-form">
      <div className="feature-form-pair">
        <label>语言<select aria-label="专项语言" value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="zh">中文</option><option value="en">English</option></select></label>
        <label>类型<select aria-label="专项类型" value={kind} onChange={(event) => setKind(event.target.value as SpecialDrillKind)}>{Object.entries(specialDrillNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <p className="feature-muted">素材：自编固定练习</p>
      <pre className="special-training-preview" aria-label="专项素材">{article.text}</pre>
      <p className="feature-muted">个人练习，不参与排行</p>
      <div className="feature-actions"><button type="button" className="primary-button" onClick={() => onSelect(article)}>使用专项</button></div>
    </div>
  </Dialog>;
}
