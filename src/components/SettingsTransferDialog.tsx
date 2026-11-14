import { useState, type ChangeEvent } from 'react';
import type { Difficulty, Language } from '../data/articles';
import type { ReaderSettings } from '../lib/models';
import { exportPracticeSettings, parsePracticeSettings, type PracticeSettingsFile } from '../lib/practice-settings';
import { Dialog } from './Dialog';

const difficultyNames: Record<Difficulty, string> = { beginner: '入门', intermediate: '进阶', advanced: '挑战' };

export function SettingsTransferDialog({ settings, language, difficulty, onImport, onClose }: { settings: ReaderSettings; language: Language; difficulty: Difficulty;
  onImport: (file: PracticeSettingsFile) => Promise<void>; onClose: () => void }) {
  const [file, setFile] = useState<PracticeSettingsFile>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function exportSettings() {
    setError(''); setNotice('');
    try {
      const content = exportPracticeSettings(settings, language, difficulty);
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'typing-practice-settings.json'; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('设置已导出');
    } catch (problem) { setError(problem instanceof Error ? problem.message : '导出失败'); }
  }
  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    setFile(undefined); setError(''); setNotice('');
    if (!selected) return;
    if (selected.size > 256 * 1024) { setError('设置文件不能超过 256 KB'); return; }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      try { setFile(parsePracticeSettings(new TextDecoder('utf-8', { fatal: true }).decode(reader.result as ArrayBuffer))); }
      catch (problem) { setError(problem instanceof TypeError ? '设置文件须为 UTF-8' : problem instanceof Error ? problem.message : '设置文件无法读取'); }
      finally { setBusy(false); }
    };
    reader.onerror = () => { setError('设置文件无法读取'); setBusy(false); };
    try { reader.readAsArrayBuffer(selected); }
    catch { setError('设置文件无法读取'); setBusy(false); }
  }
  async function apply() {
    if (!file || busy) return;
    setBusy(true); setError('');
    try { await onImport(file); }
    catch (problem) { setError(problem instanceof Error ? problem.message : '导入失败'); }
    finally { setBusy(false); }
  }
  return <Dialog title="练习设置导入／导出" onClose={onClose} dismissible={!busy}>
    <div className="feature-form">
      <button type="button" className="outline-button" disabled={busy} onClick={exportSettings}>导出设置 JSON</button>
      <label className="feature-file"><span>选择设置 JSON</span><input type="file" accept=".json,application/json" disabled={busy} onClick={(event) => { event.currentTarget.value = ''; setFile(undefined); setError(''); setNotice(''); }} onChange={selectFile} /></label>
      {file && <div className="feature-form">
        <p>{file.settings.language === 'zh' ? '中文' : 'English'} · {difficultyNames[file.settings.difficulty]} · {file.settings.mode === 'article' ? `整篇 · 限时默认 ${file.settings.minutes} 分钟` : `限时 ${file.settings.minutes} 分钟`}{file.settings.strict ? ' · 严格纠错' : ''}</p>
        <p>自动暂停：{file.settings.autoPause ? '开' : '关'} · 字号 {file.settings.fontSize} · 行距 {file.settings.lineHeight} · 可见 {file.settings.visibleLines} 行</p>
        <p>实时指标：计时{file.settings.showTimer ? '开' : '关'}、速度{file.settings.showSpeed ? '开' : '关'}、准确率{file.settings.showAccuracy ? '开' : '关'}</p>
        <p>预设：{file.presets.length} 项</p>
        {!!file.presets.length && <ul>{file.presets.map((preset) => <li key={preset.id}>{preset.name} · {preset.language === 'zh' ? '中文' : 'English'} · {difficultyNames[preset.difficulty]} · {preset.mode === 'article' ? `整篇 · 限时默认 ${preset.minutes} 分钟` : `${preset.minutes} 分钟`} · {preset.strict ? '严格纠错' : '非严格'} · 自动暂停{preset.autoPause ? '开' : '关'}{preset.reading && ` · 字号 ${preset.reading.fontSize} · 行距 ${preset.reading.lineHeight} · ${preset.reading.visibleLines} 行 · 计时${preset.reading.showTimer ? '开' : '关'}、速度${preset.reading.showSpeed ? '开' : '关'}、准确率${preset.reading.showAccuracy ? '开' : '关'}`}</li>)}</ul>}
        <p className="form-error">导入将替换当前练习设置和预设；未完成练习会保存为草稿。</p>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void apply()}>确认导入</button>
      </div>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {notice && <p role="status" className="form-notice">{notice}</p>}
    </div>
  </Dialog>;
}
