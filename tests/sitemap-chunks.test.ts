import { expect, it } from 'vitest';
import { sitemapChunks } from '../server/sitemap-chunks';

it('keeps every URL in order while respecting both entry and UTF-8 byte limits', () => {
  const entries = ['中文', '中文', 'a', 'b', 'c'];
  const chunks = sitemapChunks(entries, 2, 8);
  expect(chunks.flat()).toEqual(entries);
  expect(chunks.length).toBeGreaterThan(1);
  for (const chunk of chunks) {
    expect(chunk.length).toBeLessThanOrEqual(2);
    expect(Buffer.byteLength(chunk.join(''))).toBeLessThanOrEqual(8);
  }
});

it('does not silently drop a single entry that exceeds the byte limit', () => {
  expect(() => sitemapChunks(['中文'], 2, 5)).toThrow(RangeError);
});
