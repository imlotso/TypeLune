import { useState } from 'react';
import { ArrowRight, CheckCircle, Keyboard, BookOpen } from '@phosphor-icons/react';
import { useI18n } from '../lib/i18n';
import { courseProgress, chapterExerciseProgress, lessonExercises, lessonChapter, keyHint, lessonCopy, lessonForArticle, lessonOutcome, lessonRecommendation, lessons, type Lesson } from '../lib/lessons';
import type { ArticleSnapshot, PracticeRecord, SavedPractice } from '../lib/models';
import '../lessons.css';
import { FingerGuide } from './FingerGuide';
import { AssessmentPanel, WeakKeyPanel } from './AssessmentPanel';
import { assessmentArticle } from '../lib/assessment';

export function LessonsView({ records, drafts, ownerId, onSelect, onResume, onTraining }: {
  records: readonly PracticeRecord[]; drafts: readonly SavedPractice[]; ownerId: string | null;
  onSelect: (lesson: Lesson) => void; onResume: (draft: SavedPractice) => void;
  onTraining?: (article: ArticleSnapshot) => void;
}) {
  const { t, locale } = useI18n();
  const progress = courseProgress(records, ownerId);
  const availableDrafts = drafts.filter((draft) => draft.ownerId === ownerId && lessonForArticle(draft.article) && draft.typed.length < draft.article.text.length).sort((a, b) => b.savedAt - a.savedAt);
  const latest = availableDrafts[0];
  const nextExercise = lessons.map(chapter => chapterExerciseProgress(records, ownerId, chapter)).find(p => p.completed.length < 5)?.next ?? lessons[0];
  return <section className="content-panel feature-panel lessons-view">
    <div className="lessons-heading">
      <div><span className="lesson-eyebrow">{t('英文键盘基础', 'QWERTY BASICS')}</span><h1>{t('新手课程', 'Beginner course')}</h1></div>
      <div className="lesson-progress"><span>{t('本机进度', 'Local progress')}</span><strong>{progress.completed.length} / {lessons.length}</strong><progress value={progress.completed.length} max={lessons.length} aria-label={t('课程进度', 'Course progress')} /></div>
    </div>
    {onTraining && <div className="lesson-training-panels"><AssessmentPanel records={records} ownerId={ownerId} onSelect={onTraining} /><WeakKeyPanel records={records} ownerId={ownerId} onSelect={onTraining} /></div>}
    <div className="lesson-start">
      <div><Keyboard size={24} aria-hidden="true" /><span>{latest ? lessonCopy(lessonForArticle(latest.article)!.title, locale) : lessonCopy(nextExercise.title, locale)}</span></div>
      <button className="primary-button" onClick={() => latest ? onResume(latest) : onSelect(nextExercise)}>
        {latest ? t('继续上次练习', 'Resume practice') : progress.completed.length ? t('继续课程', 'Continue course') : t('进入第一课', 'Open first lesson')} <ArrowRight size={17} aria-hidden="true" />
      </button>
    </div>
    <div className="lesson-grid">{lessons.map((lesson, index) => {
      const state = progress.byLesson[lesson.id];
      const rounds = lessonExercises(lesson);
      const expanded = chapterExerciseProgress(records, ownerId, lesson);
      const draft = availableDrafts.find((item) => lessonChapter(lessonForArticle(item.article)!).id === lesson.id);
      return <article key={lesson.id} className={'lesson-card' + (state?.completed ? ' lesson-done' : '')}>
        <div className="lesson-card-top"><span className="lesson-number">{String(index + 1).padStart(2, '0')}</span>{state?.completed && <span className="lesson-completed"><CheckCircle size={17} weight="fill" aria-hidden="true" />{t('基础已完成', 'Basics completed')}</span>}</div>
        <h2>{lessonCopy(lesson.title, locale)}</h2>
        <div className="lesson-keys">{lesson.focus}</div>
        <div className="lesson-rounds"><span>{t('练习', 'Exercises')} {expanded.completed.length} / {rounds.length}</span><div>{rounds.map((round, n) => <button key={round.id} className={'lesson-round' + (expanded.byLesson[round.id]?.completed ? ' lesson-round-done' : '')} aria-label={lessonCopy(round.title, locale)} onClick={() => { const saved = availableDrafts.find(item => lessonForArticle(item.article)?.id === round.id); saved ? onResume(saved) : onSelect(round); }} title={lessonCopy(round.title, locale)}>{n + 1}{expanded.byLesson[round.id]?.completed ? ' ✓' : ''}</button>)}</div></div>
        <div className="lesson-card-bottom"><span>{state ? t('最佳准确率', 'Best accuracy') + ' ' + state.accuracy + '%' : t('目标 95%', 'Target 95%')}</span>
          <button className="text-button" aria-label={t('打开', 'Open') + ' ' + lessonCopy(lesson.title, locale)} onClick={() => draft ? onResume(draft) : onSelect(expanded.next)}>
            {draft ? t('继续', 'Resume') : state?.completed ? t('复练', 'Review') : t('进入', 'Open')} <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </article>;
    })}</div>
    <p className="feature-muted lesson-local-note">{t('进度依据此设备已加载的记录。课程不参与排行。', 'Progress uses records loaded on this device. Lessons are not ranked.')}</p>
  </section>;
}

