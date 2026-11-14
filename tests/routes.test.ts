import { expect, it } from 'vitest';
import { mainRoute, pathForView } from '../src/lib/routes';

it('maps every main page to a stable path and rejects unknown paths', () => {
  const pairs = [['/', 'practice'], ['/library', 'library'], ['/rankings', 'rankings'], ['/records', 'history'], ['/drafts', 'drafts'],
    ['/mistakes', 'mistakes'], ['/stats', 'stats'], ['/feedback', 'feedback'], ['/account/data', 'data'], ['/help', 'help'], ['/about', 'about'], ['/privacy', 'privacy'], ['/terms', 'terms']] as const;
  for (const [path, view] of pairs) { expect(mainRoute(path)).toBe(view); expect(pathForView(view)).toBe(path); }
  expect(mainRoute('/library/')).toBe('library');
  expect(mainRoute('/unknown')).toBe('notfound');
  expect(mainRoute('/library/not-a-page')).toBe('notfound');
});
