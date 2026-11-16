import { describe, expect, it } from 'vitest';
import * as course from '../src/lib/lessons';
import type { PracticeRecord } from '../src/lib/models';
const record = (lesson: course.Lesson, ownerId: string | null = null): PracticeRecord => {
  const article = course.lessonArticle(lesson, 'en');
  return { recordId: lesson.id, ownerId, article, typed: article.text, language: 'en', difficulty: 'beginner', duration: 30, speed: 20, accuracy: 100, finishedAt: 1 };
};
describe('expanded chapter exercises', () => {
  it('gives every chapter five stable bilingual short rounds', () => {
    expect(typeof course.lessonExercises).toBe('function');
    for (const chapter of course.lessons) {
      const rounds = course.lessonExercises(chapter);
      expect(rounds).toHaveLength(5);
      expect(rounds[0]).toBe(chapter);
      expect(new Set(rounds.map(x => x.text)).size).toBe(5);
      for (const round of rounds) {
        expect(round.text.length).toBeGreaterThan(30);
        expect(round.title.zh).not.toBe(round.title.en);
        expect(course.lessonForArticle(course.lessonArticle(round, 'zh'))).toBe(round);
        expect(course.lessonArticle(round, 'zh').text).toBe(course.lessonArticle(round, 'en').text);
        expect(course.lessonChapter(round)).toBe(chapter);
      }
    }
  });
  it('preserves old article snapshots and completed chapter badges', () => {
    const original = course.lessons[0];
    expect(original.text).toBe('fj fj jf jf ff jj fj jf\nfjf jfj fjf jfj ff jj');
    expect(course.lessonArticle(original, 'zh').id).toBe('lesson-ready-v1');
    expect(course.courseProgress([record(original)], null).completed).toEqual(['ready']);
    expect(typeof course.chapterExerciseProgress).toBe('function');
    const progress = course.chapterExerciseProgress([record(original)], null, original);
    expect(progress.completed).toEqual(['ready']);
    expect(progress.next.id).toBe('ready-2');
  });
  it('filters expanded progress by owner and actual scored content', () => {
    expect(typeof course.lessonExercises).toBe('function');
    const chapter = course.lessons[0], rounds = course.lessonExercises(chapter);
    const records = [record(rounds[0]), record(rounds[1], 'other'), { ...record(rounds[2]), typed: 'x'.repeat(rounds[2].text.length) }];
    expect(course.chapterExerciseProgress(records, null, chapter).completed).toEqual(['ready']);
    expect(course.chapterExerciseProgress(rounds.map(x => record(x)), null, chapter).completed).toHaveLength(5);
    expect(course.lessonForArticle({ ...course.lessonArticle(rounds[1], 'en'), text: 'changed' })).toBeUndefined();
  });
  it('only introduces already covered keys in early chapter drills', () => {
    expect(typeof course.lessonExercises).toBe('function');
    const allowed = [/^[fj\s]+$/, /^[asdfghjkl;\s]+$/, /^[qwertyuiopasdfghjkl;\s]+$/, /^[a-z\s]+$/];
    course.lessons.slice(0, 4).forEach((chapter, i) => course.lessonExercises(chapter).slice(1).forEach(round => expect(round.text).toMatch(allowed[i])));
  });
  it('recommends the next round and then the next chapter, finishing the final round', () => {
    expect(typeof course.lessonExercises).toBe('function');
    const first = course.lessonExercises(course.lessons[0]);
    expect(course.lessonRecommendation(record(first[0])).lesson?.id).toBe(first[1].id);
    expect(course.lessonRecommendation(record(first[4])).lesson?.id).toBe('home');
    const last = course.lessonExercises(course.lessons[7]);
    expect(course.lessonRecommendation(record(last[4])).kind).toBe('complete');
  });
});
