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
