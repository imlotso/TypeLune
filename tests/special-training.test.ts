import { expect, it } from 'vitest';
import { createSpecialDrill, type SpecialDrillKind } from '../src/lib/special-training';

it('creates stable, independent personal drills for each language and topic', () => {
  const kinds: SpecialDrillKind[] = ['numbers', 'punctuation', 'phrases'];
  const drills = (['zh', 'en'] as const).flatMap((language) => kinds.map((kind) => createSpecialDrill(language, kind)));
  expect(new Set(drills.map((drill) => drill.id)).size).toBe(6);
  expect(drills.every((drill) => drill.custom && drill.text.trim() && drill.author === '自编素材')).toBe(true);
  expect(createSpecialDrill('zh', 'numbers')).toEqual(createSpecialDrill('zh', 'numbers'));
  expect(createSpecialDrill('zh', 'numbers').text).toMatch(/[0-9]/);
  expect(createSpecialDrill('zh', 'numbers').text).toMatch(/[０-９]/);
  expect(createSpecialDrill('zh', 'punctuation').text).toMatch(/[，。！？]/);
  expect(createSpecialDrill('zh', 'punctuation').text).toMatch(/[,\.?!]/);
  expect(createSpecialDrill('en', 'phrases').text).toMatch(/[a-z]+ [a-z]+/i);
});
