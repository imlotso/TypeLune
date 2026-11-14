import type { PracticeRecord } from '../lib/models';
import { comparePersonalBest } from '../lib/personal-best';

const signed = (value: number) => value > 0 ? `+${value}` : String(value);
export function PersonalBestComparison({ current, records, coverage }: { current: PracticeRecord; records: PracticeRecord[]; coverage: 'loading' | 'local' | 'partial' | 'complete' }) {
  if (coverage === 'loading') return <p className="feature-muted" role="status">正在读取同条件记录…</p>;
  const comparison = comparePersonalBest(current, records);
  if (!comparison) return null;
  const unit = current.language === 'zh' ? '字/分' : 'WPM';
  return <section className="personal-best" aria-label="个人最佳与比较">
    <p><strong>个人最佳</strong> {comparison.personalBest} {unit}{comparison.improvement !== null && <span> · 提高 +{comparison.improvement} {unit}</span>}</p>
    {comparison.sampleCount ? <>
      <p>近 {comparison.sampleCount} 次平均：{comparison.averageSpeed} {unit} · 准确率 {comparison.averageAccuracy}%</p>
      <p>本次：{signed(comparison.speedDifference!)} {unit} · 准确率 {signed(comparison.accuracyDifference!)} 个百分点</p>
    </> : <p>暂无此前同条件成绩</p>}
    {coverage !== 'complete' && <p className="feature-muted">{coverage === 'local' ? '仅本机记录' : '基于已读取的记录'}</p>}
  </section>;
}
