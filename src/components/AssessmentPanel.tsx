import { assessmentArticle, assessmentProgress, weakKeyTraining } from '../lib/assessment';
import { useI18n } from '../lib/i18n';
import type { ArticleSnapshot, PracticeRecord } from '../lib/models';
import '../assessment.css';
type Props={records:readonly PracticeRecord[];ownerId:string|null;onSelect:(article:ArticleSnapshot)=>void};
export function AssessmentPanel({records,ownerId,onSelect}:Props){
 const {t,locale}=useI18n(); const {baseline,latest}=assessmentProgress(records,ownerId);
 const delta=(n:number)=>`${n>0?'+':''}${n.toFixed(1)}`;
 return <section className="training-panel" aria-label={t('基线与复测','Baseline and retest')}>
  <div className="training-panel-heading"><h2>{t('基线与复测','Baseline and retest')}</h2><button className="text-button" onClick={()=>onSelect(assessmentArticle(locale))}>{baseline?t('开始复测','Open retest'):t('建立基线','Open baseline')}</button></div>
  <p className="feature-muted">{t('固定英文全文 · 非严格模式 · 不上榜','Fixed English text · non-strict · unranked')}</p>
  {baseline ? <div className="training-comparison"><span>{t('首次','First')} <strong>{baseline.wpm} WPM · {baseline.accuracy}%</strong></span>{latest && <span>{t('最近','Latest')} <strong>{latest.wpm} WPM · {latest.accuracy}%</strong><small>{delta(latest.wpm-baseline.wpm)} WPM · {delta(latest.accuracy-baseline.accuracy)} {t('百分点','percentage points')}</small></span>}</div>:<p>{t('完成一次全文后建立个人基线。','Complete the full text to set your baseline.')}</p>}
  <small className="feature-muted">{t('仅比较本账号已加载的完整同条件记录；不是能力认证。','Compares loaded, complete same-condition records for this identity; not a certification.')}</small>
 </section>;
}
export function WeakKeyPanel({records,ownerId,onSelect}:Props){
 const {t,locale}=useI18n(); const drill=weakKeyTraining(records,ownerId,locale);
 return <section className="training-panel" aria-label={t('薄弱键训练','Weak-key training')}>
  <div className="training-panel-heading"><h2>{t('薄弱键训练','Weak-key training')}</h2>{drill&&<button className="text-button" onClick={()=>onSelect(drill.article)}>{t('练习这些键','Practice these keys')}</button>}</div>
  {drill ? <><div className="training-keys">{drill.keys.map(({key,count})=><span key={key}><kbd>{key}</kbd><small>×{count}</small></span>)}</div><small className="feature-muted">{t('最近 20 次英文记录中的错误次数，不代表逐键速度。','Error counts from up to 20 recent English records, not per-key speed.')}{drill.sampled&&t(' 部分记录仅保留错误样本。',' Some records contain sampled errors only.')}</small></>:<p className="feature-muted">{t('还没有记录到英文按键错误。','No recorded English key errors yet.')}</p>}
 </section>;
}
