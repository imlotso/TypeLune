import { useI18n } from '../lib/i18n';
import type { Language } from '../data/articles';
import { analyzeProcessTrace, isProcessTrace, type ProcessTrace } from '../lib/process-trace';

const display = (value: number) => Math.round(value * 10) / 10;
const formatTime = (time: number) => `${Math.floor(time / 60_000)}:${String(Math.floor(time / 1000) % 60).padStart(2, '0')}`;

export function ProcessChart({ trace, language }: { trace?: ProcessTrace; language: Language }) {
  const { t, locale } = useI18n();
  if (!isProcessTrace(trace)) return <section className="process-chart"><h3>{t("练习过程", "Practice timeline")}</h3><p className="feature-muted">{t("暂无过程数据", "No timeline data")}</p></section>;
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
    <h3>{t("练习过程", "Practice timeline")}</h3>
    <div className="process-chart-heading"><span>{t("稳定性", "Consistency")} {stability === null ? t("样本不足", "Not enough samples") : <strong>{stability}%</strong>}</span>
      <span>{t("采样基准", "Sample interval")} {trace.intervalMs / 1000}  {t("秒", "sec")}{trace.compacted ? t("· 已合并", "· Combined") : ''}</span></div>
    {trace.missing && <p className="feature-muted" role="status">{t("部分过程数据缺失", "Some timeline data is missing")}</p>}
    {segments.length ? <>
      <svg className="process-chart-plot" viewBox="0 0 600 168" role="img" aria-label={t("练习过程速度和错误分布", "Practice speed and error distribution")}>
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
      <div className="process-chart-legend"><span>{t("速度 ·", "Speed ·")} {language === 'zh' ? t("字/分", "chars/min") : 'WPM'}  {t("· 最高", "· Peak")} {display(maxSpeed)}</span><span>{t("错误输入 · 最高", "Errors · Peak")} {maxErrors}  {t("次", "times")}</span><span>{formatTime(trace.samples[0].time)}–{formatTime(end)}</span></div>
    </> : <p className="feature-muted">{t("过程样本不足", "Not enough timeline samples")}</p>}
    <details><summary>{t("计算说明", "Calculation")}</summary><p>{t("各段按净正确字符增长和有效用时计算速度；增长为负时按零计算，英文每 5 个字符为 1 词。错误柱为每段新增的错误输入次数。稳定性为 100 × max(0, 1 − 分段速度的用时加权标准差 / 用时加权平均速度)，至少需要 3 段、15 秒，且不能有缺失或零平均速度。此指标与 Monkeytype 的稳定性并不等同。", "Segment speed uses the net increase in correct characters and active time, with negative growth treated as zero. English uses 5 characters per word. Error bars show new incorrect inputs. Consistency is 100 × max(0, 1 − time-weighted standard deviation / time-weighted mean speed). It requires 3 segments and 15 seconds with no missing data or zero mean speed. This is not the same as Monkeytype consistency.")}</p></details>
  </section>;
}
