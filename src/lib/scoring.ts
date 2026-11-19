export type Score = { correct: number; total: number; accuracy: number; cpm: number; wpm: number };

const graphemes = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : undefined;

export function splitCharacters(text: string): string[] {
  const normalized = text.normalize('NFC');
  if (graphemes) {
    return Array.from(graphemes.segment(normalized), (item) => item.segment);
  }
  return Array.from(normalized);
}

export function scoreTyping(target: string, input: string, seconds: number): Score {
  const { correct, total } = countTyping(splitCharacters(target), splitCharacters(input));
  return scoreFromCounts(correct, total, seconds);
}

export function countTyping(expected: readonly string[], actual: readonly string[], offset = 0) {
  let correct = 0;
  for (let index = offset; index < actual.length; index++) {
    if (actual[index] === expected[index]) correct++;
  }
  return { correct, total: Math.max(0, actual.length - offset) };
}

export function scoreFromCounts(correct: number, total: number, seconds: number): Score {
  const round = (value: number) => Math.round(value * 100) / 100;
  const cpm = seconds > 0 && Number.isFinite(seconds) ? correct * 60 / seconds : 0;
  return {
    correct,
    total,
    accuracy: total ? round(correct / total * 100) : 0,
    cpm: round(cpm),
    wpm: round(cpm / 5),
  };
}
