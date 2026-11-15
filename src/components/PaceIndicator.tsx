import { useI18n } from '../lib/i18n';
import type { Language } from '../data/articles';

export function PaceIndicator({ language, target, secondsAhead, notice, partial }: { language: Language; target?: number; secondsAhead?: number; notice?: string; partial?: boolean }) {
  const { t, locale } = useI18n();
  const unit = language === 'zh' ? t("字/分", "chars/min") : 'WPM';
  const difference = secondsAhead === undefined ? '' : secondsAhead > 0 ? t(`领先 ${secondsAhead} 秒`, `${secondsAhead}s ahead`) : secondsAhead < 0 ? t(`落后 ${Math.abs(secondsAhead)} 秒`, `${Math.abs(secondsAhead)}s behind`) : t("持平", "On pace");
  return <div className="pace-indicator" role="group" aria-label={t("目标配速", "Target pace")}>
    {target !== undefined ? <span>{t("目标", "Target")} {target} {unit}{difference && ` · ${difference}`}</span> : <span>{notice ?? t("暂无同条件成绩", "No matching results yet")}</span>}
    {partial && <span className="feature-muted">{t("基于已读取的记录", "Based on loaded records")}</span>}
  </div>;
}
