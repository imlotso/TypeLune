import { useI18n } from '../lib/i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Difficulty, Language } from '../data/articles';
import type { PracticePreset, ReaderSettings } from '../lib/models';
import { makePracticePreset, type PresetAction } from '../lib/practice-settings';
import { Dialog } from './Dialog';


function presetId() {
  if (typeof crypto.randomUUID === 'function') return `preset-${crypto.randomUUID()}`;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `preset-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function PresetsDialog({ settings, language, difficulty, onAction, onApply, onClose }: { settings: ReaderSettings; language: Language; difficulty: Difficulty;
  onAction: (action: PresetAction) => Promise<void>; onApply: (preset: PracticePreset) => Promise<void>; onClose: () => void }) {
  const { t, locale } = useI18n();
const difficultyNames: Record<Difficulty, string> = { beginner: t("入门", "Beginner"), intermediate: t("进阶", "Intermediate"), advanced: t("挑战", "Advanced") };

  const [name, setName] = useState('');
  const [includeReading, setIncludeReading] = useState(true);
  const [renaming, setRenaming] = useState<{ preset: PracticePreset; name: string }>();
  const [deleting, setDeleting] = useState<PracticePreset>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const safeAction = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (deleting) safeAction.current?.focus(); }, [deleting]);
  async function perform(action: PresetAction, message: string) {
    if (busy) return false;
    setBusy(true); setError(''); setNotice('');
    try { await onAction(action); setNotice(message); return true; }
    catch (problem) { setError(problem instanceof Error ? problem.message : t("预设保存失败", "Could not save preset")); return false; }
    finally { setBusy(false); }
  }
  async function add(event: FormEvent) {
    event.preventDefault();
    try {
      const preset = makePracticePreset(presetId(), name, settings, language, difficulty, includeReading);
      if (await perform({ type: 'add', preset }, t("预设已保存", "Preset saved"))) setName('');
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("预设无效", "Invalid preset")); }
  }
  async function update(preset: PracticePreset) {
    try {
      const next = makePracticePreset(preset.id, preset.name, settings, language, difficulty, includeReading);
      await perform({ type: 'update', expected: preset, preset: next }, t("预设已更新", "Preset updated"));
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("预设无效", "Invalid preset")); }
  }
  async function rename(event: FormEvent) {
    event.preventDefault(); if (!renaming) return;
    const next = { ...renaming.preset, name: renaming.name.trim() };
    if (await perform({ type: 'update', expected: renaming.preset, preset: next }, t("名称已更新", "Name updated"))) setRenaming(undefined);
  }
  async function apply(preset: PracticePreset) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await onApply(preset); }
    catch (problem) { setError(problem instanceof Error ? problem.message : t("应用失败", "Could not apply preset")); }
    finally { setBusy(false); }
  }
  const close = () => { if (busy) return; if (deleting) setDeleting(undefined); else onClose(); };
  return <Dialog title={deleting ? t("删除预设？", "Delete preset?") : t("练习预设", "Practice presets")} onClose={close} dismissible={!busy}>
    {deleting ? <div className="feature-form"><p>“{deleting.name}{t("”将被删除。", "” will be deleted.")}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="feature-actions"><button ref={safeAction} type="button" className="outline-button" disabled={busy} onClick={() => setDeleting(undefined)}>{t("取消", "Cancel")}</button>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void perform({ type: 'delete', expected: deleting }, t("预设已删除", "Preset deleted")).then((ok) => { if (ok) setDeleting(undefined); })}>{t("确认删除", "Confirm delete")}</button></div>
    </div> : <div className="feature-form">
      <p>{t("应用时，未完成练习会保存为草稿。", "Unfinished practice is saved as a draft when applying a preset.")}</p>
      <form className="feature-form" onSubmit={(event) => void add(event)}>
        <label>{t("预设名称", "Preset name")}<input value={name} maxLength={60} disabled={busy} onChange={(event) => setName(event.target.value)} /></label>
        <label className="settings-check"><input type="checkbox" checked={includeReading} disabled={busy} onChange={(event) => setIncludeReading(event.target.checked)} />{t("保存／更新时包含阅读设置", "Include reading settings when saving or updating")}</label>
        <button type="submit" className="primary-button" disabled={busy || !name.trim()}>{t("保存当前预设", "Save current preset")}</button>
      </form>
      {!!settings.presets?.length && <ul className="feature-list">{settings.presets.map((preset) => <li className="feature-row" key={preset.id}>
        <div className="feature-row-main"><strong>{preset.name}</strong><div className="feature-meta"><span>{preset.language === 'zh' ? t("中文", "Chinese") : 'English'}</span><span>{difficultyNames[preset.difficulty]}</span><span>{preset.mode === 'article' ? t(`整篇 · 限时默认 ${preset.minutes} 分钟`, `Full article · default time ${preset.minutes} min`) : t(`${preset.minutes} 分钟`, `${preset.minutes} min`)}</span>{preset.strict && <span>{t("严格纠错", "Strict correction")}</span>}{preset.pace?.enabled && <span>{t("配速", "Pace")}</span>}{preset.reading && <span>{t("阅读设置", "Reading settings")}</span>}</div>
          {renaming?.preset.id === preset.id && <form className="feature-form" onSubmit={(event) => void rename(event)}><label>{t("新预设名称", "New preset name")}<input value={renaming.name} maxLength={60} disabled={busy} onChange={(event) => setRenaming({ ...renaming, name: event.target.value })} /></label><div className="feature-actions"><button type="button" className="text-button" disabled={busy} onClick={() => setRenaming(undefined)}>{t("取消", "Cancel")}</button><button className="outline-button" disabled={busy || !renaming.name.trim()}>{t("保存名称", "Save name")}</button></div></form>}
        </div>
        <div className="feature-actions"><button type="button" className="outline-button feature-action-button" aria-label={t(`应用 ${preset.name}`, `Apply ${preset.name}`)} disabled={busy} onClick={() => void apply(preset)}>{t("应用", "Apply")}</button>
          <button type="button" className="text-button" aria-label={t(`更新 ${preset.name}`, `Update ${preset.name}`)} disabled={busy} onClick={() => void update(preset)}>{t("更新", "Update")}</button>
          <button type="button" className="text-button" aria-label={t(`重命名 ${preset.name}`, `Rename ${preset.name}`)} disabled={busy} onClick={() => setRenaming({ preset, name: preset.name })}>{t("重命名", "Rename")}</button>
          <button type="button" className="text-button" aria-label={t(`删除 ${preset.name}`, `Delete ${preset.name}`)} disabled={busy} onClick={() => { setError(''); setDeleting(preset); }}>{t("删除", "Delete")}</button></div>
      </li>)}</ul>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
    </div>}
  </Dialog>;
}
