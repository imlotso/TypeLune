import type { Language } from '../data/articles';
import { snapshotKey, type ArticleSnapshot } from './models';

export type SpecialDrillKind = 'numbers' | 'punctuation' | 'phrases';
export const specialDrillNames: Record<SpecialDrillKind, string> = { numbers: '数字', punctuation: '标点', phrases: '词组' };
// Original, fixed material: the same choice always produces the same text.
const material: Record<Language, Record<SpecialDrillKind, string[]>> = {
  zh: {
    numbers: ['0123456789 9876543210', '123 456 789 2026 1105', '3.14 0.75 18.6 42.08', '09:30 12:45 18:20', '１２３４５ ６７８９０'],
    punctuation: ['，。！？；：、', '“你好。”（请稍等）', '《山海》——远方……', ', . ! ? ; : ( )', '「微光」与〈风声〉'],
    phrases: ['山高水长，来日方长。', '微风拂面，云开见月。', '慢慢前行，不负时光。', '灯火可亲，平安喜乐。', '心有所向，步履不停。'],
  },
  en: {
    numbers: ['0123456789 9876543210', '123 456 789 2026 1105', '3.14 0.75 18.6 42.08', '09:30 12:45 18:20', '24,680 17,305 81.25%'],
    punctuation: ['Hello, world! Are you ready?', 'A small pause; a new start.', 'Use ( ) [ ] { } and : ;', 'It\'s clear: "yes" or "no".', 'One, two, three... go!'],
    phrases: ['a quiet morning', 'take a deep breath', 'a little more time', 'under the open sky', 'find your own rhythm', 'keep the light on'],
  },
};

export function createSpecialDrill(language: Language, kind: SpecialDrillKind): ArticleSnapshot {
  const article: ArticleSnapshot = { id: `special-${language}-${kind}`, title: `${language === 'zh' ? '中文' : '英文'}${specialDrillNames[kind]}专项`,
    text: material[language][kind].join('\n'), language, difficulty: 'beginner', custom: true, author: '自编素材' };
  return { ...article, id: snapshotKey(article).replace(':', '-') };
}
