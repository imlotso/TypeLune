import { expect, it } from 'vitest';
import { createRoundMistakeDrill } from '../src/lib/analysis';
import type { PracticeRecord } from '../src/lib/models';

const chinese: PracticeRecord = { recordId: 'one', language: 'zh', difficulty: 'beginner', duration: 300, speed: 20, accuracy: 90, finishedAt: 1000,
  article: { id: 'zh', title: '旧窗', text: '秋风吹过旧窗，我想起你。', language: 'zh', difficulty: 'beginner', custom: false },
  mistakes: [{ position: 5, expected: '窗', actual: '床' }] };

it('builds a personal Chinese drill from a short source phrase and the chosen repetition count', () => {
  const drill = createRoundMistakeDrill(chinese, 2);
  expect(drill).toMatchObject({ title: '本轮错字专项', custom: true, language: 'zh' });
  expect(drill?.text.split('\n')).toEqual(['秋风吹过旧窗', '秋风吹过旧窗']);
});

it('uses whole English words and adjacent context instead of isolated letters', () => {
  const article = { id: 'en', title: 'Evening', text: 'I remember the quiet evening.', language: 'en' as const, difficulty: 'beginner' as const, custom: false };
  const result = createRoundMistakeDrill({ ...chinese, language: 'en', article, mistakes: [{ position: 16, expected: 'u', actual: 'v' }] }, 1);
  expect(result?.text).toBe('the quiet evening');
  expect(result?.custom).toBe(true);
});

it('rejects empty, mismatched or invalid samples and repeat counts', () => {
  expect(createRoundMistakeDrill({ ...chinese, mistakes: [{ position: 5, expected: '错', actual: '床' }] }, 2)).toBeUndefined();
  expect(createRoundMistakeDrill({ ...chinese, mistakes: [], typed: '' }, 2)).toBeUndefined();
  expect(createRoundMistakeDrill(chinese, 0)).toBeUndefined();
  expect(createRoundMistakeDrill(chinese, 11)).toBeUndefined();
});
