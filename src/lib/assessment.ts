import type { UiLocale } from './i18n';
import { snapshotKey, type PracticeRecord, type ArticleSnapshot } from './models';
import { recordMistakes } from './analysis';
import { scoreTyping, splitCharacters } from './scoring';

// Original fixed material. A material/condition change requires a new version/id.
const assessmentText = 'The moon shines over a quiet lake.\nWe take small steps and learn each day.\nKeep a steady rhythm, then check your words.\nA new page is ready: one, two, three!';
export function assessmentArticle(locale: UiLocale): ArticleSnapshot {
 return {id:'assessment-english-v1',title:locale==='zh'?'入门基线与复测':'Baseline and retest',text:assessmentText,custom:true,language:'en',difficulty:'beginner',author:'TypeLune'};
}
export function isAssessmentArticle(article?: ArticleSnapshot) {
 return !!article && article.custom && article.id==='assessment-english-v1' && article.text===assessmentText && article.language==='en';
}
function ownedUnique(records:readonly PracticeRecord[],ownerId:string|null) {
 const seen=new Set<string>();
 return records.filter(r=>{
  if ((r.ownerId??null)!==ownerId) return false;
  const key=r.recordId ?? JSON.stringify([r.finishedAt,r.article?.id,r.typed,r.elapsedMs]);
  if(seen.has(key)) return false;
  seen.add(key); return true;
 });
}
export function assessmentProgress(records:readonly PracticeRecord[],ownerId:string|null) {
 const rounds=ownedUnique(records,ownerId).filter(r=>isAssessmentArticle(r.article) && r.language==='en' && r.mode==='article' && r.strict===false && (r.offset??0)===0 && typeof r.typed==='string' && splitCharacters(r.typed).length===splitCharacters(assessmentText).length && Number.isFinite(r.elapsedMs) && r.elapsedMs!>0 && Number.isFinite(r.finishedAt))
 .sort((a,b)=>a.finishedAt-b.finishedAt || (a.recordId??'').localeCompare(b.recordId??''))
 .map(r=>({...scoreTyping(assessmentText,r.typed!,r.elapsedMs!/1000),finishedAt:r.finishedAt,recordId:r.recordId}));
 return {count:rounds.length,baseline:rounds[0],latest:rounds.length>1?rounds[rounds.length-1]:undefined};
}
export function weakKeyTraining(records:readonly PracticeRecord[],ownerId:string|null,locale:UiLocale) {
 const counts=new Map<string,number>(); let sampled=false;
 const recent=ownedUnique(records,ownerId).filter(r=>r.language==='en' && r.article?.language==='en').sort((a,b)=>b.finishedAt-a.finishedAt).slice(0,20);
 for(const record of recent){
  const target=splitCharacters(record.article!.text);
  sampled ||= !!record.mistakesTruncated;
  for(const sample of recordMistakes(record,target)){
   if(!Number.isInteger(sample.position)||target[sample.position]!==sample.expected||sample.actual===sample.expected||!/^\x20*[!-~]$/.test(sample.expected)||sample.expected.length!==1) continue;
   counts.set(sample.expected,(counts.get(sample.expected)??0)+1);
  }
 }
 const keys=[...counts].map(([key,count])=>({key,count})).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key)).slice(0,5);
 if(!keys.length) return undefined;
 const sequence=keys.map(k=>k.key);
 const text=[...sequence.map(key=>Array(4).fill(key).join(' ')),Array(4).fill(sequence.join(' ')).join(' ')].join('\n');
 const article:ArticleSnapshot={id:'weak-keys-v1',title:locale==='zh'?'薄弱键短练习':'Weak-key practice',text,language:'en',difficulty:'beginner',custom:true,author:'TypeLune'};
 return {keys,sampled,article:{...article,id:snapshotKey(article).replace(':','-')}};
}
/** Only our generated ASCII short drills; never infer identity from a title. */
export function isWeakKeyArticle(article?: ArticleSnapshot) {
 if(!article?.custom || article.language!=='en' || article.text.length>240 || !/^[!-~\n ]+$/.test(article.text)) return false;
 return article.id===snapshotKey({...article,id:'weak-keys-v1'}).replace(':','-');
}
