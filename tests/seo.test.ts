// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { updatePageMetadata } from '../src/lib/seo';

it('updates route metadata and excludes personal and profile pages from indexing', () => {
  updatePageMetadata('/lessons', 'en');
  expect(document.title).toBe('Typing lessons · TypeLune');
  expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
  for (const path of ['/account', '/records/123', '/users/123', '/admin', '/missing']) {
    updatePageMetadata(path, 'zh');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.title).toBe('TypeLune');
  }
  updatePageMetadata('/rankings/', 'zh');
  expect(document.title).toBe('打字排行榜 · TypeLune');
});
