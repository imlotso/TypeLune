import { expect, it } from 'vitest';
import { articleIdFromPath, mainRoute, pathForArticle, pathForView } from '../src/lib/routes';

it('maps every main page to a stable path and rejects unknown paths', () => {
  const pairs = [['/', 'practice'], ['/library', 'library'], ['/rankings', 'rankings'], ['/records', 'history'], ['/drafts', 'drafts'],
    ['/mistakes', 'mistakes'], ['/stats', 'stats'], ['/feedback', 'feedback'], ['/account/data', 'data'], ['/help', 'help'], ['/about', 'about'], ['/privacy', 'privacy'], ['/terms', 'terms']] as const;
  for (const [path, view] of pairs) { expect(mainRoute(path)).toBe(view); expect(pathForView(view)).toBe(path); }
  expect(mainRoute('/library/')).toBe('library');
  expect(mainRoute('/unknown')).toBe('notfound');
  expect(mainRoute('/library/not-a-page')).toBe('notfound');
});


it('round-trips public article IDs and rejects malformed paths', () => {
  expect(pathForArticle('汉 字/one')).toBe('/articles/%E6%B1%89%20%E5%AD%97%2Fone');
  expect(articleIdFromPath('/articles/%E6%B1%89%20%E5%AD%97%2Fone')).toBe('汉 字/one');
  expect(mainRoute('/articles/zh-beginner-1')).toBe('article');
  expect(articleIdFromPath('/articles/%FF')).toBeUndefined();
  expect(mainRoute('/articles/%FF')).toBe('notfound');
  expect(mainRoute('/articles/a/b')).toBe('notfound');
});

it('round-trips record detail IDs without treating malformed addresses as records', async () => {
  const { pathForRecord, recordIdFromPath } = await import('../src/lib/routes');
  expect(pathForRecord('abc/你好')).toBe('/records/abc%2F%E4%BD%A0%E5%A5%BD');
  expect(recordIdFromPath('/records/abc%2F%E4%BD%A0%E5%A5%BD')).toBe('abc/你好');
  expect(mainRoute('/records/example')).toBe('history');
  expect(recordIdFromPath('/records/%FF')).toBeUndefined();
  expect(mainRoute('/records/%FF')).toBe('notfound');
});

it('routes feedback details without accepting malformed identifiers', async () => {
  const { feedbackIdFromPath, pathForFeedback } = await import('../src/lib/routes');
  expect(pathForFeedback('one/二')).toBe('/feedback/one%2F%E4%BA%8C');
  expect(feedbackIdFromPath('/feedback/one%2F%E4%BA%8C')).toBe('one/二');
  expect(mainRoute('/feedback/example')).toBe('feedback');
  expect(mainRoute('/feedback/%FF')).toBe('notfound');
});
