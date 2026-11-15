import type { ArticleSnapshot, PracticeRecord } from './models';
import { createRoundMistakeDrill } from './analysis';
import { scoreTyping } from './scoring';
import type { UiLocale } from './i18n';

type Copy = { zh: string; en: string };
export type Lesson = { id: string; version: 1; title: Copy; focus: string; tip: Copy; text: string };
export const lessons: readonly Lesson[] = [
  { id: 'ready', version: 1, title: { zh: '准备与定位', en: 'Ready position' }, focus: 'F · J',
    tip: { zh: '双脚自然落地，肩膀放松。食指轻触 F、J 凸点，手腕保持自然。', en: 'Feet supported, shoulders relaxed. Rest index fingers on the F and J bumps; keep wrists neutral.' },
    text: 'fj fj jf jf ff jj fj jf\nfjf jfj fjf jfj ff jj' },
  { id: 'home', version: 1, title: { zh: '基准键', en: 'Home row' }, focus: 'ASDF · JKL;',
    tip: { zh: '左手 ASDF，右手 JKL;。每次击键后回到基准位置。', en: 'Left hand on ASDF, right hand on JKL;. Return to the home row after each key.' },
    text: 'asdf jkl; asdf jkl;\naa ss dd ff jj kk ll ;;\nfad lad ask flask; salad' },
  { id: 'upper', version: 1, title: { zh: '上排键', en: 'Top row' }, focus: 'QWERTY · UIOP',
    tip: { zh: '从基准键向上伸指，击键后回位。不必追求速度。', en: 'Reach up from the home row, then return. Prioritize accuracy over speed.' },
    text: 'qwer tyui op qwer tyui op\nwe are quiet you are ready\nwrite a reply type a word' },
  { id: 'lower', version: 1, title: { zh: '下排键', en: 'Bottom row' }, focus: 'ZXCV · BNM',
    tip: { zh: '从基准键向下伸指，拇指负责空格。', en: 'Reach down from the home row. Use a thumb for spaces.' },
    text: 'zxcv bnm zxcv bnm\nmix a box move a van\ncalm waves move beyond' },
  { id: 'words', version: 1, title: { zh: '词组与节奏', en: 'Words and rhythm' }, focus: 'words · spaces',
    tip: { zh: '按词组连续输入，保留真实空格。先打准，再提速。', en: 'Type in short word groups with real spaces. Build accuracy first.' },
    text: 'a calm morning\nunder the blue sky\nfind a quiet place\nsmall steps each day' },
  { id: 'case', version: 1, title: { zh: '大小写', en: 'Upper and lower case' }, focus: 'Shift · Aa',
    tip: { zh: '大写字母用 Shift 配合字母键；可用另一只手按 Shift。', en: 'Hold Shift for capital letters, using the opposite hand when comfortable.' },
    text: 'Aa Bb Cc Dd Ee Ff\nHello Luna\nA Quiet Morning\nWe Learn One Step At A Time' },
  { id: 'punctuation', version: 1, title: { zh: '数字与标点', en: 'Numbers and punctuation' }, focus: '123 · , . ! ?',
    tip: { zh: '留意逗号、句号和空格。上档符号需要 Shift。', en: 'Watch commas, periods and spaces. Use Shift for upper symbols.' },
    text: '123 456 789 0\nOne, two, three.\nReady? Yes!\nTime: 09:30. Score: 95%.' },
  { id: 'sentences', version: 1, title: { zh: '短句练习', en: 'Short sentences' }, focus: 'Aa · words · punctuation',
    tip: { zh: '综合大小写、空格与标点。目标准确率 95%。', en: 'Combine capitals, spaces and punctuation. Aim for 95% accuracy.' },
    text: 'The moon is bright tonight.\nTake a breath, then try again.\nSmall steps make steady progress.\nAre you ready for a new page?' },
];
export const lessonCopy = (copy: Copy, locale: UiLocale) => copy[locale];
export function lessonArticle(lesson: Lesson, locale: UiLocale): ArticleSnapshot {
  return { id: 'lesson-' + lesson.id + '-v' + lesson.version, title: lessonCopy(lesson.title, locale), text: lesson.text,
    language: 'en', difficulty: 'beginner', custom: true, author: 'TypeLune' };
}
export function lessonForArticle(article?: ArticleSnapshot) {
  return article?.custom ? lessons.find((lesson) => article.id === 'lesson-' + lesson.id + '-v' + lesson.version && article.text === lesson.text && article.language === 'en') : undefined;
}
export function lessonOutcome(record: PracticeRecord) {
  const lesson = lessonForArticle(record.article);
  if (!lesson || typeof record.typed !== 'string') return undefined;
  const accuracy = scoreTyping(lesson.text, record.typed, 1).accuracy;
  return { lesson, accuracy, completed: record.typed.length === lesson.text.length && accuracy >= 95 };
}
export function courseProgress(records: readonly PracticeRecord[], ownerId: string | null) {
  const byLesson: Record<string, { accuracy: number; completed: boolean }> = {};
  for (const record of records) {
    if ((record.ownerId ?? null) !== ownerId) continue;
    const outcome = lessonOutcome(record);
    if (!outcome) continue;
    const previous = byLesson[outcome.lesson.id];
    byLesson[outcome.lesson.id] = { accuracy: Math.max(previous?.accuracy ?? 0, outcome.accuracy), completed: !!previous?.completed || outcome.completed };
  }
  const completed = lessons.filter((lesson) => byLesson[lesson.id]?.completed).map((lesson) => lesson.id);
  return { byLesson, completed, next: lessons.find((lesson) => !completed.includes(lesson.id)) ?? lessons[lessons.length - 1] };
}
export function lessonRecommendation(record: PracticeRecord): { kind: 'none' | 'retry' | 'review' | 'next' | 'complete'; lesson?: Lesson; drill?: ArticleSnapshot } {
  const outcome = lessonOutcome(record);
  if (!outcome) return { kind: 'none' };
  const drill = createRoundMistakeDrill(record, 3);
  if (drill) return { kind: 'review', lesson: outcome.lesson, drill };
  if (!outcome.completed) return { kind: 'retry', lesson: outcome.lesson };
  const next = lessons[lessons.indexOf(outcome.lesson) + 1];
  return next ? { kind: 'next', lesson: next } : { kind: 'complete', lesson: outcome.lesson };
}

