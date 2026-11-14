import type { Language } from '../data/articles';
import { analyzeProcessTrace, isProcessTrace, type ProcessTrace } from '../lib/process-trace';

const display = (value: number) => Math.round(value * 10) / 10;
const formatTime = (time: number) => `${Math.floor(time / 60_000)}:${String(Math.floor(time / 1000) % 60).padStart(2, '0')}`;

export function ProcessChart({ trace, language }: { trace?: ProcessTrace; language: Language }) {
  if (!isProcessTrace(trace)) return <section className="process-chart"><h3>练习过程</h3><p className="feature-muted">暂无过程数据</p></section>;
  const { segments, stability } = analyzeProcessTrace(trace, language);
  const end = Math.max(1, trace.samples.at(-1)!.time);
  const maxSpeed = Math.max(0, ...segments.map((segment) => segment.speed));
  const maxErrors = Math.max(0, ...segments.map((segment) => segment.errors));
  const topSpeed = Math.max(1, maxSpeed);
  const topErrors = Math.max(1, maxErrors);
  const x = (time: number) => 42 + time / end * 538;
  const speedY = (speed: number) => 112 - speed / topSpeed * 88;
  const speedPoints = segments.map((segment) => `${x((segment.from + segment.to) / 2)},${speedY(segment.speed)}`).join(' ');
  return <section className="process-chart">
    <h3>练习过程</h3>
    <div className="process-chart-heading"><span>稳定性 {stability === null ? '样本不足' : <strong>{stability}%</strong>}</span>
      <span>采样基准 {trace.intervalMs / 1000} 秒{trace.compacted ? ' · 已合并' : ''}</span></div>
    {trace.missing && <p className="feature-muted" role="status">部分过程数据缺失</p>}
    {segments.length ? <>
      <svg className="process-chart-plot" viewBox="0 0 600 168" role="img" aria-label="练习过程速度和错误分布">
        <line x1="42" x2="580" y1="112" y2="112" className="process-axis" />
        <line x1="42" x2="580" y1="155" y2="155" className="process-axis" />
        {segments.map((segment, index) => {
          const width = Math.max(1, x(segment.to) - x(segment.from) - 2);
          const height = segment.errors / topErrors * 31;
          return <rect key={`${segment.from}-${index}`} x={x(segment.from) + 1} y={155 - height} width={width} height={height} className="process-error-bar"><title>{`${formatTime(segment.from)}–${formatTime(segment.to)}：${segment.errors} 次错误输入`}</title></rect>;
        })}
        <polyline points={speedPoints} className="process-speed-line" />
        {segments.length === 1 && <circle cx={x((segments[0].from + segments[0].to) / 2)} cy={speedY(segments[0].speed)} r="3" className="process-speed-point" />}
      </svg>
      <div className="process-chart-legend"><span>速度 · {language === 'zh' ? '字/分' : 'WPM'} · 最高 {display(maxSpeed)}</span><span>错误输入 · 最高 {maxErrors} 次</span><span>{formatTime(trace.samples[0].time)}–{formatTime(end)}</span></div>
    </> : <p className="feature-muted">过程样本不足</p>}
    <details><summary>计算说明</summary><p>各段按净正确字符增长和有效用时计算速度；增长为负时按零计算，英文每 5 个字符为 1 词。错误柱为每段新增的错误输入次数。稳定性为 100 × max(0, 1 − 分段速度的用时加权标准差 / 用时加权平均速度)，至少需要 3 段、15 秒，且不能有缺失或零平均速度。此指标与 Monkeytype 的稳定性并不等同。</p></details>
  </section>;
}
