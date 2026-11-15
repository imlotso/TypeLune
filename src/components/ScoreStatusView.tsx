import type { ServerScoreStatus } from '../lib/score-status';

export function scoreStatusText(status: ServerScoreStatus) {
  switch (status.state) {
    case 'not_submitted': return status.expired ? '尚未提交，提交时间已过。' : '尚未提交。';
    case 'pending': return '已提交，待复核。';
    case 'ranked': return '已上榜。';
    case 'published': return `已发布，${status.message || '榜单显示同条件最高成绩'}。`;
    case 'rejected': return '审核未通过。';
    case 'removed': return '成绩已下架。';
    case 'ineligible': return '不参与排行。';
    case 'unavailable': return '成绩状态暂不可用。';
  }
}
export function ScoreStatusView({ status }: { status: ServerScoreStatus }) {
  return <div className="score-status" role="status"><p><strong>成绩状态：</strong><span>{scoreStatusText(status)}</span></p>{(status.state === 'rejected' || status.state === 'removed') && status.message && <p>处理说明：{status.message}</p>}</div>;
}
