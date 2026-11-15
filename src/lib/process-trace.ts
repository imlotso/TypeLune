import type { Language } from '../data/articles.js';

export type ProcessSample = { time: number; progress: number; correct: number; errors: number };
export type ProcessTrace = { version: 1; intervalMs: number; missing: boolean; compacted: boolean; samples: ProcessSample[] };
export type ProcessSegment = { from: number; to: number; speed: number; errors: number };
const baseIntervalMs = 5000;
const maximumTime = 24 * 60 * 60_000;
const maximumSamples = 720;
const maximumBytes = 64 * 1024;

export function isProcessTrace(value: unknown): value is ProcessTrace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const trace = value as Record<string, unknown>;
  if (Object.keys(trace).some((key) => !['version', 'intervalMs', 'missing', 'compacted', 'samples'].includes(key)) ||
    trace.version !== 1 || !Number.isSafeInteger(trace.intervalMs) || (trace.intervalMs as number) < baseIntervalMs || (trace.intervalMs as number) > maximumTime ||
    typeof trace.missing !== 'boolean' || typeof trace.compacted !== 'boolean' || !Array.isArray(trace.samples) ||
    trace.samples.length < 1 || trace.samples.length > maximumSamples) return false;
  let previousTime = -1;
  let previousErrors = 0;
  for (const sample of trace.samples) {
    if (!sample || typeof sample !== 'object' || Array.isArray(sample) || Object.keys(sample).some((key) => !['time', 'progress', 'correct', 'errors'].includes(key))) return false;
    const { time, progress, correct, errors } = sample as ProcessSample;
    if (![time, progress, correct, errors].every(Number.isSafeInteger) || time < 0 || time > maximumTime || time <= previousTime ||
      progress < 0 || progress > 30_000 || correct < 0 || correct > progress || errors < previousErrors || errors > 10_000_000) return false;
    previousTime = time;
    previousErrors = errors;
  }
  if (!trace.missing && (trace.samples[0] as ProcessSample).time !== 0) return false;
  try { return new TextEncoder().encode(JSON.stringify(trace)).length <= maximumBytes; } catch { return false; }
}

export function initialProcessTrace(initial: ProcessSample, missing = false): ProcessTrace {
  return { version: 1, intervalMs: baseIntervalMs, missing: missing || initial.time !== 0, compacted: false, samples: [{ ...initial }] };
}

// Only append observations that actually occurred. A delayed timer is a gap,
// not an invitation to fabricate points for the missing intervals.
export function appendProcessSample(trace: ProcessTrace, sample: ProcessSample, force: boolean): ProcessTrace {
  const previous = trace.samples[trace.samples.length - 1];
  if (sample.time < previous.time) return { ...trace, missing: true };
  if (sample.time === previous.time) {
    if (!force) return trace;
    return { ...trace, samples: [...trace.samples.slice(0, -1), { ...sample }] };
  }
  const elapsed = sample.time - previous.time;
  if (!force && elapsed < trace.intervalMs) return trace;
  let result: ProcessTrace = { ...trace, missing: trace.missing || elapsed > trace.intervalMs * 1.5, samples: [...trace.samples, { ...sample }] };
  if (result.samples.length > maximumSamples || new TextEncoder().encode(JSON.stringify(result)).length > maximumBytes) {
    const last = result.samples.length - 1;
    result = { ...result, compacted: true, intervalMs: Math.min(maximumTime, result.intervalMs * 2),
      samples: result.samples.filter((_point, index) => index === 0 || index === last || index % 2 === 0) };
  }
  return result;
}

export function analyzeProcessTrace(trace: ProcessTrace, language: Language) {
  const segments: ProcessSegment[] = trace.samples.slice(1).map((sample, index) => {
    const previous = trace.samples[index];
    const minutes = (sample.time - previous.time) / 60_000;
    const netCorrect = Math.max(0, sample.correct - previous.correct);
    return { from: previous.time, to: sample.time, speed: netCorrect / minutes / (language === 'en' ? 5 : 1), errors: sample.errors - previous.errors };
  });
  let stability: number | null = null;
  if (!trace.missing && segments.length >= 3 && trace.samples.at(-1)!.time - trace.samples[0].time >= 15_000) {
    const totalMs = segments.reduce((sum, segment) => sum + segment.to - segment.from, 0);
    const mean = segments.reduce((sum, segment) => sum + segment.speed * (segment.to - segment.from), 0) / totalMs;
    if (mean > 0 && Number.isFinite(mean)) {
      const variance = segments.reduce((sum, segment) => sum + (segment.to - segment.from) * (segment.speed - mean) ** 2, 0) / totalMs;
      stability = Math.round(Math.max(0, 1 - Math.sqrt(variance) / mean) * 100);
    }
  }
  return { segments, stability };
}