const fingerGroups = [
  { keys: 'qaz1', zh: '左手小指', en: 'Left little' }, { keys: 'wsx2', zh: '左手无名指', en: 'Left ring' },
  { keys: 'edc3', zh: '左手中指', en: 'Left middle' }, { keys: 'rfvtgb45', zh: '左手食指', en: 'Left index' },
  { keys: 'yhnujm67', zh: '右手食指', en: 'Right index' }, { keys: 'ik,8', zh: '右手中指', en: 'Right middle' },
  { keys: 'ol.9', zh: '右手无名指', en: 'Right ring' }, { keys: "p;/'[]\\-=0", zh: '右手小指', en: 'Right little' },
];
const shifted: Record<string, string> = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', ':': ';', '"': "'", '?': '/', '<': ',', '>': '.', '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\' };
export function keyHint(character: string | undefined, locale: UiLocale) {
  if (!character) return undefined;
  if (character === ' ') return { key: locale === 'zh' ? '空格' : 'Space', finger: locale === 'zh' ? '拇指' : 'Thumb', shift: false };
  if (character === '\n') return { key: locale === 'zh' ? '回车' : 'Enter', finger: locale === 'zh' ? '右手小指' : 'Right little', shift: false };
  const base = shifted[character] ?? character.toLowerCase();
  const finger = fingerGroups.find((group) => group.keys.includes(base));
  return finger ? { key: base.toUpperCase(), finger: finger[locale], shift: !!shifted[character] || /[A-Z]/.test(character) } : undefined;
}
