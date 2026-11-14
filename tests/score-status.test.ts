import { expect, it } from 'vitest';
import { mergePracticeRecords } from '../src/lib/records';
import type { PracticeRecord } from '../src/lib/models';

it('does not present a cached local review status as current server state', () => {
  const record: PracticeRecord = { recordId: 'one', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 90, finishedAt: 1000,
    scoreStatus: { state: 'ranked', eligible: true } };
  expect(mergePracticeRecords([record], [], [])[0].scoreStatus).toBeUndefined();
  expect(mergePracticeRecords([record], [{ ...record, scoreStatus: { state: 'rejected', eligible: false, message: '审核未通过' } }], [])[0].scoreStatus).toMatchObject({ state: 'rejected' });
});