export function LessonGuide({ lesson, character, onBack }: { lesson: Lesson; character?: string; onBack: () => void }) {
  const { t, locale } = useI18n();
  const [showHints, setShowHints] = useState(true);
  const hint = keyHint(character, locale);
  return <section className="lesson-guide" aria-label={t('课程提示', 'Lesson guide')}>
    <div className="lesson-guide-top"><button className="text-button" onClick={onBack}><BookOpen size={17} aria-hidden="true" />{t('课程目录', 'Course outline')}</button><span>{String(lessons.indexOf(lessonChapter(lesson)) + 1).padStart(2, '0')} / {lessons.length} · {lessonCopy(lesson.title, locale)} · {t('练习', 'Exercise')} {lesson.exerciseNumber ?? 1}/5</span><label><input type="checkbox" checked={showHints} onChange={(event) => setShowHints(event.target.checked)} />{t('键位提示', 'Key hints')}</label></div>
    <p>{lessonCopy(lesson.tip, locale)}</p>
    {showHints && <div className="lesson-keyboard-wrap">
      <FingerGuide character={character} />
      <div className="lesson-next-key">{hint ? <>{hint.shift && <kbd>Shift</kbd>}<kbd>{hint.key}</kbd><span>{hint.finger}</span></> : <span>{t('本课已输入', 'Lesson entered')}</span>}</div>
    </div>}
  </section>;
}

export function LessonResult({ record, onSelect, onReview, onCourse }: { record: PracticeRecord; onSelect: (lesson: Lesson) => void; onReview: (article: ArticleSnapshot) => void; onCourse: () => void }) {
  const { t, locale } = useI18n();
  const outcome = lessonOutcome(record);
  const recommendation = lessonRecommendation(record);
  if (!outcome) return null;
  return <section className="lesson-result" aria-label={t('课程建议', 'Lesson recommendation')}>
    <strong>{outcome.completed ? t('本课完成', 'Lesson completed') : t('本课未完成', 'Lesson not completed')}</strong>
    <p>{recommendation.kind === 'review' ? t('本轮有错字，建议先复练。', 'Review this round’s mistakes first.') : recommendation.kind === 'retry' ? t('完成全文并达到 95% 准确率。', 'Finish the lesson with at least 95% accuracy.') : recommendation.kind === 'complete' ? t('本课完成，可回目录复练。', 'Lesson completed. Return to the outline to review.') : t('可以进入下一课。', 'Ready for the next lesson.')}</p>
    <div className="feature-actions">
      {recommendation.kind === 'review' && recommendation.drill && <button className="primary-button" onClick={() => onReview(recommendation.drill!)}>{t('复练本轮错字', 'Review round mistakes')}</button>}
      {recommendation.kind === 'retry' && <button className="primary-button" onClick={() => onSelect(outcome.lesson)}>{t('再练本课', 'Retry lesson')}</button>}
      {recommendation.kind === 'next' && recommendation.lesson && <button className="primary-button" onClick={() => onSelect(recommendation.lesson!)}>{t('下一课', 'Next lesson')} <ArrowRight size={16} aria-hidden="true" /></button>}
      {outcome.completed && ['lower', 'sentences', 'lower-5', 'sentences-5'].includes(outcome.lesson.id) && <button className="outline-button" onClick={() => onReview(assessmentArticle(locale))}>{t('阶段复测', 'Phase retest')}</button>}
      <button className="text-button" onClick={onCourse}>{t('课程目录', 'Course outline')}</button>
    </div>
  </section>;
}
