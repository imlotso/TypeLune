import { SystemMessage } from './SystemMessage';
import { useI18n } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { Crown } from '@phosphor-icons/react/Crown';
import { Trophy } from '@phosphor-icons/react/Trophy';
import type { Difficulty, Language } from '../data/articles';
import { api } from '../lib/api';
import { Dialog } from './Dialog';
import type { ArticleSnapshot, PracticeMode, RankingEntry } from '../lib/models';

type Board = { entries: RankingEntry[]; self?: RankingEntry | null; total?: number; displayDays?: number };
type Filters = { language: Language; difficulty: Difficulty; duration: number; mode: PracticeMode; strict: boolean };
type Props = {
  initial: Filters;
  articles: ArticleSnapshot[];
  isAdmin: boolean;
  ownerId: string | null;
  onAddressChange?: (address: string) => void;
};

const validEntry = (value: unknown): value is RankingEntry => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.nickname === 'string' && typeof row.speed === 'number' && Number.isFinite(row.speed) && row.speed >= 0 &&
    typeof row.accuracy === 'number' && Number.isFinite(row.accuracy) && row.accuracy >= 0 && row.accuracy <= 100 &&
    (row.rank === undefined || (Number.isSafeInteger(row.rank) && (row.rank as number) > 0));
};
const validBoard = (data: Board) => Array.isArray(data.entries) && data.entries.every(validEntry) &&
  (data.self == null || validEntry(data.self)) && (data.total === undefined || (Number.isSafeInteger(data.total) && data.total >= 0)) &&
  (data.displayDays === undefined || (Number.isSafeInteger(data.displayDays) && data.displayDays > 0 && data.displayDays <= 3650));

