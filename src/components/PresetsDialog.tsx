import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Difficulty, Language } from '../data/articles';
import type { PracticePreset, ReaderSettings } from '../lib/models';
import { makePracticePreset, type PresetAction } from '../lib/practice-settings';
import { Dialog } from './Dialog';

const difficultyNames: Record<Difficulty, string> = { beginner: '入门', intermediate: '进阶', advanced: '挑战' };

function presetId() {
  if (typeof crypto.randomUUID === 'function') return `preset-${crypto.randomUUID()}`;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `preset-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function PresetsDialog({ settings, language, difficulty, onAction, onApply, onClose }: { settings: ReaderSettings; language: Language; difficulty: Difficulty;
  onAction: (action: PresetAction) => Promise<void>; onApply: (preset: PracticePreset) => Promise<void>; onClose: () => void }) {
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
    catch (problem) { setError(problem instanceof Error ? problem.message : '预设保存失败'); return false; }
    finally { setBusy(false); }
  }
  async function add(event: FormEvent) {
    event.preventDefault();
    try {
      const preset = makePracticePreset(presetId(), name, settings, language, difficulty, includeReading);
      if (await perform({ type: 'add', preset }, '预设已保存')) setName('');
    } catch (problem) { setError(problem instanceof Error ? problem.message : '预设无效'); }
  }
  async function update(preset: PracticePreset) {
    try {
      const next = makePracticePreset(preset.id, preset.name, settings, language, difficulty, includeReading);
      await perform({ type: 'update', expected: preset, preset: next }, '预设已更新');
    } catch (problem) { setError(problem instanceof Error ? problem.message : '预设无效'); }
  }
  async function rename(event: FormEvent) {
    event.preventDefault(); if (!renaming) return;
    const next = { ...renaming.preset, name: renaming.name.trim() };
    if (await perform({ type: 'update', expected: renaming.preset, preset: next }, '名称已更新')) setRenaming(undefined);
  }
  async function apply(preset: PracticePreset) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await onApply(preset); }
    catch (problem) { setError(problem instanceof Error ? problem.message : '应用失败'); }
    finally { setBusy(false); }
  }
  const close = () => { if (busy) return; if (deleting) setDeleting(undefined); else onClose(); };
  return <Dialog title={deleting ? '删除预设？' : '练习预设'} onClose={close} dismissible={!busy}>
    {deleting ? <div className="feature-form"><p>“{deleting.name}”将被删除。</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="feature-actions"><button ref={safeAction} type="button" className="outline-button" disabled={busy} onClick={() => setDeleting(undefined)}>取消</button>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void perform({ type: 'delete', expected: deleting }, '预设已删除').then((ok) => { if (ok) setDeleting(undefined); })}>确认删除</button></div>
    </div> : <div className="feature-form">
      <p>应用时，未完成练习会保存为草稿。</p>
      <form className="feature-form" onSubmit={(event) => void add(event)}>
        <label>预设名称<input value={name} maxLength={60} disabled={busy} onChange={(event) => setName(event.target.value)} /></label>
        <label className="settings-check"><input type="checkbox" checked={includeReading} disabled={busy} onChange={(event) => setIncludeReading(event.target.checked)} />保存／更新时包含阅读设置</label>
        <button type="submit" className="primary-button" disabled={busy || !name.trim()}>保存当前预设</button>
      </form>
      {!!settings.presets?.length && <ul className="feature-list">{settings.presets.map((preset) => <li className="feature-row" key={preset.id}>
        <div className="feature-row-main"><strong>{preset.name}</strong><div className="feature-meta"><span>{preset.language === 'zh' ? '中文' : 'English'}</span><span>{difficultyNames[preset.difficulty]}</span><span>{preset.mode === 'article' ? `整篇 · 限时默认 ${preset.minutes} 分钟` : `${preset.minutes} 分钟`}</span>{preset.strict && <span>严格纠错</span>}{preset.reading && <span>阅读设置</span>}</div>
          {renaming?.preset.id === preset.id && <form className="feature-form" onSubmit={(event) => void rename(event)}><label>新预设名称<input value={renaming.name} maxLength={60} disabled={busy} onChange={(event) => setRenaming({ ...renaming, name: event.target.value })} /></label><div className="feature-actions"><button type="button" className="text-button" disabled={busy} onClick={() => setRenaming(undefined)}>取消</button><button className="outline-button" disabled={busy || !renaming.name.trim()}>保存名称</button></div></form>}
        </div>
        <div className="feature-actions"><button type="button" className="outline-button feature-action-button" aria-label={`应用 ${preset.name}`} disabled={busy} onClick={() => void apply(preset)}>应用</button>
          <button type="button" className="text-button" aria-label={`更新 ${preset.name}`} disabled={busy} onClick={() => void update(preset)}>更新</button>
          <button type="button" className="text-button" aria-label={`重命名 ${preset.name}`} disabled={busy} onClick={() => setRenaming({ preset, name: preset.name })}>重命名</button>
          <button type="button" className="text-button" aria-label={`删除 ${preset.name}`} disabled={busy} onClick={() => { setError(''); setDeleting(preset); }}>删除</button></div>
      </li>)}</ul>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
    </div>}
  </Dialog>;
}
