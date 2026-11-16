// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LessonsView, LessonGuide, LessonResult } from '../src/components/LessonsView';
import { lessons, lessonArticle, lessonExercises } from '../src/lib/lessons';
import { I18nProvider } from '../src/lib/i18n';
import type { PracticeRecord, SavedPractice } from '../src/lib/models';

beforeEach(() => localStorage.clear());
afterEach(cleanup);
const article = lessonArticle(lessons[0], 'zh');
const completed: PracticeRecord = { recordId: 'r1', article, ownerId: null, typed: article.text, language: 'en', difficulty: 'beginner', duration: 300, speed: 10, accuracy: 100, finishedAt: 100 };
it('shows real progress and continues the first unfinished lesson', () => {
  const select = vi.fn();
  render(<LessonsView ownerId={null} records={[completed]} drafts={[]} onSelect={select} onResume={vi.fn()} />);
  expect(screen.getByText('1 / 8')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '继续课程' }));
  expect(select).toHaveBeenCalledWith(lessonExercises(lessons[0])[1]);
  expect(screen.getByText('基础完成数')).toBeTruthy();
});
it('resumes a matching owned draft rather than replacing unfinished input', () => {
  const resume = vi.fn();
  const draft: SavedPractice = { id: 'draft-r2', recordId: 'r2', article, typed: 'fj', ownerId: null, elapsedMs: 1000, backspaces: 0, duration: 300, mode: 'article', strict: false, offset: 0, offline: true, savedAt: 200 };
  render(<LessonsView ownerId={null} records={[]} drafts={[draft]} onSelect={vi.fn()} onResume={resume} />);
  fireEvent.click(screen.getByRole('button', { name: '继续上次练习' }));
  expect(resume).toHaveBeenCalledWith(draft);
});
it('shows a removable static keyboard hint and localizes the UI', () => {
  localStorage.setItem('typelune.ui-locale.v1', 'en');
  render(<I18nProvider><LessonGuide lesson={lessons[0]} character="F" onBack={vi.fn()} /></I18nProvider>);
  expect(screen.getByText('Left index')).toBeTruthy();
  expect(screen.getByText('Shift', { selector: 'kbd' })).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Key hints' }));
  expect(screen.queryByText('Left index')).toBeNull();
});
it('offers a real mistake drill or next lesson from the completed record', () => {
  const select = vi.fn(), review = vi.fn();
  const { rerender } = render(<LessonResult record={completed} onSelect={select} onReview={review} onCourse={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '下一课' }));
  expect(select).toHaveBeenCalledWith(lessonExercises(lessons[0])[1]);
  rerender(<LessonResult record={{ ...completed, mistakes: [{ position: 0, expected: 'f', actual: 'x' }] }} onSelect={select} onReview={review} onCourse={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '复练本轮错字' }));
  expect(review).toHaveBeenCalledWith(expect.objectContaining({ custom: true }));
});
it('offers the same-condition phase retest after the two course milestones, not partial work', () => {
  const review = vi.fn();
  const article = lessonArticle(lessons[3], 'zh');
  const props = { onSelect: vi.fn(), onReview: review, onCourse: vi.fn() };
  const { rerender } = render(<LessonResult {...props} record={{ ...completed, article, typed: article.text }} />);
  fireEvent.click(screen.getByRole('button', { name: '阶段复测' }));
  expect(review).toHaveBeenCalledWith(expect.objectContaining({ id: 'assessment-english-v1', custom: true }));
  rerender(<LessonResult {...props} record={{ ...completed, article, typed: 'zxc' }} />);
  expect(screen.queryByRole('button', { name: '阶段复测' })).toBeNull();
});
it('opens an explicitly chosen expanded exercise and resumes its own draft', () => {
  const select = vi.fn(), resume = vi.fn();
  const round = lessonExercises(lessons[0])[2];
  const { rerender } = render(<LessonsView ownerId={null} records={[]} drafts={[]} onSelect={select} onResume={resume} />);
  fireEvent.click(screen.getByRole('button', { name: round.title.zh }));
  expect(select).toHaveBeenCalledWith(round);
  const article = lessonArticle(round, 'zh');
  const draft: SavedPractice = { id: 'draft-extra', recordId: 'extra', article, typed: 'ff', ownerId: null, elapsedMs: 1000, backspaces: 0, duration: 300, mode: 'article', strict: false, offset: 0, offline: true, savedAt: 200 };
  rerender(<LessonsView ownerId={null} records={[]} drafts={[draft]} onSelect={select} onResume={resume} />);
  fireEvent.click(screen.getByRole('button', { name: round.title.zh }));
  expect(resume).toHaveBeenCalledWith(draft);
});