const isRankingPath = () => /^\/rankings\/*$/u.test(window.location.pathname);
function initialFilters(initial: Filters, ownerId: string | null) {
  const query = new URLSearchParams(isRankingPath() ? window.location.search : '');
  const language = query.get('language'); const difficulty = query.get('difficulty'); const mode = query.get('mode');
  const duration = Number(query.get('duration')); const strict = query.get('strict'); const period = query.get('period'); const board = query.get('board');
  const article = query.get('articleId') ?? '';
  return {
    language: language === 'zh' || language === 'en' ? language : initial.language,
    difficulty: difficulty === 'beginner' || difficulty === 'intermediate' || difficulty === 'advanced' ? difficulty : initial.difficulty,
    minutes: String(Number.isInteger(duration) && duration >= 60 && duration <= 3600 && duration % 60 === 0 ? duration / 60 : initial.duration / 60 || 5),
    mode: mode === 'timed' || mode === 'article' ? mode : initial.mode,
    strict: strict === 'true' ? true : strict === 'false' ? false : initial.strict,
    period: period === 'week' || period === 'month' ? period : 'all',
    board: board === 'guest' || board === 'user' ? board : ownerId ? 'user' : 'guest',
    articleId: article.length <= 200 && !/[\p{Cc}\p{Cf}]/u.test(article) ? article : '',
  } as const;
}

export function RankingView({ initial, articles, isAdmin, ownerId, onAddressChange }: Props) {
  const { t, locale } = useI18n();
const difficulties: Record<Difficulty, string> = { beginner: t("入门", "Beginner"), intermediate: t("进阶", "Intermediate"), advanced: t("挑战", "Advanced") };

  const [selected] = useState(() => initialFilters(initial, ownerId));
  const [language, setLanguage] = useState<Language>(selected.language);
  const [difficulty, setDifficulty] = useState<Difficulty>(selected.difficulty);
  const [minutes, setMinutes] = useState(selected.minutes);
  const [mode, setMode] = useState<PracticeMode>(selected.mode);
  const [strict, setStrict] = useState(selected.strict);
  const [period, setPeriod] = useState<string>(selected.period);
  const [boardKind, setBoardKind] = useState<'guest' | 'user'>(selected.board);
  const [articleId, setArticleId] = useState(selected.articleId);
  const [revision, setRevision] = useState(0);
  const [board, setBoard] = useState<{ query: string; data: Board }>();
  const [failure, setFailure] = useState<{ query: string; message: string }>();
  const [selectedScore, setSelectedScore] = useState<RankingEntry>();
  const [reason, setReason] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [removing, setRemoving] = useState(false);
  const validMinutes = /^\d+$/.test(minutes) && Number(minutes) >= 1 && Number(minutes) <= 60;
  const query = new URLSearchParams({ board: boardKind, language, difficulty, duration: String(mode === 'article' ? 300 : Number(minutes) * 60), mode, strict: String(strict), period });
  if (articleId) query.set('articleId', articleId);
  const request = mode === 'timed' && !validMinutes ? '' : query.toString();
  const identity = `${revision}:${request}`;

  useEffect(() => {
    if (!request || !isRankingPath()) return;
    const current = new URLSearchParams(window.location.search);
    for (const [key, value] of new URLSearchParams(request)) current.set(key, value);
    if (!articleId) current.delete('articleId');
    const address = `${window.location.pathname}?${current}${window.location.hash}`;
    if (address !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', address);
    onAddressChange?.(address);
  }, [request, articleId, onAddressChange]);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    setFailure(undefined);
    api<Board>(`/api/leaderboard?${request}`, { signal: controller.signal, headers: ownerId ? { 'X-Workspace-Owner': ownerId } : undefined }).then((data) => {
      if (!validBoard(data)) throw new Error(t("排行榜数据无法读取", "Could not read leaderboard data"));
      if (!controller.signal.aborted) setBoard({ query: identity, data });
    }).catch((error) => {
      if (!controller.signal.aborted) setFailure({ query: identity, message: (error as Error).message });
    });
    return () => controller.abort();
  }, [request, identity, ownerId]);

  async function removeScore() {
    if (!selectedScore || !reason.trim() || removing || !ownerId) return;
    setRemoving(true);
    setRemoveError('');
    try {
      await api('/api/admin/scores/moderate', {
        method: 'POST',
        headers: { 'X-Workspace-Owner': ownerId },
        body: { ids: [selectedScore.attemptId], action: 'remove', reason },
      });
      setSelectedScore(undefined);
      setRevision((value) => value + 1);
    } catch (error) { setRemoveError((error as Error).message); }
    finally { setRemoving(false); }
  }

  const data = board?.query === identity ? board.data : undefined;
  const error = failure?.query === identity ? failure.message : '';
  const unit = language === 'zh' ? t("字/分", "chars/min") : 'WPM';

  return <section className="content-panel feature-panel rankings">
    <div className="content-heading"><h1><Trophy size={25} aria-hidden="true" /> {t("排行榜", "Leaderboard")}</h1>{!!data?.total && <span className="count-chip">{data.total} {t("名", "players")}</span>}</div>
    <div className="feature-toolbar">
      <div className="segmented feature-segments" role="group" aria-label={t("排行榜类型", "Leaderboard type")}>
        <button aria-pressed={boardKind === 'guest'} onClick={() => setBoardKind('guest')}>{t("游客榜", "Guests")}</button>
        <button aria-pressed={boardKind === 'user'} onClick={() => setBoardKind('user')}>{t("用户榜", "Members")}</button>
      </div>
      <div className="segmented feature-segments" role="group" aria-label={t("排行语言", "Article language")}>
        <button aria-pressed={language === 'zh'} onClick={() => { setLanguage('zh'); setArticleId(''); }}>{t("中文", "Chinese")}</button>
        <button aria-pressed={language === 'en'} onClick={() => { setLanguage('en'); setArticleId(''); }}>English</button>
      </div>
      <label className="ranking-strict"><input type="checkbox" checked={strict} onChange={(event) => setStrict(event.target.checked)} />{t("严格纠错", "Strict correction")}</label>
    </div>
    <div className="feature-filters ranking-filters">
      <label>{t("难度", "Difficulty")}<select value={difficulty} onChange={(event) => { setDifficulty(event.target.value as Difficulty); setArticleId(''); }}>{Object.entries(difficulties).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label>{t("排行时段", "Period")}<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">{t("全部", "All")}</option><option value="week">{t("近 7 天", "Last 7 days")}</option><option value="month">{t("近 30 天", "Last 30 days")}</option></select></label>
      <label>{t("练习模式", "Practice mode")}<select value={mode} onChange={(event) => setMode(event.target.value as PracticeMode)}><option value="timed">{t("限时", "Timed")}</option><option value="article">{t("整篇", "Full article")}</option></select></label>
      {mode === 'timed' && <label>{t("限时（分钟）", "Time limit (minutes)")}<input type="number" min={1} max={60} step={1} aria-invalid={!validMinutes} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>}
      <label>{t("文章", "Article")}<select value={articleId} onChange={(event) => setArticleId(event.target.value)}><option value="">{t("全部", "All")}</option>{articleId && !articles.some((article) => article.id === articleId && article.language === language && article.difficulty === difficulty) && <option value={articleId}>{t("已选文章", "Selected article")}</option>}{articles.filter((article) => article.language === language && article.difficulty === difficulty).map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}</select></label>
    </div>
    {!request && <p className="form-error" role="alert">{t("请输入 1–60 的整数", "Enter a whole number from 1 to 60")}</p>}
    {error && <><p className="form-error" role="alert">{<SystemMessage text={error} />}</p><button type="button" className="outline-button" onClick={() => setRevision((value) => value + 1)}>{t("重试", "Retry")}</button></>}
    {!!request && !data && !error && <p className="empty-state" role="status">{t("加载中…", "Loading…")}</p>}
    {!!data?.displayDays && <p className="feature-muted">{t("显示最近 ", "Showing the last  ")}{data.displayDays} {t("天成绩", "days of scores")}</p>}
    {data?.self && <p className="ranking-self"><strong>{t("我的排名", "My rank")}</strong> {t("第 ", "# ")}{data.self.rank} {t("名 ", "players ")}<span>{data.self.speed} {unit} · {data.self.accuracy}%</span></p>}
    {data && !data.entries.length && <p className="empty-state">{t("暂无成绩", "No scores yet")}</p>}
    {!!data?.entries.length && <ol className="ranking-list">{data.entries.map((entry, index) => {
      const rank = entry.rank ?? index + 1;
      return <li key={entry.attemptId ?? index} className={entry.mine ? 'rank-mine' : undefined}>
        <span className={`rank-number rank-${rank}`} aria-label={t(`第 ${rank} 名`, `Rank ${rank}`)}>{rank <= 3 ? <Crown size={21} weight="fill" aria-hidden="true" /> : rank}</span>
        <span className="rank-identity"><span className="rank-name">{entry.nickname}</span>{Number.isFinite(entry.createdAt) && Number.isFinite(new Date(entry.createdAt).getTime()) && <time className="rank-time" dateTime={new Date(entry.createdAt).toISOString()}>{new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(entry.createdAt)}</time>}</span>
        <span className="rank-accuracy">{t("准确率 ", "Accuracy ")}{entry.accuracy}%</span>
        <strong>{entry.speed} <small>{unit}</small></strong>
        {isAdmin && <button className="text-button" onClick={() => {
          setReason('');
          setRemoveError('');
          setSelectedScore(entry);
        }}>{t("下架", "Unpublish")}</button>}
      </li>;
    })}</ol>}
    {selectedScore && <Dialog title={t("下架成绩", "Unpublish score")} onClose={() => setSelectedScore(undefined)} dismissible={!removing}>
      <form onSubmit={(event) => { event.preventDefault(); void removeScore(); }}>
        <p className="dialog-intro">{selectedScore.nickname} · {selectedScore.speed} {unit}</p>
        <label className="custom-editor">{t("原因", "Reason")}<textarea value={reason} maxLength={500} disabled={removing}
          onChange={(event) => setReason(event.target.value)} /></label>
        {removeError && <p className="form-error" role="alert">{removeError}</p>}
        <div className="result-actions">
          <button type="button" className="outline-button" onClick={() => setSelectedScore(undefined)} disabled={removing}>{t("取消", "Cancel")}</button>
          <button type="submit" className="primary-button" disabled={!reason.trim() || removing}>{t("确认下架", "Confirm unpublish")}</button>
        </div>
      </form>
    </Dialog>}
  </section>;
}
