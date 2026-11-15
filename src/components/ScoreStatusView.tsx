import { useI18n, translate, type UiLocale } from '../lib/i18n';
import type { ServerScoreStatus } from '../lib/score-status';

export function scoreStatusText(status: ServerScoreStatus, locale: UiLocale = 'zh') {
 const t=(zh:string,en:string)=>translate(zh,en,locale);
  switch (status.state) {
    case 'not_submitted': return status.expired ? t("尚未提交，提交时间已过。","Not submitted. Submission window expired.") : t("尚未提交。","Not submitted.");
    case 'pending': return t("已提交，待复核。","Submitted for review.");
    case 'ranked': return t("已上榜。","Published on leaderboard.");
    case 'published': return t(`已发布，${status.message || "榜单显示同条件最高成绩"}。`, `Published. ${status.message || "The leaderboard shows the best matching result"}`);
    case 'rejected': return t("审核未通过。","Review rejected.");
    case 'removed': return t("成绩已下架。","Result removed.");
    case 'ineligible': return t("不参与排行。","Not ranked.");
    case 'unavailable': return t("成绩状态暂不可用。","Result status unavailable.");
  }
}
export function ScoreStatusView({ status }: { status: ServerScoreStatus }) {
  const { t, locale } = useI18n();
  return <div className="score-status" role="status"><p><strong>{t("成绩状态：", "Result status:")}</strong><span>{scoreStatusText(status,locale)}</span></p>{(status.state === 'rejected' || status.state === 'removed') && status.message && <p>{t("处理说明：", "Review note:")}{status.message}</p>}</div>;
}
