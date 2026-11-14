import { expect, it } from 'vitest';
import { applyPresetAction, exportPracticeSettings, parsePracticeSettings, makePracticePreset } from '../src/lib/practice-settings';
import { defaultSettings } from '../src/lib/models';

it('exports only allowlisted settings and presets, without personal content or authentication material', () => {
  const preset = makePracticePreset('preset-one', '夜读', { ...defaultSettings, minutes: 7 }, 'zh', 'intermediate', true);
  const text = exportPracticeSettings({ ...defaultSettings, minutes: 7, mistakeStates: { 'zh:风': 'ignored' }, presets: [preset], password: 'secret' } as never, 'zh', 'intermediate');
  const parsed = parsePracticeSettings(text);
  expect(parsed).toMatchObject({ version: 1, settings: { minutes: 7, language: 'zh', difficulty: 'intermediate' }, presets: [{ id: 'preset-one', name: '夜读' }] });
  expect(text).not.toContain('secret');
  expect(text).not.toContain('mistakeStates');
  expect(text).not.toContain('article');
});

it('updates and deletes by stable ID while rejecting stale edits', () => {
  const first = makePracticePreset('p1', '原名', defaultSettings, 'zh', 'beginner', false);
  const list = applyPresetAction([], { type: 'add', preset: first });
  const renamed = { ...first, name: '新名' };
  const updated = applyPresetAction(list, { type: 'update', expected: first, preset: renamed });
  expect(updated).toEqual([renamed]);
  expect(() => applyPresetAction(updated, { type: 'delete', expected: first })).toThrow('预设已变化');
  expect(applyPresetAction(updated, { type: 'delete', expected: renamed })).toEqual([]);
  expect(() => applyPresetAction(updated, { type: 'add', preset: first })).toThrow();
});

it('validates version, fields, ranges and duplicate preset IDs before applying anything', () => {
  const preset = makePracticePreset('p1', '测试', defaultSettings, 'en', 'beginner', false);
  const valid = JSON.parse(exportPracticeSettings({ ...defaultSettings, presets: [preset] }, 'en', 'beginner'));
  expect(() => parsePracticeSettings(JSON.stringify({ ...valid, version: 2 }))).toThrow();
  expect(() => parsePracticeSettings(JSON.stringify({ ...valid, settings: { ...valid.settings, minutes: 0 } }))).toThrow();
  expect(() => parsePracticeSettings(JSON.stringify({ ...valid, settings: { ...valid.settings, password: 'not-allowed' } }))).toThrow();
  expect(() => parsePracticeSettings(JSON.stringify({ ...valid, presets: [preset, preset] }))).toThrow();
  expect(() => parsePracticeSettings(JSON.stringify({ ...valid, presets: [{ ...preset, text: 'private content' }] }))).toThrow();
  expect(preset.reading).toBeUndefined();
});

it('reads older version 1 files without a pace field as disabled pace', () => {
  const preset = makePracticePreset('p1', '旧预设', defaultSettings, 'zh', 'beginner', false);
  const old = JSON.parse(exportPracticeSettings({ ...defaultSettings, presets: [preset] }, 'zh', 'beginner'));
  delete old.settings.pace; delete old.presets[0].pace;
  const parsed = parsePracticeSettings(JSON.stringify(old));
  expect(parsed.settings.pace.enabled).toBe(false);
  expect(parsed.presets[0].pace?.enabled).toBe(false);
});

it('round-trips pace settings in both the current configuration and named presets', () => {
  const pace = { enabled: true, source: 'best' as const, customSpeed: 80 };
  const settings = { ...defaultSettings, pace };
  const preset = makePracticePreset('p1', '配速', settings, 'en', 'intermediate', true);
  const parsed = parsePracticeSettings(exportPracticeSettings({ ...settings, presets: [preset] }, 'en', 'intermediate'));
  expect(parsed.settings.pace).toEqual(pace);
  expect(parsed.presets[0].pace).toEqual(pace);
});
