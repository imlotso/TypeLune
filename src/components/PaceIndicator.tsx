import type { Language } from '../data/articles';

export function PaceIndicator({ language, target, secondsAhead, notice, partial }: { language: Language; target?: number; secondsAhead?: number; notice?: string; partial?: boolean }) {
  const unit = language === 'zh' ? '字/分' : 'WPM';
  const difference = secondsAhead === undefined ? '' : secondsAhead > 0 ? `领先 ${secondsAhead} 秒` : secondsAhead < 0 ? `落后 ${Math.abs(secondsAhead)} 秒` : '持平';
  return <div className="pace-indicator" role="group" aria-label="目标配速">
    {target !== undefined ? <span>目标 {target} {unit}{difference && ` · ${difference}`}</span> : <span>{notice ?? '暂无同条件成绩'}</span>}
    {partial && <span className="feature-muted">基于已读取的记录</span>}
  </div>;
}
