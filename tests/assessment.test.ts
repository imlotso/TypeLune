import { describe, it, expect } from 'vitest';
import { assessmentArticle, assessmentProgress, weakKeyTraining, isAssessmentArticle, isWeakKeyArticle } from '../src/lib/assessment';
import type { PracticeRecord } from '../src/lib/models';
const make = (overrides: Partial<PracticeRecord> = {}): PracticeRecord => {
 const article = assessmentArticle('en');
 return { article, typed: article.text, ownerId: null, recordId: 'a', language:'en', difficulty:'beginner', duration:300, mode:'article', strict:false, elapsedMs:60000, speed:0, accuracy:0, finishedAt:1, ...overrides };
};
describe('personal assessment', () => {
 it('has stable private versioned material independent of UI locale', () => {
  expect(assessmentArticle('zh').text).toBe(assessmentArticle('en').text);
  expect(assessmentArticle('en').custom).toBe(true);
 });
 it('compares first baseline with latest valid same-condition full attempt, recomputing scores', () => {
  const result=assessmentProgress([make({recordId:'b',finishedAt:2,elapsedMs:30000}),make()],null);
  expect(result.count).toBe(2); expect(result.baseline?.accuracy).toBe(100);
  expect(result.latest!.wpm).toBeCloseTo(result.baseline!.wpm*2,1);
 });
 it('excludes other identities, partials, changed text, timed, strict and resumed segments', () => {
  const valid=make();
    const invalid=[make({ownerId:'other'}),make({typed:'short'}),make({strict:true}),make({mode:'timed'}),make({offset:1}),make({elapsedMs:NaN}),make({article:{...valid.article!,text:'changed'}})];
  invalid.forEach((r,i)=>{r.recordId='invalid-'+i;expect(assessmentProgress([r],null).count).toBe(0);});
  expect(assessmentProgress([valid,...invalid],null).count).toBe(1);
  expect(assessmentProgress([valid],'other').count).toBe(0);
 });
});
describe('weak key training', () => {
 it('returns no made-up exercise without actual current-owner English errors', () => {
  expect(weakKeyTraining([],null,'en')).toBeUndefined();
  expect(weakKeyTraining([make({ownerId:'other',mistakes:[{position:0,expected:'T',actual:'x'}]})],null,'en')).toBeUndefined();
 });
 it('uses verified error positions, counts corrected errors and ignores invalid samples', () => {
  const r=make({mistakes:[{position:0,expected:'T',actual:'x'},{position:0,expected:'T',actual:'x'},{position:1,expected:'INVALID',actual:'x'}]});
  const drill=weakKeyTraining([r],null,'en')!;
  expect(drill.keys).toEqual([{key:'T',count:2}]);
  expect(drill.article.custom).toBe(true); expect(drill.article.text).toContain('T');
  expect(drill.article.text.length).toBeLessThanOrEqual(240);
  expect(weakKeyTraining([r,r],null,'en')!.keys).toEqual(drill.keys);
 });
 it('can recover actual errors from typed text and excludes Chinese IME records', () => {
  const r=make({typed:'x'+assessmentArticle('en').text.slice(1)});
  expect(weakKeyTraining([r],null,'zh')!.keys[0].key).toBe('T');
  expect(weakKeyTraining([{...r,language:'zh'}],null,'en')).toBeUndefined();
 });
});
it('recognizes exact assessment and generated drill snapshots only',()=>{
 const article=assessmentArticle('en');
 expect(isAssessmentArticle(article)).toBe(true);
 expect(isAssessmentArticle({...article,custom:false})).toBe(false);
 expect(isAssessmentArticle({...article,text:article.text+'x'})).toBe(false);
 const drill=weakKeyTraining([make({typed:'x'+article.text.slice(1)})],null,'en')!.article;
 expect(isWeakKeyArticle(drill)).toBe(true);
 expect(isWeakKeyArticle({...drill,custom:false})).toBe(false);
 expect(isWeakKeyArticle({...drill,text:drill.text+'x'})).toBe(false);
});
