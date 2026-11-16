import { describe, expect, it } from 'vitest';
import { lessons, lessonArticle, lessonForArticle, courseProgress, lessonRecommendation, keyHint } from '../src/lib/lessons';
import type { PracticeRecord } from '../src/lib/models';

function record(index = 0, overrides: Partial<PracticeRecord> = {}): PracticeRecord {
  const article = lessonArticle(lessons[index], 'zh');
  return { recordId: 'r', ownerId: null, article, typed: article.text, language: 'en', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 100, finishedAt: 100, ...overrides };
}
describe('beginner course', () => {
  it('provides versioned original personal material without changing when UI language changes', () => {
    expect(lessons).toHaveLength(8);
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(8);
    for (const lesson of lessons) {
      const zh = lessonArticle(lesson, 'zh'), en = lessonArticle(lesson, 'en');
      expect(zh.id).toBe('lesson-' + lesson.id + '-v1');
      expect(zh.custom).toBe(true);
      expect(zh.text).toBe(en.text);
      expect(zh.title).not.toBe(en.title);
      expect(zh.text.length).toBeGreaterThan(20);
      expect(lessonForArticle(en)?.id).toBe(lesson.id);
      expect(lessonForArticle({ ...en, text: en.text + ' edited' })).toBeUndefined();
      expect(lessonForArticle({ ...en, custom: false })).toBeUndefined();
    }
  });
  it('counts only full accurate current-version rounds owned by the current identity', () => {
    const good = record();
    const partial = record(1, { typed: 'asdf', accuracy: 100 });
    const forgedAccuracy = record(2, { typed: 'x'.repeat(lessonArticle(lessons[2], 'en').text.length), accuracy: 100 });
    const otherOwner = record(3, { ownerId: 'alice' });
    const stale = record(4); stale.article = { ...stale.article!, text: 'outdated' }; stale.typed = 'outdated';
    const progress = courseProgress([good, partial, forgedAccuracy, otherOwner, stale], null);
    expect(progress.completed).toEqual([lessons[0].id]);
    expect(progress.next.id).toBe(lessons[1].id);
    expect(progress.byLesson[lessons[0].id].accuracy).toBe(100);
    expect(courseProgress([good, otherOwner], 'alice').completed).toEqual([lessons[3].id]);
    expect(courseProgress(lessons.map((_, i) => record(i)), null).next.id).toBe(lessons[7].id);
  });
  it('recommends real round mistakes, a retry for partial input, or the next lesson', () => {
    expect(lessonRecommendation(record()).kind).toBe('next');
    const mistake = record(0, { mistakes: [{ position: 0, expected: 'f', actual: 'x' }] });
    expect(lessonRecommendation(mistake).kind).toBe('review');
    expect(lessonRecommendation(record(0, { typed: 'f' })).kind).toBe('retry');
    expect(lessonRecommendation(record(7)).lesson?.id).toBe('sentences-2');
    expect(lessonRecommendation({ ...record(), article: undefined }).kind).toBe('none');
  });
  it('maps keys as static hints including case, punctuation and whitespace', () => {
    expect(keyHint('f', 'en')).toEqual(expect.objectContaining({ key: 'F', shift: false, finger: 'Left index' }));
    expect(keyHint('J', 'en')).toEqual(expect.objectContaining({ key: 'J', shift: true, finger: 'Right index' }));
    expect(keyHint('?', 'zh')).toEqual(expect.objectContaining({ key: '/', shift: true }));
    expect(keyHint(' ', 'en')?.key).toBe('Space');
    expect(keyHint('\n', 'en')?.key).toBe('Enter');
    expect(keyHint('中', 'zh')).toBeUndefined();
    expect(keyHint(undefined, 'zh')).toBeUndefined();
  });
});
