import { useMemo, useState } from 'react';
import { Notebook } from '@phosphor-icons/react/Notebook';
import { Play } from '@phosphor-icons/react/Play';
import type { Language } from '../data/articles';
import { collectMistakes, createMistakeDrill } from '../lib/analysis';
import type { ArticleSnapshot, MistakeStatus, PracticeRecord } from '../lib/models';
import { readableCharacter } from '../lib/practice-lines';

type Props = { records: PracticeRecord[]; states: Record<string, MistakeStatus>; onStatus: (id: string, status?: MistakeStatus) => void; onPractice: (article: ArticleSnapshot) => void };

export function MistakesView({ records, states, onStatus, onPractice }: Props) {
  const [language, setLanguage] = useState<Language>('zh');
  const [selected, setSelected] = useState(new Set<string>());
  const [status, setStatus] = useState<'active' | 'mastered' | 'ignored' | 'all'>('active');
  const [period, setPeriod] = useState('');
  const [frequency, setFrequency] = useState('');
  const entries = useMemo(() => collectMistakes(records), [records]);
  const shown = entries.filter((entry) => entry.language === language && (status === 'all' || (states[entry.id] ?? 'active') === status) &&
    (!period || entry.lastSeen >= Date.now() - Number(period) * 86_400_000) && (!frequency || entry.count >= Number(frequency)));
  const drill = createMistakeDrill(shown.filter(({ id }) => selected.has(id)), language);
  const allSelected = shown.length > 0 && shown.every((entry) => selected.has(entry.id));
  const truncated = records.some((record) => record.language === language && (record.mistakesTruncated || (record.mistakes?.length ?? 0) >= 500));

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const entry of shown) { if (allSelected) next.delete(entry.id); else next.add(entry.id); }
      return next;
    });
  }

  return <section className="content-panel mistakes feature-panel">
    <div className="content-heading">
      <h1><Notebook size={25} aria-hidden="true" /> 错字本</h1>
      <button className="primary-button feature-action-button" disabled={!drill.text.trim()} onClick={() => onPractice(drill)}><Play size={16} aria-hidden="true" /> 专项练习</button>
    </div>
    <div className="feature-toolbar">
      <div className="segmented feature-segments" role="group" aria-label="错字语言">
        <button aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中文</button>
        <button aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
      </div>
      <button className="outline-button feature-action-button" disabled={!shown.length} onClick={toggleAll}>{allSelected ? '取消全选' : '全选'}</button>
    </div>
    <div className="feature-filters">
      <label>状态<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="active">待练习</option><option value="mastered">已掌握</option><option value="ignored">已忽略</option><option value="all">全部</option></select></label>
      <label>时间<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="">全部</option><option value="7">近 7 天</option><option value="30">近 30 天</option></select></label>
      <label>频次<select value={frequency} onChange={(event) => setFrequency(event.target.value)}><option value="">全部</option><option value="2">至少 2 次</option><option value="5">至少 5 次</option></select></label>
    </div>
    {truncated && <p className="feature-muted" role="status">错字样本可能不完整</p>}
    {!shown.length ? <p className="empty-state">暂无错字</p> : <ul className="feature-list">
      {shown.map((entry) => {
        const expected = readableCharacter(entry.expected);
        const date = new Date(entry.lastSeen);
        const current = states[entry.id];
        return <li key={entry.id} className="feature-row">
          <div className="feature-row-main">
            <label className="mistake-option">
              <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggle(entry.id)} />
              <strong>{expected}</strong>
            </label>
            <div className="feature-meta">
              <span>{entry.count} 次</span>
              <time dateTime={date.toISOString()}>{date.toLocaleDateString('zh-CN')}</time>
              <span>误输 {entry.actual.map((value) => readableCharacter(value) || '空').join('、')}</span>
            </div>
            {entry.contexts[0] && <p className="mistake-context">{entry.contexts[0]}</p>}
          </div>
          <div className="feature-actions">
            <button className="outline-button feature-action-button" onClick={() => onStatus(entry.id, current === 'mastered' ? undefined : 'mastered')}>{current === 'mastered' ? '取消掌握' : '标记已掌握'}</button>
            <button className="text-button" onClick={() => onStatus(entry.id, current === 'ignored' ? undefined : 'ignored')}>{current === 'ignored' ? '恢复' : '忽略'}</button>
          </div>
        </li>;
      })}
    </ul>}
  </section>;
}
