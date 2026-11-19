import { useId, useRef, useState, type ReactNode } from 'react';
import { Backspace } from '@phosphor-icons/react/Backspace';
import { BookOpen } from '@phosphor-icons/react/BookOpen';
import { Clock } from '@phosphor-icons/react/Clock';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { Target } from '@phosphor-icons/react/Target';
import { X } from '@phosphor-icons/react/X';
import { useI18n } from '../lib/i18n';
import type { PracticeResult } from '../hooks/usePractice';
import type { ArticleSnapshot } from '../lib/models';
import { EnglishSpeed } from './EnglishSpeed';
import { ProcessChart, ProcessPreview } from './ProcessChart';
import { isCustomPracticeArticle } from '../lib/practice-kind';

const formatTime = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

type Props = {
  result: PracticeResult;
  article: ArticleSnapshot;
  typed: number;
  offset: number;
  status: ReactNode;
  comparison: ReactNode;
  course: ReactNode;
  mistakes: ReactNode;
  leaderboard: ReactNode;
  actions: ReactNode;
};

export function ResultLayout({ result, article, typed, offset, status, comparison, course, mistakes, leaderboard, actions }: Props) {
  const { t, locale } = useI18n();
  const id = useId();
  const [tab, setTab] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const labels = [t('概览', 'Overview'), t('过程', 'Timeline'), t('错字', 'Mistakes')];
  const difficulty = {
    beginner: t('入门', 'Beginner'), intermediate: t('进阶', 'Intermediate'), advanced: t('挑战', 'Advanced'),
  };
  const context = [
    article.author,
    result.language === 'zh' ? t('中文', 'Chinese') : 'English',
    isCustomPracticeArticle(article, result.custom || article.custom) ? t('自定义', 'Custom') : difficulty[article.difficulty],
    result.record?.mode === 'article' ? t('全文练习', 'Full article') : result.record?.duration
      ? t(`限时 ${result.record.duration / 60} 分钟`, `Timed ${result.record.duration / 60} min`)
      : t('限时练习', 'Timed practice'),
    result.record?.strict && t('严格纠错', 'Strict correction'),
  ].filter(Boolean).join(' · ');
  const number = new Intl.NumberFormat(locale);
  const metrics = [
    { icon: BookOpen, label: t('已打 / 文章字数', 'Typed / article chars'), value: `${number.format(typed)} / ${number.format(result.articleTotal)}` },
    { icon: Backspace, label: t('退格次数', 'Backspaces'), value: number.format(result.backspaces) },
    { icon: X, label: t('错误字数', 'Errors'), value: number.format(result.errors) },
    { icon: Clock, label: t('有效用时', 'Active time'), value: formatTime(result.elapsedMs) },
  ];

  return <>
    <div className="result-scroll">
      <div className="result-summary">
        <section className="result-article">
          <BookOpen size={43} aria-hidden="true" />
          <div><h3>{article.title}</h3><p>{context}</p></div>
        </section>
        <div className="result-tabs" role="tablist" aria-label={t('成绩详情', 'Result details')} onKeyDown={event => {
          let next = tab;
          if (event.key === 'ArrowRight') next = (tab + 1) % labels.length;
          else if (event.key === 'ArrowLeft') next = (tab + labels.length - 1) % labels.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = labels.length - 1;
          else return;
          event.preventDefault();
          setTab(next);
          tabs.current[next]?.focus();
        }}>
          {labels.map((label, index) => <button type="button" key={label} ref={element => { tabs.current[index] = element; }}
            id={`${id}-tab-${index}`} role="tab" aria-selected={tab === index} aria-controls={`${id}-panel-${index}`}
            tabIndex={tab === index ? 0 : -1} onClick={() => setTab(index)}>{label}</button>)}
        </div>
        <section id={`${id}-panel-0`} role="tabpanel" aria-labelledby={`${id}-tab-0`} hidden={tab !== 0} tabIndex={0} className="result-overview">
          <div className="result-heroes">
            <div className="result-hero result-speed">
              <span className="result-hero-label"><Lightning size={21} weight="fill" aria-hidden="true" />{t('打字速度', 'Typing speed')}</span>
              {result.language === 'en' ? <EnglishSpeed score={result.score} display="result" /> : <><strong>{number.format(result.score.cpm)}</strong><span className="result-hero-unit">{t('字 / 分钟', 'Chars / min')}</span></>}
            </div>
            <div className="result-hero result-accuracy">
              <span className="result-hero-label"><Target size={21} aria-hidden="true" />{t('准确率', 'Accuracy')}</span>
              <strong>{number.format(result.score.accuracy)}<small>%</small></strong>
              <span className="result-hero-unit" aria-hidden="true">{t('准确率', 'Accuracy')}</span>
            </div>
          </div>
          <dl className="result-statistics">
            {metrics.map(({ icon: Icon, label, value }) => <div key={label}>
              <Icon size={25} aria-hidden="true" /><div><dt>{label}</dt><dd>{value}</dd></div>
            </div>)}
          </dl>
          <ProcessPreview trace={result.record?.processTrace} language={result.language} />
        </section>
        <section id={`${id}-panel-1`} role="tabpanel" aria-labelledby={`${id}-tab-1`} hidden={tab !== 1} tabIndex={0}>
          <ProcessChart trace={result.record?.processTrace} language={result.language} />
        </section>
        <section id={`${id}-panel-2`} role="tabpanel" aria-labelledby={`${id}-tab-2`} hidden={tab !== 2} tabIndex={0} className="result-mistakes">
          {mistakes}
        </section>
      </div>
      <div className="result-details">
        <section className="result-submission" aria-label={t('成绩与上榜状态', 'Result and leaderboard status')}>
          <h3>{t('排行榜', 'Leaderboard')}</h3>
          <div className="result-score-status">{status}</div>
          {leaderboard}
        </section>
        <div className="result-detail-extra">
          {offset > 0 && <p className="feature-muted">{t(`本轮输入 ${result.score.total} 字`, `This round ${result.score.total} chars`)}</p>}
          {comparison}
          {course}
        </div>
      </div>
    </div>
    <div className="result-footer">{actions}</div>
  </>;
}
