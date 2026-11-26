import { SystemMessage } from './SystemMessage';
import { useI18n } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { AccountAvatar } from './AccountAvatar';
import { Crown } from '@phosphor-icons/react/Crown';
import { Trophy } from '@phosphor-icons/react/Trophy';
import type { Difficulty, Language } from '../data/articles';
import { api } from '../lib/api';
import { Dialog } from './Dialog';
import type { ArticleSnapshot, PracticeMode, RankingEntry } from '../lib/models';

type Board = { entries: RankingEntry[]; self?: RankingEntry | null; total?: number; displayDays?: number };
type RankingDifficulty = Difficulty | 'all';
type Filters = { language: Language; difficulty: Difficulty; duration: number; mode: PracticeMode; strict: boolean };
type Props = {
  onProfile?: (id: string) => void;
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
    (row.cpm == null || (typeof row.cpm === 'number' && Number.isFinite(row.cpm) && row.cpm >= 0)) &&
    (row.rank === undefined || (Number.isSafeInteger(row.rank) && (row.rank as number) > 0));
};
const validBoard = (data: Board) => Array.isArray(data.entries) && data.entries.every(validEntry) &&
  (data.self == null || validEntry(data.self)) && (data.total === undefined || (Number.isSafeInteger(data.total) && data.total >= 0)) &&
  (data.displayDays === undefined || (Number.isSafeInteger(data.displayDays) && data.displayDays > 0 && data.displayDays <= 3650));

