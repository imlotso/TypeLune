import { describe, expect, it } from 'vitest';
import { analyzeProcessTrace, appendProcessSample, initialProcessTrace, isProcessTrace } from '../src/lib/process-trace';

const point = (time: number, progress: number, correct = progress, errors = 0) => ({ time, progress, correct, errors });

describe('practice process traces', () => {
  it('samples actual active time and shows segment speed and error changes', () => {
    let trace = initialProcessTrace(point(0, 0));
    trace = appendProcessSample(trace, point(3000, 2), false);
    expect(trace.samples).toHaveLength(1);
    trace = appendProcessSample(trace, point(5000, 5, 4, 1), false);
    trace = appendProcessSample(trace, point(10000, 9, 8, 2), false);
    trace = appendProcessSample(trace, point(15000, 13, 12, 2), true);
    const zh = analyzeProcessTrace(trace, 'zh');
    const en = analyzeProcessTrace(trace, 'en');
    expect(zh.segments.map((segment) => segment.speed)).toEqual([48, 48, 48]);
    expect(zh.segments.map((segment) => segment.errors)).toEqual([1, 1, 0]);
    expect(en.segments[0].speed).toBeCloseTo(9.6);
    expect(zh.stability).toBe(100);
    expect(isProcessTrace(trace)).toBe(true);
  });

  it('does not claim a stability score with gaps, too few segments or zero speed', () => {
    let trace = initialProcessTrace(point(0, 0));
    trace = appendProcessSample(trace, point(10000, 4), false);
    expect(trace.missing).toBe(true);
    expect(analyzeProcessTrace(trace, 'zh').stability).toBeNull();
    let zero = initialProcessTrace(point(0, 0));
    for (let time = 5000; time <= 15000; time += 5000) zero = appendProcessSample(zero, point(time, 0), false);
    expect(analyzeProcessTrace(zero, 'zh').stability).toBeNull();
    expect(analyzeProcessTrace(initialProcessTrace(point(0, 0)), 'zh').stability).toBeNull();
  });

  it('keeps the time axis ordered and bounded while recording long sessions', () => {
    let trace = initialProcessTrace(point(0, 0));
    for (let time = 5000; time <= 10_000_000; time += 5000) trace = appendProcessSample(trace, point(time, Math.floor(time / 5000)), false);
    expect(trace.samples.length).toBeLessThanOrEqual(720);
    expect(JSON.stringify(trace).length).toBeLessThanOrEqual(64 * 1024);
    expect(trace.compacted).toBe(true);
    expect(trace.intervalMs).toBeGreaterThan(5000);
    expect(isProcessTrace(trace)).toBe(true);
    expect(trace.samples[0].time).toBe(0);
    expect(trace.samples.at(-1)!.time).toBeGreaterThan(9_900_000);
    expect(trace.samples.every((sample, index, all) => index === 0 || sample.time > all[index - 1].time)).toBe(true);
  });

  it('rejects malformed, reordered and excessive traces', () => {
    const initial = initialProcessTrace(point(0, 0));
    expect(isProcessTrace({ ...initial, samples: [point(5, 1), point(4, 2)] })).toBe(false);
    expect(isProcessTrace({ ...initial, samples: [point(0, 1, 2)] })).toBe(false);
    expect(isProcessTrace({ ...initial, samples: Array.from({ length: 721 }, (_, i) => point(i, i)) })).toBe(false);
    expect(isProcessTrace({ ...initial, samples: [point(5000, 1)] })).toBe(false);
    expect(isProcessTrace({ ...initial, missing: true, samples: [point(5000, 1)] })).toBe(true);
  });
});
