import type { ArticleSnapshot, PracticeRecord } from './models';
import { createRoundMistakeDrill } from './analysis';
import { scoreTyping } from './scoring';
import type { UiLocale } from './i18n';

type Copy = { zh: string; en: string };
export type Lesson = { id: string; version: 1; title: Copy; focus: string; tip: Copy; text: string; chapterId?: string; exerciseNumber?: number };
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
// Extra rounds are new immutable IDs: the original v1 snapshots remain valid.
const extraRoundContent: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  ready: [
    ['左右交替', 'Alternating hands', 'f j f j f j f j\nj f j f j f j f\nfj jf fj jf fj jf\nf j fj j f jf'],
    ['双击节奏', 'Double-key rhythm', 'ff jj ff jj ff jj\njj ff jj ff jj ff\nff j ff j jj f jj f\nff jj fj jf ff jj'],
    ['三键组合', 'Three-key groups', 'fjf jfj fjf jfj\nffj jjf ffj jjf\nfjj jff fjj jff\nfjf ffj jfj jjf'],
    ['定位小测', 'Position check', 'fj jf ff jj fjf jfj\njf fj jj ff jfj fjf\nfjj ffj jff jjf fj jf\nf j ff jj fjf jfj'],
  ],
  home: [
    ['食指与中指', 'Index and middle fingers', 'df jk df jk fd kj\ndd ff jj kk df jk\ndfj kjf dkj fjd\ndf jk fd kj ff jj'],
    ['无名指与小指', 'Ring and little fingers', 'as l; as l; sa ;l\naa ss ll ;; as l;\nask lad sad fall\nsalad flask lads ask'],
    ['食指横向伸展', 'Index finger reaches', 'fg jh fg jh gf hj\nfgf jhj fgf jhj\nash glad half glass\ndash flash shall glad'],
    ['基准键巩固', 'Home row consolidation', 'a lad asks dad\na glad lass adds glass\nfall ash dash flask\nhalf a glass; a salad'],
  ],
  upper: [
    ['食指向上伸展', 'Index finger reaches up', 'fr ft ju jy fr ft ju jy\nfrf ftf juj jyj\nfry try jury furry\ntruth trust just duty'],
    ['中指与无名指', 'Middle and ring reaches', 'de ki sw lo de ki sw lo\nded kik sws lol\nride like wide slow\nwrite style little yellow'],
    ['小指与跨排', 'Little fingers and row changes', 'aq ;p aq ;p aqa ;p;\nquiet paper proper quality\nwe are quite ready\nyour reply is quite short'],
    ['上排综合', 'Top row consolidation', 'type a quiet reply\nwe read your short story\nour writer likes the idea\nyou are ready for a fresh start'],
  ],
  lower: [
    ['食指向下伸展', 'Index fingers reach down', 'fv fb jn jm fv fb jn jm\nfvf fbf jnj jmj\nmove mind brave bring\nfind a calm moment'],
    ['其余手指下排', 'Other bottom row reaches', 'az sx dc az sx dc\naza sxs dcd zxc zxc\ncalm mix zebra exact\na box can move fast'],
    ['三排切换', 'Changing between three rows', 'read calm words slowly\nbring a box back home\nzebras move beyond the hill\nkeep every finger relaxed'],
    ['全字母巩固', 'Alphabet consolidation', 'a quick brown fox jumps\nwe visit a quiet garden\nsix zebras walk beyond the lake\nmy fingers find their way home'],
  ],
  words: [
    ['常见词组合', 'Common word groups', 'the and for with from\nthis that your their our\nlook learn make take give\nsmall words build steady rhythm'],
    ['短语节奏', 'Phrase rhythm', 'a little more time\none step at a time\nunder a clear blue sky\nfind your own steady pace'],
    ['容易混淆的词', 'Similar word practice', 'form from form from\nquiet quite quiet quite\nthere their there their\nread each word before you type'],
    ['连贯词组', 'Connected word groups', 'leave a small space between words\nkeep a calm and steady rhythm\nlet your eyes follow the next word\naccuracy comes before speed'],
  ],
  case: [
    ['左右 Shift 配合', 'Opposite-hand Shift', 'Ff Jj Dd Kk Ss Ll Aa\nRr Uu Tt Yy Vv Mm Bb Nn\nAda Julia Sam Kim\nUse Both Shift Keys'],
    ['姓名与地名', 'Names and places', 'Ada and Julia\nSam visits London\nKim travels to Paris\nLuna and Robin meet in York'],
    ['句首大写', 'Sentence-start capitals', 'A quiet morning\nThe sky is clear\nWe learn a little each day\nSmall steps bring steady progress'],
    ['大小写巩固', 'Case consolidation', 'Hello Luna\nRead Then Type\nA New Day In London\nKeep Your Hands Relaxed\nOne Step At A Time'],
  ],
  punctuation: [
    ['数字分组', 'Number groups', '11 22 33 44 55\n66 77 88 99 00\n12 34 56 78 90\n2026 1030 2468 1357'],
    ['常用标点', 'Common punctuation', 'One, two, three.\nStop; take a breath.\nReady? Yes!\nKeep going, one word at a time.'],
    ['日期与时间', 'Dates and times', 'Date: 2026-11-16.\nTime: 09:30.\nLesson 7: 95% accuracy.\nRead 12 words in 30 seconds.'],
    ['符号巩固', 'Symbol consolidation', 'Note (1): "Try again."\nScore: 98%; time: 45s.\nIs 2 + 3 = 5? Yes!\nSave $5, then take a break.'],
  ],
  sentences: [
    ['短句节奏', 'Short sentence rhythm', 'The sun rises over the lake.\nA gentle wind moves the leaves.\nKeep your shoulders relaxed.\nRead ahead, then type calmly.'],
    ['问答句', 'Questions and answers', 'Are you ready to begin?\nYes, I am ready for lesson 8.\nWhat matters more than speed?\nAccuracy comes first.'],
    ['短段落', 'Short paragraph', 'Luna opens a book by the window. The room is quiet, and the light is soft. She takes a slow breath and begins a new page.\nSmall, careful steps make a real difference.'],
    ['综合小测', 'Final practice check', 'Today is a good day to learn something new.\nAt 09:30, we begin a short practice session.\n"Stay calm," says Luna. "Aim for 95% accuracy."\nCan you finish with a steady rhythm?'],
  ],
};
const exercisesByChapter = new Map(lessons.map(chapter => [chapter.id, [chapter, ...extraRoundContent[chapter.id].map(([zh, en, text], index): Lesson => ({
  ...chapter, id: `${chapter.id}-${index + 2}`, chapterId: chapter.id, exerciseNumber: index + 2,
  title: { zh, en }, text,
}))] as readonly Lesson[]]));
const allExercises = [...exercisesByChapter.values()].flat();
/** Resolve an exercise to its original chapter without rewriting old snapshots. */
export function lessonChapter(lesson: Lesson): Lesson {
  return lessons.find(chapter => chapter.id === (lesson.chapterId ?? lesson.id)) ?? lesson;
}
/** The original warm-up followed by four optional, progressively richer rounds. */
export function lessonExercises(lesson: Lesson): readonly Lesson[] {
  return exercisesByChapter.get(lessonChapter(lesson).id) ?? [lesson];
}
export function chapterExerciseProgress(records: readonly PracticeRecord[], ownerId: string | null, chapter: Lesson) {
  const rounds = lessonExercises(chapter);
  const byLesson: Record<string, { accuracy: number; completed: boolean }> = {};
  for (const record of records) {
    if ((record.ownerId ?? null) !== ownerId) continue;
    const outcome = lessonOutcome(record);
    if (!outcome || !rounds.some(round => round.id === outcome.lesson.id)) continue;
    const previous = byLesson[outcome.lesson.id];
    byLesson[outcome.lesson.id] = { accuracy: Math.max(previous?.accuracy ?? 0, outcome.accuracy), completed: !!previous?.completed || outcome.completed };
  }
  const completed = rounds.filter(round => byLesson[round.id]?.completed).map(round => round.id);
  return { byLesson, completed, next: rounds.find(round => !completed.includes(round.id)) ?? rounds[rounds.length - 1] };
}

export const lessonCopy = (copy: Copy, locale: UiLocale) => copy[locale];
export function lessonArticle(lesson: Lesson, locale: UiLocale): ArticleSnapshot {
  return { id: 'lesson-' + lesson.id + '-v' + lesson.version, title: lessonCopy(lesson.title, locale), text: lesson.text,
    language: 'en', difficulty: 'beginner', custom: true, author: 'TypeLune' };
}
export function lessonForArticle(article?: ArticleSnapshot) {
  return article?.custom ? allExercises.find((lesson) => article.id === 'lesson-' + lesson.id + '-v' + lesson.version && article.text === lesson.text && article.language === 'en') : undefined;
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
  const next = allExercises[allExercises.indexOf(outcome.lesson) + 1];
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
