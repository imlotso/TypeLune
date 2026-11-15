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

const difficulties: Record<Difficulty, string> = { beginner: '入门', intermediate: '进阶', advanced: '挑战' };
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
      if (!validBoard(data)) throw new Error('排行榜数据无法读取');
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
  const unit = language === 'zh' ? '字/分' : 'WPM';

  return <section className="content-panel feature-panel rankings">
    <div className="content-heading"><h1><Trophy size={25} aria-hidden="true" /> 排行榜</h1>{!!data?.total && <span className="count-chip">{data.total} 名</span>}</div>
    <div className="feature-toolbar">
      <div className="segmented feature-segments" role="group" aria-label="排行榜类型">
        <button aria-pressed={boardKind === 'guest'} onClick={() => setBoardKind('guest')}>游客榜</button>
        <button aria-pressed={boardKind === 'user'} onClick={() => setBoardKind('user')}>用户榜</button>
      </div>
      <div className="segmented feature-segments" role="group" aria-label="排行语言">
        <button aria-pressed={language === 'zh'} onClick={() => { setLanguage('zh'); setArticleId(''); }}>中文</button>
        <button aria-pressed={language === 'en'} onClick={() => { setLanguage('en'); setArticleId(''); }}>English</button>
      </div>
      <label className="ranking-strict"><input type="checkbox" checked={strict} onChange={(event) => setStrict(event.target.checked)} />严格纠错</label>
    </div>
    <div className="feature-filters ranking-filters">
      <label>难度<select value={difficulty} onChange={(event) => { setDifficulty(event.target.value as Difficulty); setArticleId(''); }}>{Object.entries(difficulties).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label>排行时段<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">全部</option><option value="week">近 7 天</option><option value="month">近 30 天</option></select></label>
      <label>练习模式<select value={mode} onChange={(event) => setMode(event.target.value as PracticeMode)}><option value="timed">限时</option><option value="article">整篇</option></select></label>
      {mode === 'timed' && <label>限时（分钟）<input type="number" min={1} max={60} step={1} aria-invalid={!validMinutes} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>}
      <label>文章<select value={articleId} onChange={(event) => setArticleId(event.target.value)}><option value="">全部</option>{articleId && !articles.some((article) => article.id === articleId && article.language === language && article.difficulty === difficulty) && <option value={articleId}>已选文章</option>}{articles.filter((article) => article.language === language && article.difficulty === difficulty).map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}</select></label>
    </div>
    {!request && <p className="form-error" role="alert">请输入 1–60 的整数</p>}
    {error && <><p className="form-error" role="alert">{error}</p><button type="button" className="outline-button" onClick={() => setRevision((value) => value + 1)}>重试</button></>}
    {!!request && !data && !error && <p className="empty-state" role="status">加载中…</p>}
    {!!data?.displayDays && <p className="feature-muted">显示最近 {data.displayDays} 天成绩</p>}
    {data?.self && <p className="ranking-self"><strong>我的排名</strong> 第 {data.self.rank} 名 <span>{data.self.speed} {unit} · {data.self.accuracy}%</span></p>}
    {data && !data.entries.length && <p className="empty-state">暂无成绩</p>}
    {!!data?.entries.length && <ol className="ranking-list">{data.entries.map((entry, index) => {
      const rank = entry.rank ?? index + 1;
      return <li key={entry.attemptId ?? index} className={entry.mine ? 'rank-mine' : undefined}>
        <span className={`rank-number rank-${rank}`} aria-label={`第 ${rank} 名`}>{rank <= 3 ? <Crown size={21} weight="fill" aria-hidden="true" /> : rank}</span>
        <span className="rank-identity"><span className="rank-name">{entry.nickname}</span>{Number.isFinite(entry.createdAt) && Number.isFinite(new Date(entry.createdAt).getTime()) && <time className="rank-time" dateTime={new Date(entry.createdAt).toISOString()}>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(entry.createdAt)}</time>}</span>
        <span className="rank-accuracy">准确率 {entry.accuracy}%</span>
        <strong>{entry.speed} <small>{unit}</small></strong>
        {isAdmin && <button className="text-button" onClick={() => {
          setReason('');
          setRemoveError('');
          setSelectedScore(entry);
        }}>下架</button>}
      </li>;
    })}</ol>}
    {selectedScore && <Dialog title="下架成绩" onClose={() => setSelectedScore(undefined)} dismissible={!removing}>
      <form onSubmit={(event) => { event.preventDefault(); void removeScore(); }}>
        <p className="dialog-intro">{selectedScore.nickname} · {selectedScore.speed} {unit}</p>
        <label className="custom-editor">原因<textarea value={reason} maxLength={500} disabled={removing}
          onChange={(event) => setReason(event.target.value)} /></label>
        {removeError && <p className="form-error" role="alert">{removeError}</p>}
        <div className="result-actions">
          <button type="button" className="outline-button" onClick={() => setSelectedScore(undefined)} disabled={removing}>取消</button>
          <button type="submit" className="primary-button" disabled={!reason.trim() || removing}>确认下架</button>
        </div>
      </form>
    </Dialog>}
  </section>;
}