const isRankingPath = () => /^\/rankings\/*$/u.test(window.location.pathname);
function initialFilters(initial: Filters, ownerId: string | null) {
  const query = new URLSearchParams(isRankingPath() ? window.location.search : '');
  const language = query.get('language'); const difficulty = query.get('difficulty');
  const period = query.get('period'); const board = query.get('board'); const page=Number(query.get('page')||1);
  return {
    language: language === 'zh' || language === 'en' ? language : initial.language,
    difficulty: difficulty === 'beginner' || difficulty === 'intermediate' || difficulty === 'advanced' ? difficulty : 'all',
    page: Number.isSafeInteger(page)&&page>=1&&page<=100000?page:1,
    period: period === 'week' || period === 'month' ? period : 'all',
    board: board === 'guest' || board === 'user' ? board : ownerId ? 'user' : 'guest',

  } as const;
}

export function RankingView({ initial, articles, isAdmin, ownerId, onAddressChange, onProfile }: Props) {
  const { t, locale } = useI18n();
const difficulties: Record<RankingDifficulty, string> = { all:t('全部','All'), beginner: t("入门", "Beginner"), intermediate: t("进阶", "Intermediate"), advanced: t("挑战", "Advanced") };

  const [selected] = useState(() => initialFilters(initial, ownerId));
  const [language, setLanguage] = useState<Language>(selected.language);
  const [difficulty, setDifficulty] = useState<RankingDifficulty>(selected.difficulty);
  const [page, setPage] = useState(selected.page);
  const [period, setPeriod] = useState<string>(selected.period);
  const [boardKind, setBoardKind] = useState<'guest' | 'user'>(selected.board);
  const [revision, setRevision] = useState(0);
  const [board, setBoard] = useState<{ query: string; data: Board }>();
  const [failure, setFailure] = useState<{ query: string; message: string }>();
  const [selectedScore, setSelectedScore] = useState<RankingEntry>();
  const [reason, setReason] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [removing, setRemoving] = useState(false);
  const request = new URLSearchParams({ board: boardKind, language, difficulty, period, page: String(page) }).toString();
  const identity = `${revision}:${request}`;

  useEffect(() => {
    if (!request || !isRankingPath()) return;
    const current = new URLSearchParams(window.location.search);
    for (const [key, value] of new URLSearchParams(request)) current.set(key, value);
    for (const key of ['articleId','duration','mode','strict']) current.delete(key);
    const address = `${window.location.pathname}?${current}${window.location.hash}`;
    if (address !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', address);
    onAddressChange?.(address);
  }, [request, onAddressChange]);

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
      <div className="segmented feature-segments" role="group" aria-label={t('排行榜类型','Leaderboard type')}>{(['user','guest'] as const).map(kind=><button key={kind} aria-pressed={boardKind===kind} onClick={()=>{setBoardKind(kind);setPage(1);}}>{kind==='user'?t('用户榜','Members'):t('游客榜','Guests')}</button>)}</div>
      <div className="segmented feature-segments" role="group" aria-label={t('排行语言','Article language')}>{(['zh','en'] as const).map(lang=><button key={lang} aria-pressed={language===lang} onClick={()=>{setLanguage(lang);setPage(1);}}>{lang==='zh'?t('中文','Chinese'):'English'}</button>)}</div>
    </div>
    <div className="ranking-simple-filters">
      <div><span>{t('难度','Difficulty')}</span><div className="segmented feature-segments" role="group" aria-label={t('难度','Difficulty')}>{Object.entries(difficulties).map(([key,name])=><button key={key} aria-pressed={difficulty===key} onClick={()=>{setDifficulty(key as RankingDifficulty);setPage(1);}}>{name}</button>)}</div></div>
      <div><span>{t('排行时段','Period')}</span><div className="segmented feature-segments" role="group" aria-label={t('排行时段','Period')}>{[['week',t('近7天','7 days')],['month',t('近30天','30 days')],['all',t('全部','All')]].map(([key,name])=><button key={key} aria-pressed={period===key} onClick={()=>{setPeriod(key);setPage(1);}}>{name}</button>)}</div></div>
    </div>
    {error && <><p className="form-error" role="alert">{<SystemMessage text={error} />}</p><button type="button" className="outline-button" onClick={() => setRevision((value) => value + 1)}>{t("重试", "Retry")}</button></>}
    {!!request && !data && !error && <p className="empty-state" role="status">{t("加载中…", "Loading…")}</p>}
    {!!data?.displayDays && <p className="feature-muted">{t("显示最近 ", "Showing the last  ")}{data.displayDays} {t("天成绩", "days of scores")}</p>}
    {data?.self && <p className="ranking-self"><strong>{t("我的排名", "My rank")}</strong> {t("第 ", "# ")}{data.self.rank} {t("名 ", "players ")}<span>{data.self.speed} {unit}{language==='en'?` · ${Math.round((data.self.cpm??data.self.speed*5)*100)/100} ${t('字符/分钟','chars/min')}`:''} · {data.self.accuracy}%</span></p>}
    {data && !data.entries.length && <p className="empty-state">{t("暂无成绩", "No scores yet")}</p>}
    {!!data?.entries.length && <div className="ranking-table-scroll"><table className="ranking-table"><thead><tr><th>{t('排名','Rank')}</th><th>{t('用户','Player')}</th><th>{language==='en'?'WPM ↓':t('字符/分钟 ↓','chars/min ↓')}</th>{language==='en'&&<th>{t('字符/分钟','chars/min')}</th>}<th>{t('准确率','Accuracy')}</th>{isAdmin&&<th>{t('操作','Actions')}</th>}</tr></thead><tbody>{data.entries.map((entry,index)=>{
      const rank=entry.rank??(page-1)*10+index+1;
      return <tr key={entry.attemptId??index} className={entry.mine?'rank-mine':undefined}>
        <td><span className={'rank-number rank-'+rank}>{rank<=3?<><Crown size={17} weight="fill"/>{rank}</>:rank}</span></td>
        <td>{entry.userId&&entry.profilePublic!==false?<a className="rank-player" href={'/users/'+encodeURIComponent(entry.userId)} onClick={event=>{if(onProfile&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onProfile(entry.userId!);}}}><AccountAvatar avatar={entry.avatar} size={30}/><span>{entry.nickname}</span></a>:<span className="rank-player"><AccountAvatar avatar={entry.avatar} size={30}/><span>{entry.nickname}</span></span>}</td>
        <td className="rank-speed">{entry.speed}</td>{language==='en'&&<td>{Math.round((entry.cpm??entry.speed*5)*100)/100}</td>}<td className="rank-accuracy">{entry.accuracy}%</td>
        {isAdmin&&<td><button className="text-button" onClick={()=>{setReason('');setRemoveError('');setSelectedScore(entry);}}>{t('下架','Unpublish')}</button></td>}
      </tr>;
    })}</tbody></table></div>}
    {data&&data.total!==undefined&&data.total>10&&<nav className="ranking-pagination" aria-label={t('排行榜分页','Leaderboard pages')}><button className="outline-button" disabled={page===1} onClick={()=>setPage(p=>p-1)}>{t('上一页','Previous')}</button><span>{page} / {Math.max(1,Math.ceil(data.total/10))}</span><button className="outline-button" disabled={page>=Math.ceil(data.total/10)} onClick={()=>setPage(p=>p+1)}>{t('下一页','Next')}</button></nav>}
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
