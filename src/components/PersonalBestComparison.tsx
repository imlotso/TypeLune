import { useI18n } from '../lib/i18n';
import type { PracticeRecord } from '../lib/models';
import { comparePersonalBest } from '../lib/personal-best';

const signed = (value: number) => value > 0 ? `+${value}` : String(value);
export function PersonalBestComparison({ current, records, coverage }: { current: PracticeRecord; records: PracticeRecord[]; coverage: 'loading' | 'local' | 'partial' | 'complete' }) {
  const { t, locale } = useI18n();
  if (coverage === 'loading') return <p className="feature-muted" role="status">{t("正在读取同条件记录…", "Loading matching records…")}</p>;
  const comparison = comparePersonalBest(current, records);
  if (!comparison) return null;
  const unit = current.language === 'zh' ? t("字/分", "chars/min") : 'WPM';
  return <section className="personal-best" aria-label={t("个人最佳与比较", "Personal best comparison")}>
    <p><strong>{t("个人最佳", "Personal best")}</strong> {comparison.personalBest} {unit}{comparison.improvement !== null && <span> {t("· 提高 +", "· Improved +")}{comparison.improvement} {unit}</span>}</p>
    {comparison.sampleCount ? <>
      <p>{t("近", "Last")} {comparison.sampleCount} {t("次平均：", "average:")}{comparison.averageSpeed} {unit} {t("· 准确率", "· Accuracy")} {comparison.averageAccuracy}%</p>
      <p>{t("本次：", "This round:")}{signed(comparison.speedDifference!)} {unit} {t("· 准确率", "· Accuracy")} {signed(comparison.accuracyDifference!)} {t("个百分点", "percentage points")}</p>
    </> : <p>{t("暂无此前同条件成绩", "No previous matching results")}</p>}
    {coverage !== 'complete' && <p className="feature-muted">{coverage === 'local' ? t("仅本机记录", "Local records only") : t("基于已读取的记录", "Based on loaded records")}</p>}
  </section>;
}
