import { useI18n } from '../lib/i18n';
import { useId, useState } from 'react';
import { Keyboard } from '@phosphor-icons/react/Keyboard';
import { Question } from '@phosphor-icons/react/Question';
import type { Score } from '../lib/scoring';

export function EnglishSpeed({ score, display }: { score?: Score; display: 'live' | 'result' }) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const explanationId = useId();

  return <div className={`english-speed english-speed-${display}`} role="group" aria-label={t("英文速度", "English speed")}>
    <div className="english-speed-values">
      {display === 'live' && <Keyboard size={23} aria-hidden="true" />}
      <span className="english-speed-value"><strong>{score?.wpm ?? '—'}</strong> WPM</span>
      <span className="english-speed-value"><strong>{score?.cpm ?? '—'}</strong>  {t("字符/分钟", "chars/min")}</span>
      <button type="button" className="icon-button" aria-label={t("英文速度说明", "About English speed")} aria-expanded={expanded}
        aria-controls={explanationId} onClick={() => setExpanded((open) => !open)}>
        <Question size={20} aria-hidden="true" />
      </button>
    </div>
    <div className="english-speed-explanation" id={explanationId} hidden={!expanded}>
      <p><strong>{t("字符/分钟（CPM）", "Characters per minute (CPM)")}</strong>  {t("等于正确字符数除以有效练习分钟数。正确输入的空格和标点也计入，暂停时间不计。", "Correct characters divided by active practice minutes. Correct spaces and punctuation count; pauses do not.")}</p>
      <p><strong>{t("WPM（标准词/分钟）", "Words per minute (WPM)")}</strong>  {t("按每 5 个正确字符折算为 1 个标准词。例如，200 字符/分钟等于 40 WPM。", "Every 5 correct characters count as one standard word. For example, 200 CPM equals 40 WPM.")}</p>
    </div>
  </div>;
}
