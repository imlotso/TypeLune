import { afterEach, expect, it } from 'vitest';
import { localDateBoundary } from '../src/lib/local-date-range';

const originalTimeZone = process.env.TZ;
afterEach(() => { if (originalTimeZone === undefined) delete process.env.TZ; else process.env.TZ = originalTimeZone; });

it('uses local calendar boundaries across daylight-saving changes', () => {
  process.env.TZ = 'America/New_York';
  expect(localDateBoundary('2026-03-08', true)! - localDateBoundary('2026-03-08')!).toBe(23 * 60 * 60 * 1000);
  expect(localDateBoundary('2026-11-01', true)! - localDateBoundary('2026-11-01')!).toBe(25 * 60 * 60 * 1000);
});

it('rejects invalid or unsupported dates before they become cleanup filters', () => {
  expect(localDateBoundary('2026-02-30')).toBeUndefined();
  expect(localDateBoundary('1969-12-31')).toBeUndefined();
  expect(localDateBoundary('2026-1-1')).toBeUndefined();
});
