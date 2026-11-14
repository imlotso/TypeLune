import { expect, it } from 'vitest';
import { makeShareCardData, truncateCanvasText } from '../src/lib/share-card';
import type { PracticeRecord } from '../src/lib/models';

it('keeps only public card fields and never copies article bodies or typed text', () => {
  const record: PracticeRecord = { recordId: 'private-id', ownerId: 'private-owner', language: 'zh', difficulty: 'beginner', duration: 300, mode: 'timed', speed: 55, accuracy: 98, finishedAt: 1000, elapsedMs: 12_000,
    article: { id: 'private', title: '私文标题', text: '绝密正文', language: 'zh', difficulty: 'beginner', custom: true }, typed: '绝密输入' };
  const data = makeShareCardData(record, 'https://typing.example.test/path', '云朵', true);
  expect(data).toMatchObject({ siteName: '云打字练习', siteUrl: 'https://typing.example.test', language: 'zh', speed: 55, accuracy: 98, title: '私文标题', nickname: '云朵', personalBest: true });
  const json = JSON.stringify(data);
  for (const secret of ['绝密正文', '绝密输入', 'private-owner', 'private-id']) expect(json).not.toContain(secret);
});

it('truncates long text without splitting grapheme clusters', () => {
  const width = (value: string) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length * 10;
  const result = truncateCanvasText('山海👨‍👩‍👧‍👦长标题', 40, width);
  expect(result).toBe('山海👨‍👩‍👧‍👦…');
  expect(width(result)).toBeLessThanOrEqual(40);
});

it('uses the actual English correct characters per minute supplied by scoring', () => {
  const record: PracticeRecord = { recordId: 'one', language: 'en', difficulty: 'beginner', duration: 300, speed: 25.29, accuracy: 99, finishedAt: 1000 };
  expect(makeShareCardData(record, 'https://example.test', '', false, 126.43).correctCpm).toBe(126.43);
});
