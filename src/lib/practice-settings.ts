import type { Difficulty, Language } from '../data/articles';
import { defaultPace, type PaceSettings, type PracticeMode, type PracticePreset, type PresetReading, type ReaderSettings } from './models';
import { isPaceSettings } from './pace';

export type PortablePracticeSettings = { language: Language; difficulty: Difficulty; mode: PracticeMode; minutes: number; strict: boolean; autoPause: boolean; pace: PaceSettings } & PresetReading;
export type PracticeSettingsFile = { format: 'typing-practice-settings'; version: 1; exportedAt: string; settings: PortablePracticeSettings; presets: PracticePreset[] };
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keysOnly = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key));
const language = (value: unknown) => value === 'zh' || value === 'en';
const difficulty = (value: unknown) => value === 'beginner' || value === 'intermediate' || value === 'advanced';
const mode = (value: unknown) => value === 'timed' || value === 'article';
const minutes = (value: unknown) => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 60;
const numberIn = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const readingKeys = ['fontSize', 'lineHeight', 'visibleLines', 'showTimer', 'showSpeed', 'showAccuracy'];
function isReading(value: unknown, exact: boolean): value is PresetReading {
  return isObject(value) && (!exact || keysOnly(value, readingKeys)) && numberIn(value.fontSize, 12, 40) && numberIn(value.lineHeight, 1, 3) &&
    Number.isInteger(value.visibleLines) && numberIn(value.visibleLines, 1, 12) &&
    ['showTimer', 'showSpeed', 'showAccuracy'].every((key) => typeof value[key] === 'boolean');
}
export function isPracticePreset(value: unknown, exact = false): value is PracticePreset {
  if (!isObject(value) || (exact && !keysOnly(value, ['id', 'name', 'language', 'difficulty', 'mode', 'minutes', 'strict', 'autoPause', 'pace', 'reading']))) return false;
  return typeof value.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value.id) && typeof value.name === 'string' &&
    value.name.trim().length > 0 && value.name.length <= 60 && !/[\p{Cc}\p{Cf}]/u.test(value.name) && language(value.language) && difficulty(value.difficulty) &&
    mode(value.mode) && minutes(value.minutes) && typeof value.strict === 'boolean' && typeof value.autoPause === 'boolean' &&
    (value.pace === undefined || isPaceSettings(value.pace)) && (value.reading === undefined || isReading(value.reading, exact));
}
export function isPresetList(value: unknown, exact = false): value is PracticePreset[] {
  return Array.isArray(value) && value.length <= 50 && value.every((preset) => isPracticePreset(preset, exact)) && new Set(value.map((preset) => preset.id)).size === value.length;
}
function reading(settings: ReaderSettings): PresetReading {
  return { fontSize: settings.fontSize, lineHeight: settings.lineHeight, visibleLines: settings.visibleLines,
    showTimer: settings.showTimer !== false, showSpeed: settings.showSpeed !== false, showAccuracy: settings.showAccuracy !== false };
}
export function makePracticePreset(id: string, name: string, settings: ReaderSettings, selectedLanguage: Language, selectedDifficulty: Difficulty, includeReading: boolean): PracticePreset {
  const preset: PracticePreset = { id, name: name.trim(), language: selectedLanguage, difficulty: selectedDifficulty, mode: settings.mode, minutes: settings.minutes,
    strict: settings.strict, autoPause: settings.autoPause, pace: { ...(settings.pace ?? defaultPace) }, ...(includeReading && { reading: reading(settings) }) };
  if (!isPracticePreset(preset, true)) throw new Error('预设名称或设置无效');
  return preset;
}
export function cleanPracticePreset(value: PracticePreset): PracticePreset {
  const { id, name, language: selectedLanguage, difficulty: selectedDifficulty, mode: selectedMode, minutes: selectedMinutes, strict, autoPause } = value;
  return { id, name, language: selectedLanguage, difficulty: selectedDifficulty, mode: selectedMode, minutes: selectedMinutes, strict, autoPause,
    ...(value.pace && { pace: { enabled: value.pace.enabled, source: value.pace.source, customSpeed: value.pace.customSpeed } }),
    ...(value.reading && { reading: { fontSize: value.reading.fontSize, lineHeight: value.reading.lineHeight, visibleLines: value.reading.visibleLines,
      showTimer: value.reading.showTimer, showSpeed: value.reading.showSpeed, showAccuracy: value.reading.showAccuracy } }) };
}
export type PresetAction = { type: 'add'; preset: PracticePreset } | { type: 'update'; expected: PracticePreset; preset: PracticePreset } | { type: 'delete'; expected: PracticePreset };
export function applyPresetAction(presets: PracticePreset[], action: PresetAction): PracticePreset[] {
  if (!isPresetList(presets, true)) throw new Error('预设数据无法读取');
  if (action.type === 'add') {
    if (!isPracticePreset(action.preset, true) || presets.length >= 50 || presets.some((preset) => preset.id === action.preset.id)) throw new Error('预设无效或已达上限');
    return [...presets, cleanPracticePreset(action.preset)];
  }
  const index = presets.findIndex((preset) => preset.id === action.expected.id);
  if (index < 0 || JSON.stringify(cleanPracticePreset(presets[index])) !== JSON.stringify(cleanPracticePreset(action.expected))) throw new Error('预设已变化，请重新打开后重试');
  if (action.type === 'delete') return presets.filter((_, itemIndex) => itemIndex !== index);
  if (action.preset.id !== action.expected.id || !isPracticePreset(action.preset, true)) throw new Error('预设名称或设置无效');
  return presets.map((preset, itemIndex) => itemIndex === index ? cleanPracticePreset(action.preset) : preset);
}
export function exportPracticeSettings(settings: ReaderSettings, selectedLanguage: Language, selectedDifficulty: Difficulty): string {
  const presets = (settings.presets ?? []).map(cleanPracticePreset);
  const value: PracticeSettingsFile = { format: 'typing-practice-settings', version: 1, exportedAt: new Date().toISOString(),
    settings: { language: selectedLanguage, difficulty: selectedDifficulty, mode: settings.mode, minutes: settings.minutes, strict: settings.strict, autoPause: settings.autoPause, pace: { ...(settings.pace ?? defaultPace) }, ...reading(settings) }, presets };
  const text = JSON.stringify(value, null, 2);
  parsePracticeSettings(text);
  return text;
}
export function parsePracticeSettings(text: string): PracticeSettingsFile {
  if (new TextEncoder().encode(text).length > 256 * 1024) throw new Error('设置文件不能超过 256 KB');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('设置 JSON 无法读取'); }
  const settings = isObject(value) && isObject(value.settings) ? value.settings : undefined;
  const readingValue = settings ? Object.fromEntries(readingKeys.map((key) => [key, settings[key]])) : undefined;
  if (!isObject(value) || !keysOnly(value, ['format', 'version', 'exportedAt', 'settings', 'presets']) || value.format !== 'typing-practice-settings' || value.version !== 1 ||
    typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt)) || !settings ||
    !keysOnly(settings, ['language', 'difficulty', 'mode', 'minutes', 'strict', 'autoPause', 'pace', ...readingKeys]) ||
    !language(settings.language) || !difficulty(settings.difficulty) || !mode(settings.mode) || !minutes(settings.minutes) ||
    typeof settings.strict !== 'boolean' || typeof settings.autoPause !== 'boolean' || (settings.pace !== undefined && !isPaceSettings(settings.pace)) || !isReading(readingValue, true) ||
    !isPresetList(value.presets, true)) throw new Error('设置文件版本或内容无效');
  const parsed = value as unknown as PracticeSettingsFile;
  return { ...parsed, settings: { ...parsed.settings, pace: { ...(parsed.settings.pace ?? defaultPace) } },
    presets: parsed.presets.map((preset) => ({ ...preset, pace: { ...(preset.pace ?? defaultPace) } })) };
}
